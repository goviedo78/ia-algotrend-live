// supabase-js uses the global fetch with no deadline. When Postgres hangs (it
// did on 2026-09-11: TCP accepted, no reply) every request waits until the
// platform gives up — ~90s from PostgREST, 300s from Vercel — and the page
// waits with it. A bounded fetch turns a dead database into a fast failure
// that the cache layer and the clients already know how to absorb.
//
// The deadline is enforced with AbortController rather than AbortSignal.timeout
// on purpose: postgrest-js retries GETs up to three times on anything that is
// not an AbortError, and the TimeoutError the latter raises would turn one
// 15s deadline into a 67s one.
export function fetchWithTimeout(ms: number): typeof fetch {
  return async (input, init) => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), ms)
    const signal = init?.signal
      ? AbortSignal.any([init.signal, controller.signal])
      : controller.signal
    try {
      return await fetch(input, { ...init, signal })
    } finally {
      clearTimeout(timer)
    }
  }
}

// Data queries: the trade tables answer in well under a second when healthy;
// a request still open after this is a stuck database, not a slow one.
export const DATA_TIMEOUT_MS = 15_000

// Session refresh runs in the proxy in front of every page. Auth must never
// hold a render hostage, so it gets a much shorter leash.
export const AUTH_TIMEOUT_MS = 5_000
