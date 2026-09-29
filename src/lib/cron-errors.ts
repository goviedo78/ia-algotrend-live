// Un corte aguas arriba (Supabase colgado, Bitstamp sin responder, red) no es un endpoint
// roto, y devolverlo como 5xx sale caro: cron-job.org desactiva el job tras unos pocos
// fallos seguidos y no lo vuelve a prender aunque el servicio se recupere. Así quedó muerto
// el disparador BTC el 2026-09-23 (AbortError de la DB): durante días sólo corrió el respaldo
// de GitHub Actions, que se saltea horas, y el cierre del #363 salió 1 h 35 min tarde.
const TRANSIENT_PATTERNS = [
  /abort/i,
  /timeout|timed out/i,
  /fetch failed/i,
  /socket hang up/i,
  /ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|UND_ERR/,
]

export function isTransientUpstreamError(err: unknown): boolean {
  const name = err instanceof Error ? err.name : ''
  if (name === 'AbortError' || name === 'TimeoutError') return true
  const cause = err instanceof Error && err.cause ? String((err.cause as { code?: unknown }).code ?? err.cause) : ''
  const text = `${err instanceof Error ? err.message : String(err)} ${cause}`
  return TRANSIENT_PATTERNS.some((pattern) => pattern.test(text))
}
