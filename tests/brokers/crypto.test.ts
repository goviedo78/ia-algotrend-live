import assert from 'node:assert/strict'
import { generateKeyPairSync } from 'node:crypto'
import test from 'node:test'
import { decryptCredentials, encryptCredentials, type DataKeyProvider } from '../../src/lib/brokers/crypto'

const plaintextKey = Buffer.alloc(32, 7)
const provider: DataKeyProvider = {
  async generateDataKey() { return { plaintext: Buffer.from(plaintextKey), encrypted: Buffer.from('encrypted-data-key') } },
  async decryptDataKey() { return Buffer.from(plaintextKey) },
}

test('credential envelope round-trips without exposing plaintext fields', async () => {
  process.env.BROKER_ENVELOPE_KEY_ID = 'test-key'
  const envelope = await encryptCredentials(
    { apiKey: 'api-key-value-1234', secretKey: 'secret-key-value-1234' },
    { connectionId: 'connection-1', userId: 'user-1', broker: 'BINGX', environment: 'DEMO', version: 1 },
    provider,
  )
  assert.equal(JSON.stringify(envelope).includes('secret-key-value-1234'), false)
  assert.deepEqual(await decryptCredentials(envelope, provider), {
    apiKey: 'api-key-value-1234', secretKey: 'secret-key-value-1234',
  })
})

test('tampered AAD cannot decrypt the credential', async () => {
  process.env.BROKER_ENVELOPE_KEY_ID = 'test-key'
  const envelope = await encryptCredentials(
    { apiKey: 'api-key-value-1234', secretKey: 'secret-key-value-1234' },
    { connectionId: 'connection-1', userId: 'user-1', broker: 'BINGX', environment: 'DEMO', version: 1 },
    provider,
  )
  await assert.rejects(
    decryptCredentials({ ...envelope, aad: { ...envelope.aad, userId: 'attacker' } }, provider),
    { code: 'CREDENTIAL_DECRYPT_FAILED' },
  )
})

test('RSA envelope keeps the private key out of the control plane', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  })
  process.env.BROKER_KEY_PROVIDER = 'RSA'
  process.env.BROKER_ENVELOPE_PUBLIC_KEY_B64 = Buffer.from(publicKey).toString('base64')
  process.env.BROKER_ENVELOPE_PRIVATE_KEY_B64 = Buffer.from(privateKey).toString('base64')

  try {
    const envelope = await encryptCredentials(
      { apiKey: 'rsa-api-key', secretKey: 'rsa-secret-key' },
      { connectionId: 'connection-rsa', userId: 'user-rsa', broker: 'BINGX', environment: 'DEMO', version: 1 },
    )
    assert.match(envelope.kmsKeyId, /^rsa-sha256:[a-f0-9]{64}$/)
    assert.equal(JSON.stringify(envelope).includes('rsa-secret-key'), false)
    assert.deepEqual(await decryptCredentials(envelope), {
      apiKey: 'rsa-api-key', secretKey: 'rsa-secret-key',
    })
  } finally {
    delete process.env.BROKER_KEY_PROVIDER
    delete process.env.BROKER_ENVELOPE_PUBLIC_KEY_B64
    delete process.env.BROKER_ENVELOPE_PRIVATE_KEY_B64
  }
})
