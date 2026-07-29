import { chmod, mkdir, writeFile } from 'node:fs/promises'
import { generateKeyPairSync } from 'node:crypto'
import path from 'node:path'

const outputDir = path.resolve(process.argv[2] ?? '.broker-secrets')
const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 4096,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

await mkdir(outputDir, { recursive: true, mode: 0o700 })
await writeFile(path.join(outputDir, 'broker-envelope-public.pem'), publicKey, { mode: 0o644 })
await writeFile(path.join(outputDir, 'broker-envelope-private.pem'), privateKey, { mode: 0o600 })
await chmod(outputDir, 0o700)

console.log(`Broker envelope key pair created in ${outputDir}`)
console.log('Install the private key only as a server-side environment variable in the GONOVI runtime.')
