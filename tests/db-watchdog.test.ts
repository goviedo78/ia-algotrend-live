import assert from 'node:assert/strict'
import test from 'node:test'
import { CONFIRM_WINDOW_MS, PROBE_INTERVAL_MS, runDbWatchdog, supabaseProjectRef, type WatchdogDeps } from '../src/lib/db-watchdog'

function harness(probeResults: boolean[], projectStatus = 'ACTIVE_HEALTHY') {
  let clock = 0
  const calls = { restart: 0, alerts: [] as string[] }
  const deps: WatchdogDeps = {
    probe: async () => probeResults.shift() ?? false,
    now: () => clock,
    sleep: async (ms) => { clock += ms },
    projectStatus: async () => projectStatus,
    restart: async () => { calls.restart += 1 },
    alert: async (text) => { calls.alerts.push(text) },
  }
  return { deps, calls }
}

test('a healthy database answers the first probe and nothing else happens', async () => {
  const { deps, calls } = harness([true])
  assert.deepEqual(await runDbWatchdog(deps), { status: 'HEALTHY', probes: 1 })
  assert.equal(calls.restart, 0)
})

test('one healthy answer inside the window cancels the restart', async () => {
  const { deps, calls } = harness([false, false, false, true])
  assert.deepEqual(await runDbWatchdog(deps), { status: 'RECOVERED', probes: 4 })
  assert.equal(calls.restart, 0)
})

test('a database hung for the whole window is restarted once and the owner is told', async () => {
  const { deps, calls } = harness([])
  const outcome = await runDbWatchdog(deps)
  assert.equal(outcome.status, 'RESTARTED')
  assert.equal(outcome.probes, 1 + CONFIRM_WINDOW_MS / PROBE_INTERVAL_MS)
  assert.equal(calls.restart, 1)
  assert.equal(calls.alerts.length, 1)
})

test('a project that is already restarting is not restarted again', async () => {
  const { deps, calls } = harness([], 'RESTARTING')
  assert.equal((await runDbWatchdog(deps)).status, 'ALREADY_RESTARTING')
  assert.equal(calls.restart, 0)
})

test('a failed restart is reported, not swallowed', async () => {
  const { deps, calls } = harness([])
  deps.restart = async () => { throw new Error('Management API 401') }
  const outcome = await runDbWatchdog(deps)
  assert.equal(outcome.status, 'RESTART_FAILED')
  assert.match(calls.alerts[0], /FALLÓ/)
})

test('the project ref comes from the Supabase URL', () => {
  assert.equal(supabaseProjectRef('https://izxtkbdrgpxxtmtssygt.supabase.co'), 'izxtkbdrgpxxtmtssygt')
  assert.equal(supabaseProjectRef('https://example.com'), null)
})

test('a Management API failure while checking status is reported', async () => {
  const { deps, calls } = harness([])
  deps.projectStatus = async () => { throw new Error('Management API 503') }
  assert.equal((await runDbWatchdog(deps)).status, 'RESTART_FAILED')
  assert.equal(calls.restart, 0)
  assert.equal(calls.alerts.length, 1)
})
