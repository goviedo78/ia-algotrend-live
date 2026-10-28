import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { BitunixAdapter } from '../src/lib/brokers/adapters/bitunix'
import { BrokerPlatformError } from '../src/lib/brokers/errors'

// Read-only probe. No application/database writes, orders or leverage changes.
// Credentials stay outside the repo and are never passed as CLI arguments.
async function main() {
  const source = `${homedir()}/.config/gonovi/secrets/bitunix.txt`
  const contents = await readFile(source, 'utf8')
  const tokens = contents.match(/[A-Za-z0-9_+/=-]{16,}/g)
  if (!tokens || tokens.length !== 2) throw new Error('CREDENTIAL_FORMAT_UNRECOGNIZED')
  let requests = 0
  const readOnlyFetch: typeof fetch = (url, init) => {
    if (init?.method !== 'GET' || new URL(String(url)).origin !== 'https://fapi.bitunix.com') {
      throw new Error('READ_ONLY_PROBE_BLOCKED_REQUEST')
    }
    requests++
    return fetch(url, init)
  }
  const adapter = new BitunixAdapter({ credentials: { apiKey: tokens[0], secretKey: tokens[1] }, environment: 'LIVE', fetchImpl: readOnlyFetch })
  const validation = await adapter.validateCredentials()
  await adapter.getPositions('BTC-USDT')
  const rules = await adapter.getInstrumentRules('BTC-USDT')
  await adapter.getLastPrice('BTC-USDT')
  console.log(JSON.stringify({ authenticated: validation.canRead, btcApiSupported: rules.openEnabled && rules.closeEnabled, readOnlyRequests: requests, modifyingRequests: 0, tradingPermissionVerified: false }))
}

main().catch(error => {
  // Never print the error object, upstream payloads, credentials or account data.
  console.error(JSON.stringify({ ok: false, code: error instanceof BrokerPlatformError ? error.code : 'BITUNIX_READ_CHECK_FAILED' }))
  process.exitCode = 1
})
