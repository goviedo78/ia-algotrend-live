// Vigilante de la base de datos compartida (Supabase `tuapp-platform`, cómputo Nano).
//
// Cuando la instancia se cuelga, TCP y TLS siguen aceptando pero ninguna consulta responde, y no
// vuelve sola: el 2026-09-11 y el 2026-09-29 hubo que reiniciarla a mano por la Management API
// después de más de 20 minutos caída. Un ping para "mantenerla despierta" no sirve: recibe tráfico
// cada minuto; lo que la tumba es la falta de recursos. Esto detecta el cuelgue y la reinicia.
//
// Corre fuera de Supabase (Vercel, disparado por cron-job.org) porque pg_cron vive en la misma
// instancia que se cuelga. Una sola sonda fallida no alcanza: la base tiene que fallar sin una
// sola respuesta sana durante toda la ventana de confirmación antes de reiniciar.

export const PROBE_TIMEOUT_MS = 10_000
export const PROBE_INTERVAL_MS = 20_000
export const CONFIRM_WINDOW_MS = 4 * 60_000

export type WatchdogOutcome =
  | { status: 'HEALTHY'; probes: number }
  | { status: 'RECOVERED'; probes: number }
  | { status: 'ALREADY_RESTARTING'; probes: number; projectStatus: string }
  | { status: 'RESTARTED'; probes: number; projectStatus: string }
  | { status: 'RESTART_FAILED'; probes: number; projectStatus: string; error: string }

export interface WatchdogDeps {
  probe: () => Promise<boolean>
  now: () => number
  sleep: (ms: number) => Promise<void>
  projectStatus: () => Promise<string>
  restart: () => Promise<void>
  alert: (text: string) => Promise<void>
}

export async function runDbWatchdog(deps: WatchdogDeps): Promise<WatchdogOutcome> {
  const startedAt = deps.now()
  let probes = 1
  if (await deps.probe()) return { status: 'HEALTHY', probes }

  // Una falla aislada (un pico, un deploy de Supabase) no es un cuelgue: se confirma durante
  // toda la ventana. Cualquier respuesta sana en el medio cancela el reinicio.
  while (deps.now() - startedAt < CONFIRM_WINDOW_MS) {
    await deps.sleep(PROBE_INTERVAL_MS)
    probes += 1
    if (await deps.probe()) return { status: 'RECOVERED', probes }
  }

  // Si ya está reiniciando (o en cualquier estado que no sea el normal), un segundo reinicio
  // sólo lo demoraría.
  const projectStatus = await deps.projectStatus()
  if (projectStatus !== 'ACTIVE_HEALTHY') {
    return { status: 'ALREADY_RESTARTING', probes, projectStatus }
  }

  const minutes = Math.round((deps.now() - startedAt) / 60_000)
  try {
    await deps.restart()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await deps.alert(`🔴 Supabase no responde hace ${minutes}+ min y el reinicio automático FALLÓ: ${message}. Hay que reiniciarla a mano.`)
    return { status: 'RESTART_FAILED', probes, projectStatus, error: message }
  }
  await deps.alert(`🟠 Supabase no respondió durante ${minutes}+ min (${probes} sondas). Reinicio automático en curso; tarda ~6 min.`)
  return { status: 'RESTARTED', probes, projectStatus }
}

export function supabaseProjectRef(url: string | undefined) {
  const match = url?.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)
  return match?.[1] ?? null
}
