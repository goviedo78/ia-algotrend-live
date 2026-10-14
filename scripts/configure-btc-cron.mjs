import { pathToFileURL } from 'node:url'

export const BTC_CRON_JOB_ID = 7501566
export const BTC_CRON_CONFIG = {
  enabled: true,
  url: 'https://gonovi.app/api/cron/check',
  saveResponses: true,
  requestMethod: 0,
  requestTimeout: 60,
  schedule: { timezone: 'UTC', hours: [-1], mdays: [-1], minutes: [2, 7, 17, 32, 47], months: [-1], wdays: [-1], expiresAt: 0 },
}
const clean = value => value?.replace(/\\n/g, '').trim() ?? ''

/** Update only the existing GONOVI job. Never create a second scheduler or
 * replace unrelated notification, header or account settings. */
export async function configureBtcCron({ apiKey, cronSecret, apply = false, fetchImpl = fetch }) {
  apiKey = clean(apiKey)
  cronSecret = clean(cronSecret)
  if (!apiKey || !cronSecret) throw new Error('Missing CRONJOB_API_KEY or production CRON_SECRET')
  const url = `https://api.cron-job.org/jobs/${BTC_CRON_JOB_ID}`
  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }
  const read = async () => {
    const response = await fetchImpl(url, { headers, signal: AbortSignal.timeout(20_000) })
    if (!response.ok) throw new Error(`Scheduler read failed (HTTP ${response.status})`)
    const { jobDetails: job } = await response.json()
    if (!job || job.jobId !== BTC_CRON_JOB_ID || !['https://gonovi.app/api/cron/check', 'https://algotrend.gonovi.app/api/cron/check'].includes(job.url)) {
      throw new Error('Refusing to edit an unexpected scheduler job')
    }
    return job
  }
  const drift = job => {
    const keys = Object.keys(BTC_CRON_CONFIG).filter(key => JSON.stringify(job[key]) !== JSON.stringify(BTC_CRON_CONFIG[key]))
    const auth = Object.entries(job.extendedData?.headers ?? {}).find(([key]) => key.toLowerCase() === 'authorization')?.[1]
    if (auth !== `Bearer ${cronSecret}`) keys.push('authentication')
    return keys
  }
  let job = await read()
  const changedFields = drift(job)
  if (apply && changedFields.length) {
    const preservedHeaders = Object.fromEntries(Object.entries(job.extendedData?.headers ?? {}).filter(([name]) => !['authorization', 'x-cron-secret'].includes(name.toLowerCase())))
    const response = await fetchImpl(url, {
      method: 'PATCH', headers, signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({ job: { ...BTC_CRON_CONFIG, extendedData: { ...job.extendedData, headers: { ...preservedHeaders, Authorization: `Bearer ${cronSecret}` } } } }),
    })
    if (!response.ok) throw new Error(`Scheduler update failed (HTTP ${response.status})`)
    job = await read()
    if (drift(job).length) throw new Error('Scheduler did not retain the requested configuration')
  }
  return { jobId: BTC_CRON_JOB_ID, valid: drift(job).length === 0, changedFields, config: BTC_CRON_CONFIG, nextExecution: job.nextExecution ?? null }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.slice(2).some(arg => !['--apply', '--check'].includes(arg))) {
    console.error('Usage: configure-btc-cron.mjs [--check | --apply]')
    process.exitCode = 1
  } else {
    configureBtcCron({ apiKey: process.env.CRONJOB_API_KEY, cronSecret: process.env.CRON_SECRET, apply: process.argv.includes('--apply') })
      .then(result => { console.log(JSON.stringify(result)); if (!result.valid) process.exitCode = 1 })
      .catch(error => { console.error(error.message); process.exitCode = 1 })
  }
}
