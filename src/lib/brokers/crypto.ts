import 'server-only'

import {
  constants,
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  privateDecrypt,
  publicEncrypt,
  randomBytes,
  type KeyObject,
} from 'node:crypto'
import type { BrokerCredentials } from './domain'
import { BrokerPlatformError } from './errors'

export interface CredentialEnvelope {
  ciphertext: string
  encryptedDataKey: string
  iv: string
  authTag: string
  aad: Record<string, string | number>
  kmsKeyId: string
  algorithm: 'AES-256-GCM'
  version: number
}

export interface DataKeyProvider {
  generateDataKey(keyId: string): Promise<{ plaintext: Uint8Array; encrypted: Uint8Array }>
  decryptDataKey(encrypted: Uint8Array, keyId: string): Promise<Uint8Array>
}

function decodePem(name: 'BROKER_ENVELOPE_PUBLIC_KEY_B64' | 'BROKER_ENVELOPE_PRIVATE_KEY_B64') {
  const encoded = process.env[name]?.trim()
  if (!encoded) {
    throw new BrokerPlatformError('ENVELOPE_KEY_NOT_CONFIGURED', 'El cifrado de conexiones no está configurado.', 503)
  }
  return Buffer.from(encoded, 'base64').toString('utf8')
}

function rsaKeyFingerprint(key: KeyObject) {
  const publicKey = key.type === 'private' ? createPublicKey(key) : key
  const der = publicKey.export({ type: 'spki', format: 'der' })
  return `rsa-sha256:${createHash('sha256').update(der).digest('hex')}`
}

export function createRsaDataKeyProvider(mode: 'encrypt' | 'decrypt'): DataKeyProvider {
  const key = mode === 'encrypt'
    ? createPublicKey(decodePem('BROKER_ENVELOPE_PUBLIC_KEY_B64'))
    : createPrivateKey(decodePem('BROKER_ENVELOPE_PRIVATE_KEY_B64'))
  const fingerprint = rsaKeyFingerprint(key)

  return {
    async generateDataKey(keyId) {
      if (mode !== 'encrypt') throw new BrokerPlatformError('ENVELOPE_ACTION_DENIED', 'Acción de cifrado no permitida.', 403)
      if (keyId !== fingerprint) throw new BrokerPlatformError('ENVELOPE_KEY_MISMATCH', 'La clave de cifrado no coincide.', 503)
      const plaintext = randomBytes(32)
      return {
        plaintext,
        encrypted: publicEncrypt({
          key,
          padding: constants.RSA_PKCS1_OAEP_PADDING,
          oaepHash: 'sha256',
        }, plaintext),
      }
    },
    async decryptDataKey(encrypted, keyId) {
      if (mode !== 'decrypt') throw new BrokerPlatformError('ENVELOPE_ACTION_DENIED', 'Acción de descifrado no permitida.', 403)
      if (keyId !== fingerprint) throw new BrokerPlatformError('ENVELOPE_KEY_MISMATCH', 'La clave de cifrado no coincide.', 503)
      return privateDecrypt({
        key,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      }, encrypted)
    },
  }
}

export function createConfiguredDataKeyProvider(mode: 'encrypt' | 'decrypt') {
  const provider = process.env.BROKER_KEY_PROVIDER?.trim().toUpperCase() || 'RSA'
  if (provider !== 'RSA') {
    throw new BrokerPlatformError('ENVELOPE_PROVIDER_UNSUPPORTED', 'El proveedor de cifrado no está soportado.', 503)
  }
  return createRsaDataKeyProvider(mode)
}

function configuredEncryptionKeyId() {
  return rsaKeyFingerprint(createPublicKey(decodePem('BROKER_ENVELOPE_PUBLIC_KEY_B64')))
}

function aadBuffer(aad: CredentialEnvelope['aad']) {
  const stable = Object.keys(aad).sort().reduce<Record<string, string | number>>((result, key) => {
    result[key] = aad[key]
    return result
  }, {})
  return Buffer.from(JSON.stringify(stable), 'utf8')
}

export async function encryptCredentials(
  credentials: BrokerCredentials,
  aad: CredentialEnvelope['aad'],
  provider?: DataKeyProvider,
): Promise<CredentialEnvelope> {
  const keyProvider = provider ?? createConfiguredDataKeyProvider('encrypt')
  const keyId = provider
    ? process.env.BROKER_ENVELOPE_KEY_ID
    : configuredEncryptionKeyId()
  if (!keyId) throw new BrokerPlatformError('ENVELOPE_KEY_NOT_CONFIGURED', 'El cifrado no está configurado.', 503)

  const dataKey = await keyProvider.generateDataKey(keyId)
  const plaintextKey = Buffer.from(dataKey.plaintext)
  dataKey.plaintext.fill(0)

  try {
    if (plaintextKey.byteLength !== 32) {
      throw new BrokerPlatformError('ENVELOPE_INVALID_KEY', 'El proveedor devolvió una clave inválida.', 503)
    }
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', plaintextKey, iv)
    cipher.setAAD(aadBuffer(aad))
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(credentials), 'utf8'),
      cipher.final(),
    ])

    return {
      ciphertext: ciphertext.toString('base64'),
      encryptedDataKey: Buffer.from(dataKey.encrypted).toString('base64'),
      iv: iv.toString('base64'),
      authTag: cipher.getAuthTag().toString('base64'),
      aad,
      kmsKeyId: keyId,
      algorithm: 'AES-256-GCM',
      version: 1,
    }
  } finally {
    plaintextKey.fill(0)
  }
}

export async function decryptCredentials(
  envelope: CredentialEnvelope,
  provider: DataKeyProvider = createConfiguredDataKeyProvider('decrypt'),
): Promise<BrokerCredentials> {
  if (envelope.algorithm !== 'AES-256-GCM' || envelope.version !== 1) {
    throw new BrokerPlatformError('CREDENTIAL_FORMAT_UNSUPPORTED', 'Formato de credencial no soportado.', 500)
  }

  const decryptedDataKey = await provider.decryptDataKey(
    Buffer.from(envelope.encryptedDataKey, 'base64'),
    envelope.kmsKeyId,
  )
  const dataKey = Buffer.from(decryptedDataKey)
  decryptedDataKey.fill(0)
  let plaintext: Buffer | null = null

  try {
    if (dataKey.byteLength !== 32) {
      throw new BrokerPlatformError('ENVELOPE_INVALID_KEY', 'El proveedor devolvió una clave inválida.', 503)
    }
    const decipher = createDecipheriv('aes-256-gcm', dataKey, Buffer.from(envelope.iv, 'base64'))
    decipher.setAAD(aadBuffer(envelope.aad))
    decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'))
    plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, 'base64')),
      decipher.final(),
    ])
    const parsed = JSON.parse(plaintext.toString('utf8')) as Partial<BrokerCredentials>
    if (typeof parsed.apiKey !== 'string' || typeof parsed.secretKey !== 'string') {
      throw new BrokerPlatformError('CREDENTIAL_PAYLOAD_INVALID', 'Credencial cifrada inválida.', 500)
    }
    return { apiKey: parsed.apiKey, secretKey: parsed.secretKey }
  } catch (error) {
    if (error instanceof BrokerPlatformError) throw error
    throw new BrokerPlatformError('CREDENTIAL_DECRYPT_FAILED', 'No se pudo descifrar la credencial.', 500)
  } finally {
    plaintext?.fill(0)
    dataKey.fill(0)
  }
}
