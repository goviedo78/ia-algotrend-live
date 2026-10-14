import assert from 'node:assert/strict'
import test from 'node:test'
import { BTC_CRON_CONFIG, BTC_CRON_JOB_ID, configureBtcCron } from '../scripts/configure-btc-cron.mjs'

const oldJob = () => ({ jobId: BTC_CRON_JOB_ID, ...BTC_CRON_CONFIG, url: 'https://algotrend.gonovi.app/api/cron/check', saveResponses: false,
  schedule: { ...BTC_CRON_CONFIG.schedule, minutes: [1, 16, 31, 46], timezone: 'America/Mexico_City' },
  extendedData: { headers: { Authorization: 'Bearer old-secret', 'X-Custom': 'preserve-me' }, body: '' },
  notification: { onFailure: false }, nextExecution: 1792018020,
})

test('check detects the real scheduler drift without modifying it or exposing credentials', async () => {
  const result = await configureBtcCron({ apiKey: 'fixture-api', cronSecret: 'fixture-cron', fetchImpl: async (_url: RequestInfo | URL, init: RequestInit = {}) => {
    assert.notEqual(init.method, 'PATCH')
    return new Response(JSON.stringify({ jobDetails: oldJob() }))
  } })
  assert.equal(result.valid, false)
  assert.ok(result.changedFields.includes('schedule'))
  assert.ok(result.changedFields.includes('authentication'))
  assert.ok(!JSON.stringify(result).includes('fixture-cron'))
  assert.ok(!JSON.stringify(result).includes('fixture-api'))
})
test('apply updates one existing job, preserves other settings and verifies the saved state', async () => {
  let job = oldJob()
  let writes = 0
  const fetchImpl: typeof fetch = async (url, init = {}) => {
    assert.equal(url, `https://api.cron-job.org/jobs/${BTC_CRON_JOB_ID}`)
    if (init.method === 'PATCH') {
      writes++
      const patch = JSON.parse(String(init.body)).job
      assert.equal(patch.extendedData.headers['X-Custom'], 'preserve-me')
      assert.equal(patch.extendedData.headers.Authorization, 'Bearer fixture-cron')
      assert.equal(patch.notification, undefined)
      job = { ...job, ...patch }
      return new Response('{}')
    }
    return new Response(JSON.stringify({ jobDetails: job }))
  }
  assert.equal((await configureBtcCron({ apiKey: 'fixture-api', cronSecret: 'fixture-cron\\n', apply: true, fetchImpl })).valid, true)
  assert.equal(writes, 1)
  await configureBtcCron({ apiKey: 'fixture-api', cronSecret: 'fixture-cron', apply: true, fetchImpl })
  assert.equal(writes, 1, 'reapplying is idempotent')
})
test('unexpected scheduler identity cannot be changed', async () => {
  await assert.rejects(configureBtcCron({ apiKey: 'fixture-api', cronSecret: 'fixture-cron', apply: true,
    fetchImpl: async () => new Response(JSON.stringify({ jobDetails: { ...oldJob(), jobId: 1 } })),
  }), /unexpected scheduler/)
})
