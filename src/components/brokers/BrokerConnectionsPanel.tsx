'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Cable, KeyRound, LoaderCircle, Pause, Pencil, Plus, RefreshCw, RotateCcw, ShieldAlert, ShieldCheck, Trash2, XCircle } from 'lucide-react'
import { canDeleteConnection, connectionStatusLabel } from '@/lib/brokers/domain'
import type { BrokerConnectionDto, RiskProfile } from '@/lib/brokers/domain'
import { deriveRiskSuggestion } from '@/lib/brokers/risk-profiles'
import { BrokerBrand } from './BrokerBrand'
import { BrokerFieldLabel } from './BrokerFieldHelp'
import { BrokerThemeToggle, useBrokerTheme } from './BrokerThemeToggle'
import { BrokerOrderHistory } from './BrokerOrderHistory'
import { EMPTY_BROKER_ORDER_HISTORY, type BrokerOrderHistoryResponse } from '@/lib/brokers/order-history-types'
import { BrokerPrivacyToggle, BrokerSensitiveValue, redactText, useBrokerPrivacy } from './BrokerPrivacy'
import { BROKER_STRATEGIES } from '@/lib/brokers/strategies'
import styles from './brokers.module.css'

type Membership = { status: string; requested_at?: string } | null
type RiskEditDraft = {
  connectionId: string
  capitalUsd: number
  riskProfile: RiskProfile
  allocationPct: number
  compoundEnabled: boolean
}
async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.message || 'No se pudo completar la operación.')
  return body as T
}

export function BrokerConnectionsPanel({ email }: { email: string }) {
  const { theme, toggleTheme } = useBrokerTheme()
  const { privacyMode, togglePrivacyMode } = useBrokerPrivacy()
  const [membership, setMembership] = useState<Membership>(null)
  const [connections, setConnections] = useState<BrokerConnectionDto[]>([])
  const [orderHistory, setOrderHistory] = useState<BrokerOrderHistoryResponse>(EMPTY_BROKER_ORDER_HISTORY)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [environment, setEnvironment] = useState<'DEMO' | 'LIVE'>('DEMO')
  const [capitalUsd, setCapitalUsd] = useState(100)
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('CONSERVATIVE')
  const [allocationPct, setAllocationPct] = useState(5)
  const [compoundEnabled, setCompoundEnabled] = useState(false)
  const [riskEdit, setRiskEdit] = useState<RiskEditDraft | null>(null)
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
      const access = await api<{ membership: Membership }>('/api/broker-access')
      setMembership(access.membership)
      if (access.membership) {
        const [data, orderData] = await Promise.all([
          api<{ connections: BrokerConnectionDto[]; executionMode: 'APP_SERVERLESS' }>('/api/broker-connections'),
          api<BrokerOrderHistoryResponse>('/api/broker-orders'),
        ])
        setConnections(data.connections)
        setOrderHistory(orderData)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cargar la sección.')
    } finally {
      loadInFlight.current = false
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const connectionIsValidating = connections.some((connection) => connection.status === 'PENDING_VALIDATION')
  useEffect(() => {
    const interval = window.setInterval(
      () => void load(true),
      connectionIsValidating ? 1_500 : 10_000,
    )
    return () => window.clearInterval(interval)
  }, [connectionIsValidating, load])

  async function requestAccess() {
    setSubmitting(true)
    try { await api('/api/broker-access', { method: 'POST', body: '{}' }); await load() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo solicitar acceso.') }
    finally { setSubmitting(false) }
  }

  async function createConnection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await api('/api/broker-connections', {
        method: 'POST',
        body: JSON.stringify({
          broker: form.get('broker'), environment: form.get('environment'), label: form.get('label'),
          strategyCode: form.get('strategyCode'),
          capitalUsd: Number(form.get('capitalUsd')), riskProfile: form.get('riskProfile'),
          sizingMode: compoundEnabled ? 'EQUITY_PERCENT' : 'FIXED_NOTIONAL', allocationPct,
          apiKey: form.get('apiKey'), secretKey: form.get('secretKey'), ipRestrictionConfirmed: false,
          permissions: { read: true, perpetualTrading: true, spot: false, withdrawal: false, universalTransfer: false, subaccounts: false, p2p: false },
        }),
      })
      event.currentTarget.reset()
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear la conexión.') }
    finally { setSubmitting(false) }
  }

  async function rotateCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      await api(`/api/broker-connections/${form.get('connectionId')}/rotate`, {
        method: 'POST',
        body: JSON.stringify({ apiKey: form.get('apiKey'), secretKey: form.get('secretKey') }),
      })
      event.currentTarget.reset()
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudieron cambiar las credenciales.') }
    finally { setSubmitting(false) }
  }

  async function requestRiskChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting || !riskEdit) return
    setSubmitting(true)
    setError('')
    try {
      await api(`/api/broker-connections/${riskEdit.connectionId}/risk`, {
        method: 'POST',
        body: JSON.stringify({
          capitalUsd: riskEdit.capitalUsd,
          riskProfile: riskEdit.riskProfile,
          sizingMode: riskEdit.compoundEnabled ? 'EQUITY_PERCENT' : 'FIXED_NOTIONAL',
          allocationPct: riskEdit.allocationPct,
        }),
      })
      setRiskEdit(null)
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo solicitar el cambio de riesgo.') }
    finally { setSubmitting(false) }
  }

  const suggestion = deriveRiskSuggestion(capitalUsd, riskProfile, allocationPct)

  function editRisk(connection: BrokerConnectionDto) {
    if (!connection.riskPolicy) return
    setError('')
    setRiskEdit({
      connectionId: connection.id,
      capitalUsd: connection.riskPolicy.declaredCapitalUsd,
      riskProfile: connection.riskPolicy.riskProfile,
      allocationPct: connection.riskPolicy.exposurePerOrderPct,
      compoundEnabled: connection.riskPolicy.sizingMode === 'EQUITY_PERCENT',
    })
    window.setTimeout(() => document.getElementById('editar-capital')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0)
  }

  async function action(id: string, value: 'SUSPEND' | 'REVOKE' | 'DELETE' | 'REVALIDATE') {
    if (actionInFlight.current) return
    if (value === 'REVOKE' && !window.confirm('Revocar elimina la credencial guardada en GONOVI. No cierra posiciones abiertas en BingX. ¿Continuar?')) return
    if (value === 'DELETE' && !window.confirm('La conexión desaparecerá del panel y sus credenciales se eliminarán definitivamente. ¿Continuar?')) return
    actionInFlight.current = true
    setSubmitting(true)
    setError('')
    try {
      const url = value === 'REVALIDATE' ? `/api/broker-connections/${id}/revalidate` : `/api/broker-connections/${id}`
      await api(url, value === 'DELETE' ? { method: 'DELETE' } : value === 'REVALIDATE' ? { method: 'POST', body: '{}' } : { method: 'PATCH', body: JSON.stringify({ action: value }) })
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo completar la acción.') }
    finally { actionInFlight.current = false; setSubmitting(false) }
  }

  return (
    <main className={styles.page} data-theme={theme}>
      <header className={styles.topbar}><BrokerBrand /><nav><Link href="/account">Cuenta</Link><BrokerPrivacyToggle active={privacyMode} onToggle={togglePrivacyMode} /><BrokerThemeToggle theme={theme} onToggle={toggleTheme} /><span className={styles.identity}>{redactText(privacyMode, email, 'Email oculto')}</span></nav></header>
      <div className={styles.content}>
        <div className={styles.titleRow}><Cable size={24} /><div><h1>Conexiones de broker</h1><p>Credenciales, validación y límites operativos.</p></div></div>
        {loading && <div className={styles.notice}><LoaderCircle className={styles.spin} size={18} /> Cargando conexiones…</div>}
        {error && <p className={styles.error} role="alert">{error}</p>}

        {!loading && !membership && <section className={styles.empty}><ShieldAlert size={22} /><h2>Acceso privado</h2><p>Un administrador debe aprobar tu cuenta antes de conectar APIs.</p><button className={styles.primaryButton} disabled={submitting} onClick={requestAccess}>Solicitar acceso</button></section>}
        {!loading && membership?.status !== 'ACTIVE' && membership && <section className={styles.empty}><h2>Solicitud {membership.status.toLowerCase()}</h2><p>No se pueden cargar credenciales hasta que el acceso esté activo.</p></section>}

        {membership?.status === 'ACTIVE' && (
          <>
            <section className={styles.section}>
              <div className={styles.sectionHeading}><Plus size={18} /><h2>Nueva conexión</h2></div>
              <form className={styles.formGrid} onSubmit={createConnection} autoComplete="off">
                <label className={styles.field}>
                  <BrokerFieldLabel label="Broker" tooltip="Plataforma donde se ejecutarán las órdenes de esta conexión." example="Ejemplo: BingX." />
                  <select name="broker" defaultValue="BINGX"><option value="BINGX">BingX</option><option value="BINANCE" disabled>Binance (próximamente)</option></select>
                </label>
                <label className={styles.field}>
                  <BrokerFieldLabel label="Entorno" tooltip="Demo usa fondos simulados de BingX. Real opera con fondos reales de esa API." example="Ejemplo: elegí Demo para la primera prueba." />
                  <select name="environment" value={environment} onChange={(event) => setEnvironment(event.target.value as 'DEMO' | 'LIVE')}><option value="DEMO">Demo · fondos simulados de BingX</option><option value="LIVE">Real · fondos reales</option></select>
                </label>
                <label className={styles.field}>
                  <BrokerFieldLabel label="Estrategia" tooltip="Cada conexión queda vinculada a una sola estrategia, con lotaje, órdenes y estadísticas independientes." example="Ejemplo: creá una API para BTC 1H y otra API distinta para Oro 30m." />
                  <select name="strategyCode" defaultValue="ALGOTREND_BTC_1H"><option value="ALGOTREND_BTC_1H">{BROKER_STRATEGIES.ALGOTREND_BTC_1H.label}</option><option value="ALGOTREND_GOLD_30M">{BROKER_STRATEGIES.ALGOTREND_GOLD_30M.label}</option></select>
                </label>
                <label className={styles.field}>
                  <BrokerFieldLabel label="Nombre" tooltip="Identificador interno para reconocer esta cuenta. No modifica el nombre en el broker." example="Ejemplo: BTC principal 1H." />
                  <input name="label" required maxLength={80} placeholder="BTC principal 1H" />
                </label>
                <label className={`${styles.field} ${privacyMode ? styles.sensitiveInput : ''}`}>
                  <BrokerFieldLabel label="Capital máximo autorizado (USD)" tooltip="Límite de capital que autorizás para esta estrategia. No deposita, transfiere ni crea fondos; el saldo siempre permanece en BingX." example="Ejemplo: si tu cuenta tiene 1.000 USD y autorizás 300, el bot calcula sus límites sobre un máximo de 300 USD." />
                  <input name="capitalUsd" required type="number" min="100" max="10000000" step="0.01" placeholder="1000" value={capitalUsd} onChange={(event) => setCapitalUsd(Number(event.target.value) || 0)} />
                </label>
                <div className={`${styles.capitalScope} ${styles.fullWidth}`}>
                  <ShieldCheck size={18} />
                  <div><strong>{environment === 'DEMO' ? 'Capital Demo' : 'Capital real'}</strong><span>{environment === 'DEMO' ? 'BingX aporta el saldo simulado. Este importe sólo limita cuánto puede gestionar el bot.' : 'Se usan los fondos disponibles en Futuros Perpetuos. El bot comprueba el saldo real antes de cada orden y nunca transfiere fondos.'}</span></div>
                </div>
                <div className={`${styles.field} ${styles.fullWidth}`}>
                  <BrokerFieldLabel label="Interés compuesto" tooltip="Apagado mantiene el tamaño base aprobado. Encendido permite que el motor recalcule cada entrada con el resultado neto de esta conexión, sin superar el saldo real ni los límites de protección." example="Ejemplo: cada estrategia compone únicamente sus propios resultados y comisiones." />
                  <label className={styles.toggleRow}>
                    <input type="checkbox" checked={compoundEnabled} onChange={(event) => setCompoundEnabled(event.target.checked)} />
                    <span className={styles.toggleTrack} aria-hidden="true"><span /></span>
                    <strong>{compoundEnabled ? 'Activado' : 'Desactivado'}</strong>
                  </label>
                </div>
                <details className={`${styles.advancedRisk} ${styles.fullWidth}`}>
                  <summary>Ajustes avanzados de protección <span>Opcional</span></summary>
                  <div className={styles.advancedRiskGrid}>
                    <label className={styles.field}>
                      <BrokerFieldLabel label="Nivel de protección" tooltip="Configura automáticamente reserva de margen, exposición total y límite de pérdida diaria." example="Conservador es la opción recomendada." />
                      <select name="riskProfile" value={riskProfile} onChange={(event) => {
                        const nextProfile = event.target.value as RiskProfile
                        setRiskProfile(nextProfile)
                        setAllocationPct(deriveRiskSuggestion(Math.max(capitalUsd, 100), nextProfile).exposurePerOrderPct)
                      }}><option value="ULTRA_CONSERVATIVE">Muy conservador</option><option value="CONSERVATIVE">Conservador (recomendado)</option><option value="MODERATE">Moderado</option></select>
                    </label>
                    <label className={styles.field}>
                      <BrokerFieldLabel label="Tope por operación (%)" tooltip="Límite máximo de capital para dimensionar una entrada. No es un objetivo de ganancia ni una pérdida programada." example="Ejemplo: 5% de 1.000 USD limita la posición base a 50 USD." />
                      <input name="allocationPct" required type="number" min="1" max="20" step="0.1" placeholder="5" value={allocationPct} onChange={(event) => setAllocationPct(Number(event.target.value) || 0)} />
                    </label>
                  </div>
                </details>
                <label className={styles.field}>
                  <BrokerFieldLabel label="API key" tooltip="Clave pública de la API correspondiente al entorno elegido." example="Ejemplo: pegá la API creada en BingX Demo o Real." />
                  <input name="apiKey" required type="password" minLength={16} placeholder="API key de BingX" />
                </label>
                <label className={styles.field}>
                  <BrokerFieldLabel label="Secret key" tooltip="Se cifra antes de guardarse y no vuelve a mostrarse. Nunca uses una clave con permiso de retiro." example="Ejemplo: secret de la misma API seleccionada." />
                  <input name="secretKey" required type="password" minLength={16} placeholder="Secret key de BingX" />
                </label>
                <div className={styles.fullWidth}>
                  <p className={styles.automaticRisk}><ShieldCheck size={16} /> El motor calcula el lotaje automáticamente. No necesitás estimar movimientos, comisiones ni ganancias objetivo.</p>
                  <div className={styles.metrics}><span>Tope base por orden <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{suggestion.suggestedNotionalPerOrderUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Exposición total máxima <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{suggestion.suggestedMaxTotalExposureUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Corte de pérdida diaria <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{suggestion.suggestedDailyLossLimitUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Margen protegido <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{suggestion.suggestedMinAvailableMarginUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span></div>
                  <p className={styles.permissionText}><KeyRound size={16} /> Permitido: lectura y futuros perpetuos. Prohibido: Spot, retiros, transferencias, subcuentas y P2P.</p>
                  <BrokerFieldLabel label="Confirmación de permisos" tooltip="Esta confirmación debe coincidir con los permisos reales de la API. GONOVI no necesita retiros ni transferencias." example="Ejemplo: sólo Leer y Trading con Futuros Perpetuos." />
                  <label className={styles.check}><input type="checkbox" required /><span>Confirmo que la clave sólo permite lectura y trading de futuros perpetuos.</span></label>
                </div>
                <button className={styles.primaryButton} disabled={submitting || capitalUsd < 100} type="submit">Conectar y validar</button>
              </form>
            </section>
            {riskEdit && (() => {
              const connection = connections.find((item) => item.id === riskEdit.connectionId)
              const editSuggestion = deriveRiskSuggestion(riskEdit.capitalUsd, riskEdit.riskProfile, riskEdit.allocationPct)
              if (!connection) return null
              return <section className={styles.section} id="editar-capital">
                <div className={styles.sectionHeading}><Pencil size={18} /><h2>Editar capital de {connection.label}</h2></div>
                <div className={styles.capitalScope}><ShieldCheck size={18} /><div><strong>Misma conexión, nuevos límites</strong><span>{BROKER_STRATEGIES[connection.requestedStrategy.code]?.label ?? connection.requestedStrategy.code} · {connection.environment}. La API, la estrategia y el historial no cambian. Al guardar se pausan nuevas aperturas; si hay una posición abierta, el capital no cambia y sus cierres siguen habilitados.</span></div></div>
                <form className={styles.formGrid} onSubmit={requestRiskChange}>
                  <label className={`${styles.field} ${privacyMode ? styles.sensitiveInput : ''}`}><BrokerFieldLabel label="Capital máximo autorizado (USD)" tooltip="Nuevo límite de capital para esta conexión. No transfiere fondos ni crea otra conexión." example={`Actual: ${connection.riskPolicy?.declaredCapitalUsd.toFixed(2) ?? '0.00'} USD.`} /><input type="number" min="100" max="10000000" step="0.01" value={riskEdit.capitalUsd} onChange={(event) => setRiskEdit((current) => current ? { ...current, capitalUsd: Number(event.target.value) || 0 } : current)} required /></label>
                  <div className={styles.field}><BrokerFieldLabel label="Interés compuesto" tooltip="Se mantiene aislado en esta conexión. Encendido recalcula futuras entradas con su resultado neto reconciliado." example="No mezcla resultados de BTC con Oro ni de otros usuarios." /><label className={styles.toggleRow}><input type="checkbox" checked={riskEdit.compoundEnabled} onChange={(event) => setRiskEdit((current) => current ? { ...current, compoundEnabled: event.target.checked } : current)} /><span className={styles.toggleTrack} aria-hidden="true"><span /></span><strong>{riskEdit.compoundEnabled ? 'Activado' : 'Desactivado'}</strong></label></div>
                  <details className={`${styles.advancedRisk} ${styles.fullWidth}`}>
                    <summary>Ajustes avanzados de protección <span>Opcional</span></summary>
                    <div className={styles.advancedRiskGrid}>
                      <label className={styles.field}><BrokerFieldLabel label="Nivel de protección" tooltip="Recalcula automáticamente reserva de margen, exposición total y corte diario." example="Conservador es la opción recomendada." /><select value={riskEdit.riskProfile} onChange={(event) => {
                        const nextProfile = event.target.value as RiskProfile
                        setRiskEdit((current) => current ? { ...current, riskProfile: nextProfile, allocationPct: deriveRiskSuggestion(Math.max(current.capitalUsd, 100), nextProfile).exposurePerOrderPct } : current)
                      }}><option value="ULTRA_CONSERVATIVE">Muy conservador</option><option value="CONSERVATIVE">Conservador (recomendado)</option><option value="MODERATE">Moderado</option></select></label>
                      <label className={styles.field}><BrokerFieldLabel label="Tope por operación (%)" tooltip="Límite máximo para dimensionar futuras aperturas. No modifica una posición ya abierta." example="Ejemplo: 5% del capital autorizado." /><input type="number" min="1" max="20" step="0.1" value={riskEdit.allocationPct} onChange={(event) => setRiskEdit((current) => current ? { ...current, allocationPct: Number(event.target.value) || 0 } : current)} required /></label>
                    </div>
                  </details>
                  <div className={`${styles.metrics} ${styles.fullWidth}`}><span>Tope base por orden <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{editSuggestion.suggestedNotionalPerOrderUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Exposición total máxima <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{editSuggestion.suggestedMaxTotalExposureUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Corte de pérdida diaria <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{editSuggestion.suggestedDailyLossLimitUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Margen protegido <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{editSuggestion.suggestedMinAvailableMarginUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span></div>
                  <div className={`${styles.commandRow} ${styles.fullWidth}`}><button className={styles.primaryButton} disabled={submitting || riskEdit.capitalUsd < 100} type="submit">Enviar cambio a aprobación</button><button className={styles.secondaryButton} disabled={submitting} type="button" onClick={() => setRiskEdit(null)}>Cancelar</button></div>
                </form>
              </section>
            })()}
            {connections.some((connection) => connection.status === 'SUSPENDED') && <section className={styles.section}>
              <div className={styles.sectionHeading}><RotateCcw size={18} /><h2>Editar conexión suspendida</h2></div>
              <h3 className={styles.subsectionHeading}>Cambiar credenciales</h3>
              <form className={styles.formGrid} onSubmit={rotateCredentials} autoComplete="off">
                <label className={styles.field}><BrokerFieldLabel label="Conexión" tooltip="La rotación sólo se permite con la conexión suspendida, sin posiciones ni órdenes pendientes." example="Ejemplo: Oro 30m principal." /><select name="connectionId" required>{connections.filter((connection) => connection.status === 'SUSPENDED').map((connection) => <option value={connection.id} key={connection.id}>{connection.label} · {BROKER_STRATEGIES[connection.requestedStrategy.code]?.label ?? connection.requestedStrategy.code}</option>)}</select></label>
                <label className={styles.field}><BrokerFieldLabel label="Nueva API key" tooltip="Reemplaza la clave cifrada anterior. El administrador nunca puede verla ni ingresarla por vos." example="Ejemplo: nueva API exclusiva de esta estrategia." /><input name="apiKey" required type="password" minLength={16} placeholder="Nueva API key de BingX" /></label>
                <label className={styles.field}><BrokerFieldLabel label="Nueva Secret key" tooltip="Debe pertenecer a la misma API y tener sólo lectura y futuros perpetuos." example="Ejemplo: secret de la API nueva." /><input name="secretKey" required type="password" minLength={16} placeholder="Nueva Secret key de BingX" /></label>
                <button className={styles.primaryButton} disabled={submitting} type="submit">Cambiar y revalidar</button>
              </form>
            </section>}

            <section className={styles.tableSection}>
              <div className={styles.sectionHeading}><Cable size={18} /><h2>Conexiones</h2><button className={styles.iconButton} title="Actualizar" disabled={loading || submitting} onClick={() => void load()}><RefreshCw size={17} /></button></div>
              {!connections.length ? <p className={styles.muted}>No hay conexiones registradas.</p> : <div className={styles.tableWrap}><table><thead><tr><th>Nombre</th><th>Estrategia</th><th>Broker</th><th>Entorno</th><th>Estado</th><th>Capital autorizado</th><th>Riesgo</th><th aria-label="Acciones" /></tr></thead><tbody>{connections.map((connection) => <tr key={connection.id}><td>{connection.label}</td><td>{BROKER_STRATEGIES[connection.requestedStrategy.code]?.label ?? connection.requestedStrategy.code}<small>{connection.requestedStrategy.symbol} · {connection.requestedStrategy.timeframe}</small></td><td>{connection.broker}</td><td>{connection.environment}</td><td><span className={styles.status} data-status={connection.status} title={connection.status === 'MANUAL_INTERVENTION_REQUIRED' ? 'Verificá las posiciones directamente en BingX y pedí al administrador confirmar la resolución.' : undefined}>{connectionStatusLabel(connection.status)}</span></td><td><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{connection.riskPolicy ? `$${connection.riskPolicy.declaredCapitalUsd.toFixed(2)}` : '—'}</BrokerSensitiveValue></td><td>{connection.riskPolicy?.enabled ? connection.riskPolicy.sizingMode === 'EQUITY_PERCENT' ? `Compuesto ${connection.riskPolicy.exposurePerOrderPct}% · ${connection.riskPolicy.maxLeverage}x` : <><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{`$${connection.riskPolicy.fixedNotionalUsd}`}</BrokerSensitiveValue> · {connection.riskPolicy.maxLeverage}x</> : connection.riskPolicy ? <><span>Sugerido </span><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{`$${connection.riskPolicy.suggestedNotionalPerOrderUsd}`}</BrokerSensitiveValue></> : 'Desactivado'}</td><td><div className={styles.actions}>{connection.riskPolicy && ['ACTIVE', 'SUSPENDED'].includes(connection.status) && <button title="Editar capital" disabled={submitting} className={styles.iconButton} onClick={() => editRisk(connection)}><Pencil size={16} /></button>}{connection.status === 'VALIDATION_FAILED' && <button title="Revalidar" disabled={submitting} className={styles.iconButton} onClick={() => action(connection.id, 'REVALIDATE')}><RefreshCw size={16} /></button>}{connection.status === 'ACTIVE' && <button title="Suspender" disabled={submitting} className={styles.iconButton} onClick={() => action(connection.id, 'SUSPEND')}><Pause size={16} /></button>}{!['REVOKED', 'DELETED', 'MANUAL_INTERVENTION_REQUIRED'].includes(connection.status) && <button title="Revocar" disabled={submitting} className={styles.dangerIcon} onClick={() => action(connection.id, 'REVOKE')}><XCircle size={16} /></button>}{canDeleteConnection(connection.status) && <button title="Eliminar" disabled={submitting} className={styles.dangerIcon} onClick={() => action(connection.id, 'DELETE')}><Trash2 size={16} /></button>}</div></td></tr>)}</tbody></table></div>}
            </section>
            <BrokerOrderHistory history={orderHistory} privacyMode={privacyMode} />
          </>
        )}
      </div>
    </main>
  )
}
