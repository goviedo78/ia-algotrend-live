'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, LoaderCircle, Pencil, RefreshCw, Settings2, Shield, ShieldX, Trash2, UserCheck, X } from 'lucide-react'
import { canDeleteConnection, connectionStatusLabel } from '@/lib/brokers/domain'
import type { BrokerConnectionDto } from '@/lib/brokers/domain'
import type { BrokerAdminRole } from '@/lib/brokers/auth'
import { BrokerBrand } from './BrokerBrand'
import { BrokerFieldLabel } from './BrokerFieldHelp'
import { BrokerThemeToggle, useBrokerTheme } from './BrokerThemeToggle'
import { BrokerOrderHistory } from './BrokerOrderHistory'
import { EMPTY_BROKER_ORDER_HISTORY, type BrokerOrderHistoryResponse } from '@/lib/brokers/order-history-types'
import { BrokerPrivacyToggle, BrokerSensitiveValue, redactText, useBrokerPrivacy } from './BrokerPrivacy'
import { BROKER_STRATEGIES } from '@/lib/brokers/strategies'
import styles from './brokers.module.css'

type AdminConnection = BrokerConnectionDto & { userId: string; email: string | null }
type Membership = { userId: string; email: string | null; status: string; requestedAt: string; reviewNote: string | null }
type RuntimeHealth = {
  mode: 'APP_SERVERLESS'
  encryptionConfigured: boolean
  executionEnabled: boolean
  liveExecutionEnabled: boolean
  legacyExecutionEnabled: boolean
  queuedJobs: number
  processingJobs: number
  failedJobs: number
  oldestQueuedAgeSeconds: number | null
  lastCompletedExecutionAt: string | null
  p95OrderJobLatencyMs: number | null
  goldOutboxPending: number
  goldOutboxFailed: number
  goldOutboxUnrouted: number
}
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || 'No se pudo completar la operación.')
  return body as T
}

function ApprovalForm({
  connection,
  busy,
  privacyMode,
  onDone,
}: {
  connection: AdminConnection
  busy: boolean
  privacyMode: boolean
  onDone: () => Promise<void>
}) {
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const compoundSizing = connection.riskPolicy?.sizingMode === 'EQUITY_PERCENT'
  async function approve(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    const form = new FormData(event.currentTarget)
    const number = (name: string) => Number(form.get(name))
    try {
      await api(`/api/admin/broker-connections/${connection.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'APPROVE',
          risk: {
            sizingMode: form.get('sizingMode'),
            exposurePerOrderPct: number('exposurePerOrderPct'),
            fixedNotionalUsd: number('fixedNotionalUsd'),
            maxNotionalPerOrderUsd: number('maxNotionalPerOrderUsd'),
            maxTotalExposureUsd: number('maxTotalExposureUsd'),
            maxLeverage: number('maxLeverage'),
            maxOpenPositions: number('maxOpenPositions'),
            maxOrdersPerMinute: number('maxOrdersPerMinute'),
            dailyLossLimitUsd: number('dailyLossLimitUsd'),
            minAvailableMarginUsd: number('minAvailableMarginUsd'),
          },
        }),
      })
      await onDone()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo aprobar.') }
    finally { setSubmitting(false) }
  }

  return (
    <form className={styles.approvalGrid} onSubmit={approve}>
      {connection.riskPolicy && <div className={`${styles.metrics} ${styles.fullWidth}`}><span>Capital autorizado <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{connection.riskPolicy.declaredCapitalUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Perfil <strong>{connection.riskPolicy.riskProfile}</strong></span><span>Máximo sugerido / orden <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{connection.riskPolicy.suggestedNotionalPerOrderUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Reserva mínima <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{connection.riskPolicy.suggestedMinAvailableMarginUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span></div>}
      <div className={`${styles.strategyLock} ${styles.fullWidth}`}><span>Estrategia solicitada</span><strong>{BROKER_STRATEGIES[connection.requestedStrategy.code]?.label ?? connection.requestedStrategy.code}</strong><small>{connection.requestedStrategy.symbol} · {connection.requestedStrategy.timeframe} · una API exclusiva</small></div>
      <label className={styles.field}><BrokerFieldLabel label="Modo de tamaño" tooltip="Debe respetar la elección del usuario. Compuesto usa el equity de esta cuenta en cada apertura." example={compoundSizing ? 'Ejemplo: equity actual × porcentaje.' : 'Ejemplo: mismo monto en cada entrada.'} /><select name="sizingMode" defaultValue={connection.riskPolicy?.sizingMode ?? 'FIXED_NOTIONAL'}><option value={connection.riskPolicy?.sizingMode ?? 'FIXED_NOTIONAL'}>{compoundSizing ? 'Compuesto por equity' : 'Monto fijo'}</option></select></label>
      <label className={styles.field}><BrokerFieldLabel label="Capital por operación (%)" tooltip="Porcentaje máximo solicitado por el usuario. El administrador puede reducirlo, nunca aumentarlo." example="Ejemplo: hasta 100% si el usuario lo solicitó." /><input name="exposurePerOrderPct" type="number" min="1" max={connection.riskPolicy?.exposurePerOrderPct ?? 100} step="0.1" defaultValue={connection.riskPolicy?.exposurePerOrderPct ?? 100} required /></label>
      <label className={`${styles.field} ${privacyMode ? styles.sensitiveInput : ''}`}><BrokerFieldLabel label={compoundSizing ? 'Referencia inicial USD' : 'Notional fijo USD'} tooltip={compoundSizing ? 'Valor inicial informativo y límite de aprobación; la ejecución se recalcula por equity.' : 'Tamaño constante de cada nueva posición.'} example={`Ejemplo: ${connection.riskPolicy?.suggestedNotionalPerOrderUsd ?? 1} USD.`} /><input name="fixedNotionalUsd" type="number" min="1" step="0.01" defaultValue={connection.riskPolicy && connection.riskPolicy.fixedNotionalUsd > 0 ? connection.riskPolicy.fixedNotionalUsd : connection.riskPolicy?.suggestedNotionalPerOrderUsd ?? 1} required /></label>
      <label className={`${styles.field} ${privacyMode ? styles.sensitiveInput : ''}`}><BrokerFieldLabel label="Máximo inicial por orden USD" tooltip="Techo absoluto aprobado para el modo fijo y referencia inicial para compuesto." example="Ejemplo: igual o menor que la propuesta del usuario." /><input name="maxNotionalPerOrderUsd" type="number" min="1" step="0.01" defaultValue={connection.riskPolicy && connection.riskPolicy.maxNotionalPerOrderUsd > 0 ? connection.riskPolicy.maxNotionalPerOrderUsd : connection.riskPolicy?.suggestedNotionalPerOrderUsd ?? 1} required /></label>
      <label className={`${styles.field} ${privacyMode ? styles.sensitiveInput : ''}`}><BrokerFieldLabel label="Exposición total inicial USD" tooltip="Suma máxima de posiciones abiertas; en compuesto también se controla como porcentaje del equity." example={`Ejemplo: ${connection.riskPolicy?.suggestedMaxTotalExposureUsd ?? 1} USD.`} /><input name="maxTotalExposureUsd" type="number" min="1" step="0.01" defaultValue={connection.riskPolicy && connection.riskPolicy.maxTotalExposureUsd > 0 ? connection.riskPolicy.maxTotalExposureUsd : connection.riskPolicy?.suggestedMaxTotalExposureUsd ?? 1} required /></label>
      <label className={styles.field}><BrokerFieldLabel label="Apalancamiento máximo" tooltip="Multiplica exposición y riesgo. La plataforma puede imponer un máximo global menor." example="Ejemplo seguro inicial: 1x." /><input name="maxLeverage" type="number" min="1" step="1" defaultValue={connection.riskPolicy?.maxLeverage ?? 1} required /></label>
      <label className={styles.field}><BrokerFieldLabel label="Posiciones máximas" tooltip="Cantidad máxima de posiciones simultáneas para esta conexión." example="Ejemplo: 1 posición." /><input name="maxOpenPositions" type="number" min="1" step="1" defaultValue={connection.riskPolicy && connection.riskPolicy.maxOpenPositions > 0 ? connection.riskPolicy.maxOpenPositions : 1} required /></label>
      <label className={styles.field}><BrokerFieldLabel label="Órdenes por minuto" tooltip="Protección contra señales repetidas o ráfagas accidentales." example="Ejemplo: 2 órdenes permite cerrar y abrir." /><input name="maxOrdersPerMinute" type="number" min="1" step="1" defaultValue={connection.riskPolicy && connection.riskPolicy.maxOrdersPerMinute > 0 ? connection.riskPolicy.maxOrdersPerMinute : 2} required /></label>
      <label className={`${styles.field} ${privacyMode ? styles.sensitiveInput : ''}`}><BrokerFieldLabel label="Pérdida diaria USD" tooltip="Bloquea nuevas aperturas al alcanzar esta pérdida realizada. Los cierres siguen permitidos." example={`Ejemplo: ${connection.riskPolicy?.suggestedDailyLossLimitUsd ?? 1} USD.`} /><input name="dailyLossLimitUsd" type="number" min="0.01" step="0.01" defaultValue={connection.riskPolicy && connection.riskPolicy.dailyLossLimitUsd > 0 ? connection.riskPolicy.dailyLossLimitUsd : connection.riskPolicy?.suggestedDailyLossLimitUsd ?? 1} required /></label>
      <label className={`${styles.field} ${privacyMode ? styles.sensitiveInput : ''}`}><BrokerFieldLabel label="Margen disponible mínimo" tooltip="Reserva que debe permanecer libre después de calcular la orden." example={`Ejemplo: ${connection.riskPolicy?.suggestedMinAvailableMarginUsd ?? 0} USD.`} /><input name="minAvailableMarginUsd" type="number" min="0" step="0.01" defaultValue={connection.riskPolicy && connection.riskPolicy.minAvailableMarginUsd > 0 ? connection.riskPolicy.minAvailableMarginUsd : connection.riskPolicy?.suggestedMinAvailableMarginUsd ?? 0} required /></label>
      <button className={styles.primaryButton} disabled={busy || submitting} type="submit">{submitting ? <LoaderCircle className={styles.spin} size={16} /> : <Check size={16} />} Aprobar y activar</button>
      {error && <p className={styles.error} role="alert">{error}</p>}
    </form>
  )
}

export function BrokerAdminPanel({ email, role }: { email: string; role: BrokerAdminRole }) {
  const { theme, toggleTheme } = useBrokerTheme()
  const { privacyMode, togglePrivacyMode } = useBrokerPrivacy()
  const [memberships, setMemberships] = useState<Membership[]>([])
  const [connections, setConnections] = useState<AdminConnection[]>([])
  const [runtime, setRuntime] = useState<RuntimeHealth | null>(null)
  const [orderHistory, setOrderHistory] = useState<BrokerOrderHistoryResponse>(EMPTY_BROKER_ORDER_HISTORY)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const actionInFlight = useRef(false)
  const loadInFlight = useRef(false)

  const load = useCallback(async (silent = false) => {
    if (loadInFlight.current) return
    loadInFlight.current = true
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      const [access, brokerData, health, history] = await Promise.all([
        api<{ memberships: Membership[] }>('/api/admin/broker-memberships'),
        api<{ connections: AdminConnection[]; executionMode: 'APP_SERVERLESS' }>('/api/admin/broker-connections'),
        api<{ runtime: RuntimeHealth }>('/api/admin/broker-health'),
        api<BrokerOrderHistoryResponse>('/api/admin/broker-orders'),
      ])
      setMemberships(access.memberships)
      setConnections(brokerData.connections)
      setRuntime(health.runtime)
      setOrderHistory(history)
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cargar el panel.') }
    finally {
      loadInFlight.current = false
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    const interval = window.setInterval(() => void load(true), 5_000)
    return () => window.clearInterval(interval)
  }, [load])

  async function reviewMembership(userId: string, status: 'ACTIVE' | 'SUSPENDED' | 'REVOKED') {
    if (actionInFlight.current) return
    if (status === 'REVOKED' && !window.confirm('Esto revoca todas las credenciales del usuario. Las posiciones abiertas no se cierran automáticamente. ¿Continuar?')) return
    actionInFlight.current = true
    setBusy(true)
    try { await api(`/api/admin/broker-memberships/${userId}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo revisar la solicitud.') }
    finally { actionInFlight.current = false; setBusy(false) }
  }

  async function connectionAction(id: string, action: 'REJECT' | 'SUSPEND' | 'RESUME' | 'PREPARE_EDIT' | 'REVOKE' | 'CONFIRM_MANUAL_RESOLUTION' | 'DELETE') {
    if (actionInFlight.current) return
    if (action === 'REVOKE' && !window.confirm('La credencial se eliminará de GONOVI. Las posiciones abiertas no se cierran automáticamente. ¿Continuar?')) return
    if (action === 'CONFIRM_MANUAL_RESOLUTION' && !window.confirm('Confirmá sólo después de verificar en el broker que no quedan posiciones abiertas. ¿Continuar?')) return
    if (action === 'DELETE' && !window.confirm('La conexión se eliminará del panel y no podrá recuperarse. ¿Continuar?')) return
    actionInFlight.current = true
    setBusy(true)
    try { await api(`/api/admin/broker-connections/${id}`, action === 'DELETE' ? { method: 'DELETE' } : { method: 'PATCH', body: JSON.stringify({ action, ...(['REJECT', 'CONFIRM_MANUAL_RESOLUTION'].includes(action) ? { note: action === 'REJECT' ? 'Rechazada por administrador' : 'Posición verificada manualmente en el broker' } : {}) }) }); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la conexión.') }
    finally { actionInFlight.current = false; setBusy(false) }
  }

  async function editLabel(connection: AdminConnection) {
    const label = window.prompt('Nombre de la conexión', connection.label)?.trim()
    if (!label || label === connection.label || actionInFlight.current) return
    actionInFlight.current = true
    setBusy(true)
    try { await api(`/api/admin/broker-connections/${connection.id}`, { method: 'PATCH', body: JSON.stringify({ action: 'UPDATE_LABEL', label }) }); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cambiar el nombre.') }
    finally { actionInFlight.current = false; setBusy(false) }
  }

  async function retryGoldOutbox() {
    if (actionInFlight.current) return
    actionInFlight.current = true
    setBusy(true)
    try { await api('/api/admin/broker-outbox/retry', { method: 'POST', body: '{}' }); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo reintentar la cola de Oro 30m.') }
    finally { actionInFlight.current = false; setBusy(false) }
  }

  const canWrite = role !== 'admin_readonly'
  const canRevoke = role === 'security_admin'

  return (
    <main className={styles.page} data-theme={theme}>
      <header className={styles.topbar}><BrokerBrand /><nav><Link href="/cuenta/conexiones">Mis conexiones</Link><BrokerPrivacyToggle active={privacyMode} onToggle={togglePrivacyMode} /><BrokerThemeToggle theme={theme} onToggle={toggleTheme} /><span className={styles.identity}>{redactText(privacyMode, email, 'Email oculto')} · {role}</span></nav></header>
      <div className={styles.content}>
        <div className={styles.titleRow}><Shield size={24} /><div><h1>Administración de brokers</h1><p>Aprobaciones, riesgo y revocación de credenciales.</p></div><button className={styles.iconButton} title="Actualizar" onClick={() => void load()}><RefreshCw size={17} /></button></div>
        <div className={styles.systemStrip}><span>Ejecución</span><strong>Dentro de GONOVI</strong><span>Cifrado</span><strong>{runtime?.encryptionConfigured ? 'Configurado' : 'Incompleto'}</strong><span>En cola</span><strong>{runtime?.queuedJobs ?? 0}</strong><span>Procesando</span><strong>{runtime?.processingJobs ?? 0}</strong><span>Más antiguo</span><strong>{runtime?.oldestQueuedAgeSeconds == null ? 'Sin espera' : `${runtime.oldestQueuedAgeSeconds} s`}</strong><span>Latencia p95</span><strong>{runtime?.p95OrderJobLatencyMs == null ? 'Sin datos' : `${runtime.p95OrderJobLatencyMs} ms`}</strong><span>Fallidos</span><strong>{runtime?.failedJobs ?? 0}</strong><span>Oro por enviar</span><strong>{runtime?.goldOutboxPending ?? 0}</strong><span>Oro sin conexión</span><strong>{runtime?.goldOutboxUnrouted ?? 0}</strong><span>Oro fallido</span><strong>{runtime?.goldOutboxFailed ?? 0}{canWrite && Boolean(runtime?.goldOutboxFailed) && <button className={styles.inlineIcon} title="Reintentar señales de Oro 30m" disabled={busy} onClick={retryGoldOutbox}><RefreshCw size={13} /></button>}</strong><span>Demo</span><strong>{runtime?.executionEnabled ? 'Habilitada' : 'Bloqueada'}</strong><span>Real</span><strong>{runtime?.liveExecutionEnabled ? 'Habilitada' : 'Bloqueada'}</strong><span>Ruta antigua</span><strong>{runtime?.legacyExecutionEnabled ? 'Habilitada' : 'Desactivada'}</strong></div>
        {loading && <div className={styles.notice}><LoaderCircle className={styles.spin} size={18} /> Cargando administración…</div>}
        {error && <p className={styles.error} role="alert">{error}</p>}

        {!loading && <section className={styles.tableSection}>
          <div className={styles.sectionHeading}><UserCheck size={18} /><h2>Accesos</h2></div>
          <div className={styles.tableWrap}><table><thead><tr><th>Usuario</th><th>Estado</th><th>Solicitud</th><th aria-label="Acciones" /></tr></thead><tbody>{memberships.map((membership) => <tr key={membership.userId}><td>{redactText(privacyMode, membership.email ?? membership.userId, 'Usuario oculto')}</td><td><span className={styles.status} data-status={membership.status}>{membership.status}</span></td><td>{new Date(membership.requestedAt).toLocaleString()}</td><td><div className={styles.actions}>{canWrite && membership.status !== 'ACTIVE' && <button className={styles.iconButton} title="Aprobar" disabled={busy} onClick={() => reviewMembership(membership.userId, 'ACTIVE')}><Check size={16} /></button>}{canWrite && membership.status === 'ACTIVE' && <button className={styles.iconButton} title="Suspender" disabled={busy} onClick={() => reviewMembership(membership.userId, 'SUSPENDED')}><ShieldX size={16} /></button>}{canRevoke && membership.status !== 'REVOKED' && <button className={styles.dangerIcon} title="Revocar" disabled={busy} onClick={() => reviewMembership(membership.userId, 'REVOKED')}><X size={16} /></button>}</div></td></tr>)}</tbody></table></div>
        </section>}

        {!loading && <section className={styles.tableSection}>
          <div className={styles.sectionHeading}><Shield size={18} /><h2>Conexiones</h2></div>
          {!connections.length ? <p className={styles.muted}>No hay conexiones para administrar.</p> : connections.map((connection) => <div className={styles.adminConnection} key={connection.id}>
            <div className={styles.connectionSummary}><div><strong>{connection.label}</strong><span>{redactText(privacyMode, connection.email ?? connection.userId, 'Usuario oculto')}</span></div><span>{BROKER_STRATEGIES[connection.requestedStrategy.code]?.label ?? connection.requestedStrategy.code}<small>{connection.requestedStrategy.symbol}</small></span><span className={styles.status} data-status={connection.status}>{connectionStatusLabel(connection.status)}</span><span>{connection.broker} · {connection.environment}</span></div>
            {connection.status === 'PENDING_APPROVAL' && canWrite && <ApprovalForm connection={connection} busy={busy} privacyMode={privacyMode} onDone={load} />}
            <div className={styles.commandRow}>{canWrite && <button disabled={busy} title="Editar nombre" className={styles.iconButton} onClick={() => editLabel(connection)}><Pencil size={16} /></button>}{canWrite && connection.status === 'PENDING_APPROVAL' && <button disabled={busy} className={styles.secondaryButton} onClick={() => connectionAction(connection.id, 'REJECT')}>Rechazar</button>}{canWrite && ['ACTIVE', 'SUSPENDED'].includes(connection.status) && <button disabled={busy} className={styles.secondaryButton} onClick={() => connectionAction(connection.id, 'PREPARE_EDIT')}><Settings2 size={16} /> Editar límites</button>}{canWrite && connection.status === 'ACTIVE' && <button disabled={busy} className={styles.secondaryButton} onClick={() => connectionAction(connection.id, 'SUSPEND')}>Suspender</button>}{canWrite && connection.status === 'SUSPENDED' && <button disabled={busy} className={styles.secondaryButton} onClick={() => connectionAction(connection.id, 'RESUME')}>Revalidar sin cambios</button>}{canRevoke && connection.status === 'MANUAL_INTERVENTION_REQUIRED' && <button disabled={busy} className={styles.secondaryButton} onClick={() => connectionAction(connection.id, 'CONFIRM_MANUAL_RESOLUTION')}>Confirmar posición resuelta</button>}{canRevoke && !['REVOKED', 'DELETED', 'MANUAL_INTERVENTION_REQUIRED'].includes(connection.status) && <button disabled={busy} className={styles.dangerButton} onClick={() => connectionAction(connection.id, 'REVOKE')}>Revocar credencial</button>}{canRevoke && canDeleteConnection(connection.status) && <button disabled={busy} title="Eliminar conexión" className={styles.dangerIcon} onClick={() => connectionAction(connection.id, 'DELETE')}><Trash2 size={16} /></button>}</div>
          </div>)}
        </section>}
        {!loading && <BrokerOrderHistory history={orderHistory} showUser privacyMode={privacyMode} />}
      </div>
    </main>
  )
}
