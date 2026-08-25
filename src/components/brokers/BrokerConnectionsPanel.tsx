'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Cable, CircleDollarSign, KeyRound, LoaderCircle, Pause, Pencil, Plus, RefreshCw, RotateCcw, ShieldAlert, ShieldCheck, Trash2, XCircle } from 'lucide-react'
import { canDeleteConnection, connectionStatusLabel } from '@/lib/brokers/domain'
import type { BrokerConnectionDto, RiskPolicy, RiskProfile } from '@/lib/brokers/domain'
import { DEFAULT_BROKER_ALLOCATION_PCT, deriveRiskSuggestion } from '@/lib/brokers/risk-profiles'
import { requiredMaxExposureUsd, withCoherentExposure } from '@/lib/brokers/risk-draft'
import { BrokerBrand } from './BrokerBrand'
import { BrokerFieldLabel } from './BrokerFieldHelp'
import { BrokerThemeToggle, useBrokerTheme } from './BrokerThemeToggle'
import { BrokerOrderHistory } from './BrokerOrderHistory'
import { EMPTY_BROKER_ORDER_HISTORY, type BrokerOrderHistoryResponse } from '@/lib/brokers/order-history-types'
import { BrokerPrivacyToggle, BrokerSensitiveValue, redactText, useBrokerPrivacy } from './BrokerPrivacy'
import { BROKER_STRATEGIES } from '@/lib/brokers/strategies'
import { calculateOpeningFundingRequirement, DEFAULT_BINGX_TAKER_FEE_RATE } from '@/lib/brokers/funding-requirement'
import styles from './brokers.module.css'

type Membership = { status: string; requested_at?: string } | null
type RiskEditDraft = {
  connectionId: string
  capitalUsd: number
  riskProfile: RiskProfile
  allocationPct: number
  compoundEnabled: boolean
  fixedNotionalUsd: number
  dailyLossLimitUsd: number
  maxTotalExposureUsd: number
  marginReservePct: number
  maxOpenPositions: number
  maxOrdersPerMinute: number
  maxLeverage: number
}

type FundingRequirement = {
  connectionId: string
  sizingMode: 'FIXED_NOTIONAL' | 'EQUITY_PERCENT'
  targetNotionalUsd: number
  leverage: number
  takerFeeRate: number
  availableMarginUsd: number
  orderMarginUsd: number
  openingFeeUsd: number
  reserveUsd: number
  requiredAvailableMarginUsd: number
}

function fundingEstimate(policy: RiskPolicy, takerFeeRate = DEFAULT_BINGX_TAKER_FEE_RATE) {
  const targetNotionalUsd = policy.sizingMode === 'EQUITY_PERCENT'
    ? policy.declaredCapitalUsd * policy.exposurePerOrderPct / 100
    : policy.fixedNotionalUsd
  const reserveUsd = policy.sizingMode === 'EQUITY_PERCENT'
    ? policy.declaredCapitalUsd * policy.marginReservePct / 100
    : policy.minAvailableMarginUsd
  return {
    targetNotionalUsd,
    takerFeeRate,
    ...calculateOpeningFundingRequirement({
      notionalUsd: targetNotionalUsd,
      leverage: policy.maxLeverage,
      reserveUsd,
      takerFeeRate,
    }),
  }
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
  const [fundingRequirements, setFundingRequirements] = useState<Record<string, FundingRequirement>>({})
  const [orderHistory, setOrderHistory] = useState<BrokerOrderHistoryResponse>(EMPTY_BROKER_ORDER_HISTORY)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [retryingIntentId, setRetryingIntentId] = useState<string | null>(null)
  const [environment, setEnvironment] = useState<'DEMO' | 'LIVE'>('DEMO')
  const [capitalUsd, setCapitalUsd] = useState(100)
  const [riskProfile, setRiskProfile] = useState<RiskProfile>('CONSERVATIVE')
  const [allocationPct, setAllocationPct] = useState(DEFAULT_BROKER_ALLOCATION_PCT)
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
        const requirementEntries = await Promise.all(data.connections
          .filter((connection) => connection.riskPolicy?.enabled)
          .map(async (connection) => {
            try {
              const requirement = await api<FundingRequirement>(`/api/broker-connections/${connection.id}/funding-requirement`)
              return [connection.id, requirement] as const
            } catch {
              return null
            }
          }))
        setFundingRequirements(Object.fromEntries(requirementEntries.filter((entry) => entry != null)))
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
          fixedNotionalUsd: riskEdit.fixedNotionalUsd,
          dailyLossLimitUsd: riskEdit.dailyLossLimitUsd,
          maxTotalExposureUsd: riskEdit.maxTotalExposureUsd,
          marginReservePct: riskEdit.marginReservePct,
          maxOpenPositions: riskEdit.maxOpenPositions,
          maxOrdersPerMinute: riskEdit.maxOrdersPerMinute,
          maxLeverage: riskEdit.maxLeverage,
        }),
      })
      setRiskEdit(null)
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo solicitar el cambio de riesgo.') }
    finally { setSubmitting(false) }
  }

  async function retryMissedOpen(intentId: string) {
    if (retryingIntentId) return
    setRetryingIntentId(intentId)
    setError('')
    try {
      await api(`/api/broker-orders/${intentId}/retry`, { method: 'POST', body: '{}' })
      await load(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo reenviar la operación.')
    } finally {
      setRetryingIntentId(null)
    }
  }

  const suggestion = deriveRiskSuggestion(capitalUsd, riskProfile, allocationPct)
  const newConnectionFunding = calculateOpeningFundingRequirement({
    notionalUsd: suggestion.suggestedNotionalPerOrderUsd,
    leverage: 1,
    reserveUsd: suggestion.suggestedMinAvailableMarginUsd,
    takerFeeRate: DEFAULT_BINGX_TAKER_FEE_RATE,
  })

  function editRisk(connection: BrokerConnectionDto) {
    if (!connection.riskPolicy) return
    setError('')
    setRiskEdit(withCoherentExposure({
      connectionId: connection.id,
      capitalUsd: connection.riskPolicy.declaredCapitalUsd,
      riskProfile: connection.riskPolicy.riskProfile,
      allocationPct: connection.riskPolicy.exposurePerOrderPct,
      compoundEnabled: connection.riskPolicy.sizingMode === 'EQUITY_PERCENT',
      fixedNotionalUsd: connection.riskPolicy.fixedNotionalUsd || connection.riskPolicy.suggestedNotionalPerOrderUsd || 10,
      dailyLossLimitUsd: connection.riskPolicy.dailyLossLimitUsd || connection.riskPolicy.suggestedDailyLossLimitUsd || 10,
      maxTotalExposureUsd: connection.riskPolicy.maxTotalExposureUsd || connection.riskPolicy.suggestedMaxTotalExposureUsd || 10,
      marginReservePct: Math.min(10, Math.max(0, connection.riskPolicy.marginReservePct)),
      maxOpenPositions: connection.riskPolicy.maxOpenPositions || 1,
      maxOrdersPerMinute: connection.riskPolicy.maxOrdersPerMinute || 2,
      maxLeverage: connection.riskPolicy.maxLeverage || 1,
    }))
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
                      <select name="riskProfile" value={riskProfile} onChange={(event) => setRiskProfile(event.target.value as RiskProfile)}><option value="ULTRA_CONSERVATIVE">Muy conservador</option><option value="CONSERVATIVE">Conservador (recomendado)</option><option value="MODERATE">Moderado</option></select>
                    </label>
                    <label className={styles.field}>
                      <BrokerFieldLabel label="Tope por operación (%)" tooltip="Límite máximo de capital para dimensionar una entrada. No es un objetivo de ganancia ni una pérdida programada." example="Ejemplo: 100% de 1.000 USD limita la posición base a 1.000 USD." />
                      <input name="allocationPct" required type="number" min="1" max="100" step="0.1" placeholder="100" value={allocationPct} onChange={(event) => setAllocationPct(Number(event.target.value) || 0)} />
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
                  <div className={styles.metrics}><span>Capital objetivo por entrada <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{suggestion.suggestedNotionalPerOrderUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Saldo libre mínimo <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{newConnectionFunding.requiredAvailableMarginUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Comisión de apertura cubierta <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{newConnectionFunding.openingFeeUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Exposición total máxima <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{suggestion.suggestedMaxTotalExposureUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Corte de pérdida diaria <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{suggestion.suggestedDailyLossLimitUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Margen protegido <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{suggestion.suggestedMinAvailableMarginUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span></div>
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
              // Con interés compuesto el motor dimensiona por porcentaje del equity real y NO usa
              // el lotaje ni la pérdida en USD: el resumen debe mostrar lo que se va a ejecutar.
              const effectiveNotionalUsd = riskEdit.compoundEnabled ? editSuggestion.suggestedNotionalPerOrderUsd : riskEdit.fixedNotionalUsd
              const effectiveDailyLossUsd = riskEdit.compoundEnabled ? editSuggestion.suggestedDailyLossLimitUsd : riskEdit.dailyLossLimitUsd
              const effectiveMaxExposureUsd = riskEdit.maxTotalExposureUsd
              const effectiveMarginUsd = Math.floor(riskEdit.capitalUsd * riskEdit.marginReservePct) / 100
              // La exposición total por debajo del lotaje deja la propuesta inconsistente: el
              // servidor la rechaza y el motor tampoco podría abrir. Se acompaña sola al lotaje,
              // así que sólo puede quedar corta si el titular la bajó a mano en los avanzados.
              const exposicionRequeridaUsd = requiredMaxExposureUsd(riskEdit)
              // Bloquea sólo lo mismo que rechaza el servidor: exposición por debajo de UNA orden.
              // Cubrir menos posiciones que el máximo simultáneo es una decisión válida del titular.
              const exposicionInsuficiente = effectiveMaxExposureUsd < effectiveNotionalUsd
              const posicionesQueEntran = effectiveNotionalUsd > 0 ? Math.floor(effectiveMaxExposureUsd / effectiveNotionalUsd) : 0
              const exposicionAcotaPosiciones = !exposicionInsuficiente && posicionesQueEntran < riskEdit.maxOpenPositions
              // Aviso de margen: para abrir hacen falta lotaje + reserva libres en el broker.
              const takerFeeRate = fundingRequirements[connection.id]?.takerFeeRate ?? DEFAULT_BINGX_TAKER_FEE_RATE
              const editFunding = calculateOpeningFundingRequirement({
                notionalUsd: effectiveNotionalUsd,
                leverage: riskEdit.maxLeverage,
                reserveUsd: effectiveMarginUsd,
                takerFeeRate,
              })
              // El único límite real es el margen que el titular tenga en el broker. Mostrarlo
              // junto al mínimo estricto evita configurar un lotaje que después no va a abrir.
              const availableMarginUsd = fundingRequirements[connection.id]?.availableMarginUsd
              const margenFaltanteUsd = typeof availableMarginUsd === 'number'
                ? Math.round((editFunding.requiredAvailableMarginUsd - availableMarginUsd) * 100) / 100
                : 0
              return <section className={styles.section} id="editar-capital">
                <div className={styles.sectionHeading}><Pencil size={18} /><h2>Editar capital y riesgo de {connection.label}</h2></div>
                <div className={styles.capitalScope}><ShieldCheck size={18} /><div><strong>Misma conexión, actualización directa</strong><span>{BROKER_STRATEGIES[connection.requestedStrategy.code]?.label ?? connection.requestedStrategy.code} · {connection.environment}. Las claves API permanecen guardadas de forma segura. Vos decidís capital, lotaje y pérdida máxima con el número que quieras, sin volver a ingresar credenciales ni pedir una segunda aprobación. El único límite real es el margen disponible en tu cuenta. El cambio se rechaza si hay órdenes en curso.</span></div></div>
                <form className={styles.formGrid} onSubmit={requestRiskChange}>
                  <label className={`${styles.field} ${privacyMode ? styles.sensitiveInput : ''}`}><BrokerFieldLabel label="Capital máximo autorizado (USD)" tooltip="Techo de capital que esta conexión puede usar de tu cuenta. No transfiere fondos ni modifica la API: sólo define sobre qué monto se calcula la reserva de margen." example={`Actual: ${connection.riskPolicy?.declaredCapitalUsd.toFixed(2) ?? '0.00'} USD.${typeof availableMarginUsd === 'number' ? ` Libre en ${connection.broker}: ${availableMarginUsd.toFixed(2)} USD.` : ''}`} /><input type="number" min="100" max="10000000" step="0.01" value={riskEdit.capitalUsd} onChange={(event) => setRiskEdit((current) => current ? withCoherentExposure({ ...current, capitalUsd: Number(event.target.value) || 0 }) : current)} required /></label>
                  <label className={`${styles.field} ${privacyMode ? styles.sensitiveInput : ''}`}><BrokerFieldLabel label="Capital fijo por entrada (USD)" tooltip="Importe exacto en USDT que se enviará por apertura. El motor ya no lo reduce según el saldo: si no alcanza para la entrada y la reserva, la orden se rechaza." example={`Este lotaje necesita ${editFunding.requiredAvailableMarginUsd.toFixed(2)} USD libres: margen, comisión y reserva.`} /><input type="number" min="1" max="10000000" step="0.01" value={riskEdit.fixedNotionalUsd} onChange={(event) => setRiskEdit((current) => current ? withCoherentExposure({ ...current, fixedNotionalUsd: Number(event.target.value) || 0 }) : current)} required /></label>
                  <label className={`${styles.field} ${privacyMode ? styles.sensitiveInput : ''}`}><BrokerFieldLabel label="Pérdida máxima diaria (USD)" tooltip="Corte de pérdida diaria en dólares. El número que quieras; no hay techo impuesto por la plataforma. Sólo aplica con interés compuesto apagado." example="Ejemplo: 20.00 USD." /><input type="number" min="1" max="10000000" step="0.01" value={riskEdit.dailyLossLimitUsd} onChange={(event) => setRiskEdit((current) => current ? { ...current, dailyLossLimitUsd: Number(event.target.value) || 0 } : current)} required /></label>
                  <div className={styles.field}><BrokerFieldLabel label="Interés compuesto" tooltip="Se mantiene aislado en esta conexión. Encendido recalcula futuras entradas con su resultado neto reconciliado." example="No mezcla resultados de BTC con Oro ni de otros usuarios." /><label className={styles.toggleRow}><input type="checkbox" checked={riskEdit.compoundEnabled} onChange={(event) => setRiskEdit((current) => current ? withCoherentExposure({ ...current, compoundEnabled: event.target.checked }) : current)} /><span className={styles.toggleTrack} aria-hidden="true"><span /></span><strong>{riskEdit.compoundEnabled ? 'Activado' : 'Desactivado'}</strong></label></div>
                  <details className={`${styles.advancedRisk} ${styles.fullWidth}`}>
                    <summary>Ajustes avanzados de perfil <span>Opcional</span></summary>
                    <div className={styles.advancedRiskGrid}>
                      <label className={styles.field}><BrokerFieldLabel label="Nivel de protección" tooltip="Perfil base de riesgo." example="Conservador es la opción recomendada." /><select value={riskEdit.riskProfile} onChange={(event) => setRiskEdit((current) => current ? withCoherentExposure({ ...current, riskProfile: event.target.value as RiskProfile }) : current)}><option value="ULTRA_CONSERVATIVE">Muy conservador</option><option value="CONSERVATIVE">Conservador (recomendado)</option><option value="MODERATE">Moderado</option></select></label>
                      <label className={styles.field}><BrokerFieldLabel label="Tope por operación (%)" tooltip="Límite porcentual opcional." example="Ejemplo: 100% del capital autorizado." /><input type="number" min="1" max="100" step="0.1" value={riskEdit.allocationPct} onChange={(event) => setRiskEdit((current) => current ? withCoherentExposure({ ...current, allocationPct: Number(event.target.value) || 0 }) : current)} required /></label>
                      <label className={`${styles.field} ${privacyMode ? styles.sensitiveInput : ''}`}><BrokerFieldLabel label="Exposición total máxima (USD)" tooltip="Suma máxima de todas tus posiciones abiertas a la vez. No puede ser menor que el lotaje por orden." example="Ejemplo: igual al lotaje si operás de a una posición." /><input type="number" min="1" max="10000000" step="0.01" value={riskEdit.maxTotalExposureUsd} onChange={(event) => setRiskEdit((current) => current ? { ...current, maxTotalExposureUsd: Number(event.target.value) || 0 } : current)} required /></label>
                      <label className={styles.field}><BrokerFieldLabel label="Reserva de margen (%)" tooltip="Porcentaje del capital que queda libre después de abrir. La regla general es 10% y nunca se puede reservar más que eso." example="Ejemplo: 10% deja 10 USD libres por cada 100 USD de capital." /><input type="number" min="0" max="10" step="0.1" value={riskEdit.marginReservePct} onChange={(event) => setRiskEdit((current) => current ? { ...current, marginReservePct: Number(event.target.value) || 0 } : current)} required /></label>
                      <label className={styles.field}><BrokerFieldLabel label="Posiciones simultáneas" tooltip="Cuántas posiciones propias puede tener abiertas esta conexión a la vez." example="Ejemplo: 1 para una sola posición por vez." /><input type="number" min="1" max="20" step="1" value={riskEdit.maxOpenPositions} onChange={(event) => setRiskEdit((current) => current ? withCoherentExposure({ ...current, maxOpenPositions: Number(event.target.value) || 1 }) : current)} required /></label>
                      <label className={styles.field}><BrokerFieldLabel label="Órdenes por minuto" tooltip="Freno contra ráfagas de señales repetidas. Un reverso necesita al menos 2: una para cerrar y otra para abrir." example="Ejemplo: 2 permite cerrar y abrir en la misma vela." /><input type="number" min="1" max="60" step="1" value={riskEdit.maxOrdersPerMinute} onChange={(event) => setRiskEdit((current) => current ? { ...current, maxOrdersPerMinute: Number(event.target.value) || 1 } : current)} required /></label>
                      <label className={styles.field}><BrokerFieldLabel label="Apalancamiento" tooltip="Multiplica exposición y riesgo. La plataforma impone su propio máximo global vía BROKER_MAX_ALLOWED_LEVERAGE, y el instrumento el suyo." example="Ejemplo: 1x sin apalancamiento." /><input type="number" min="1" max="20" step="1" value={riskEdit.maxLeverage} onChange={(event) => setRiskEdit((current) => current ? { ...current, maxLeverage: Number(event.target.value) || 1 } : current)} required /></label>
                    </div>
                  </details>
                  <div className={`${styles.metrics} ${styles.fullWidth}`}><span>{riskEdit.compoundEnabled ? 'Entrada estimada (compuesto)' : 'Capital fijo por entrada'} <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{effectiveNotionalUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Saldo libre mínimo <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{editFunding.requiredAvailableMarginUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span>{typeof availableMarginUsd === 'number' && <span>Saldo libre en {connection.broker} <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{availableMarginUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span>}<span>Comisión de apertura cubierta <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{editFunding.openingFeeUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Margen protegido <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{effectiveMarginUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Exposición total máxima <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{effectiveMaxExposureUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Corte de pérdida diaria <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{effectiveDailyLossUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span></div>
                  {riskEdit.compoundEnabled && <p className={styles.fullWidth}><small>Con interés compuesto activado el motor dimensiona cada entrada como <strong>{riskEdit.allocationPct}% del equity real</strong> de la cuenta; el lotaje y la pérdida en USD de arriba quedan como referencia y no se aplican. Apagá el compuesto para que el monto fijo mande.</small></p>}
                  {margenFaltanteUsd > 0 && <p className={`${styles.notice} ${styles.noticeWrap} ${styles.fullWidth}`} role="alert">Con este lotaje hacen falta <strong>{editFunding.requiredAvailableMarginUsd.toFixed(2)} USD libres</strong> y en {connection.broker} tenés <strong>{(availableMarginUsd ?? 0).toFixed(2)} USD</strong>: faltan {margenFaltanteUsd.toFixed(2)} USD. Podés guardarlo igual, pero hasta transferir margen o bajar el capital fijo por entrada la orden se va a rechazar por fondos.</p>}
                  {exposicionAcotaPosiciones && <p className={styles.fullWidth}><small>Tu exposición total ({effectiveMaxExposureUsd.toFixed(2)} USD) da para {posicionesQueEntran} {posicionesQueEntran === 1 ? 'posición abierta' : 'posiciones abiertas'} de {effectiveNotionalUsd.toFixed(2)} USD, aunque permitís {riskEdit.maxOpenPositions} simultáneas. Se guarda igual; si querés cubrirlas todas, subila a {exposicionRequeridaUsd.toFixed(2)} USD en Ajustes avanzados.</small></p>}
                  {exposicionInsuficiente && <p className={`${styles.notice} ${styles.noticeWrap} ${styles.fullWidth}`} role="alert">En <strong>Ajustes avanzados de perfil</strong> bajaste la exposición total a {effectiveMaxExposureUsd.toFixed(2)} USD y no alcanza ni para una entrada de {effectiveNotionalUsd.toFixed(2)} USD. <button className={styles.linkButton} type="button" onClick={() => setRiskEdit((current) => current ? { ...current, maxTotalExposureUsd: requiredMaxExposureUsd(current) } : current)}>Ajustar a {exposicionRequeridaUsd.toFixed(2)} USD</button></p>}
                  <p className={styles.fullWidth}><small>La reserva general es <strong>{riskEdit.marginReservePct}%</strong> ({effectiveMarginUsd.toFixed(2)} USD sobre el capital autorizado). El mínimo estricto es <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{editFunding.requiredAvailableMarginUsd.toFixed(2)} USD libres</BrokerSensitiveValue></strong>: incluye margen, comisión taker de apertura redondeada hacia arriba y reserva. El motor valida este mismo número y no reduce tu entrada.{typeof availableMarginUsd === 'number' && <> Tu saldo libre en {connection.broker} es de <strong>{availableMarginUsd.toFixed(2)} USD</strong>.</>}</small></p>
                  <div className={`${styles.commandRow} ${styles.fullWidth}`}><button className={styles.primaryButton} disabled={submitting || riskEdit.capitalUsd < 100 || exposicionInsuficiente} type="submit">Guardar cambios</button><button className={styles.secondaryButton} disabled={submitting} type="button" onClick={() => setRiskEdit(null)}>Cancelar</button></div>
                </form>
              </section>
            })()}
            {connections.some((connection) => connection.status === 'SUSPENDED') && <section className={styles.section}>
              <div className={styles.sectionHeading}><RotateCcw size={18} /><h2>Editar conexión suspendida</h2></div>
              <h3 className={styles.subsectionHeading}>Cambiar credenciales</h3>
              <form className={styles.formGrid} onSubmit={rotateCredentials} autoComplete="off">
                <label className={styles.field}><BrokerFieldLabel label="Conexión" tooltip="La rotación sólo se permite con la conexión suspendida, sin posiciones ni órdenes pendientes." example="Ejemplo: Oro 30m principal." /><select name="connectionId" required>{connections.filter((connection) => connection.status === 'SUSPENDED').map((connection) => <option value={connection.id} key={connection.id}>{connection.label} · {BROKER_STRATEGIES[connection.requestedStrategy.code]?.label ?? connection.requestedStrategy.code}</option>)}</select></label>
                <label className={styles.field}><BrokerFieldLabel label="Nueva API key" tooltip="Reemplaza la clave cifrada anterior. El administrador nunca puede verla ni ingresarla por vos." example="Ejemplo: nueva API exclusiva de esta estrategia." /><input name="apiKey" required type="password" minLength={16} placeholder="Nueva API key de BingX" /></label>
                <label className={styles.field}><BrokerFieldLabel label="Nueva Secret key" tooltip="Debe pertenecer a la misma API y tener sólo lectura y futuros perpetuos." example="Ejemplo: secret de la misma API seleccionada." /><input name="secretKey" required type="password" minLength={16} placeholder="Nueva Secret key de BingX" /></label>
                <button className={styles.primaryButton} disabled={submitting} type="submit">Cambiar y revalidar</button>
              </form>
            </section>}

            {connections.some((connection) => connection.riskPolicy?.enabled) && (
              <section className={styles.tableSection}>
                <div className={styles.sectionHeading}><CircleDollarSign size={18} /><h2>Capital previsto para la próxima entrada</h2></div>
                <p className={styles.notice}>El importe fijo se envía tal como está configurado. El mínimo destacado incluye margen, comisión taker real de tu cuenta redondeada hacia arriba y reserva.</p>
                <div className={styles.fundingEstimateGrid}>
                  {connections.filter((connection) => connection.riskPolicy?.enabled).map((connection) => {
                    const policy = connection.riskPolicy!
                    const liveRequirement = fundingRequirements[connection.id]
                    const estimate = liveRequirement ?? fundingEstimate(policy)
                    return <article className={styles.fundingEstimateCard} key={connection.id}>
                      <strong>{redactText(privacyMode, connection.label)}</strong>
                      <small>{BROKER_STRATEGIES[connection.requestedStrategy.code]?.label ?? connection.requestedStrategy.code} · {policy.maxLeverage}x</small>
                      <div className={styles.requiredCapitalBox}><span>Saldo libre mínimo para abrir</span><strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{estimate.requiredAvailableMarginUsd.toFixed(2)} USD</BrokerSensitiveValue></strong><small>Umbral estricto contra falta de fondos</small></div>
                      <div><span>{policy.sizingMode === 'EQUITY_PERCENT' ? 'Entrada estimada' : 'Capital fijo por entrada'}<strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{estimate.targetNotionalUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Margen de la orden<strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{estimate.orderMarginUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Comisión cubierta<strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{estimate.openingFeeUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Reserva protegida<strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{estimate.reserveUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span></div>
                      <small>Tasa taker usada: {(estimate.takerFeeRate * 100).toFixed(4)}% {liveRequirement ? '· consultada en BingX' : '· estimación conservadora'}</small>
                      {policy.sizingMode === 'EQUITY_PERCENT' && <small>El importe final varía con el equity porque el interés compuesto está activo.</small>}
                    </article>
                  })}
                </div>
              </section>
            )}

            <section className={styles.tableSection}>
              <div className={styles.sectionHeading}><Cable size={18} /><h2>Conexiones</h2><button className={styles.iconButton} title="Actualizar" disabled={loading || submitting} onClick={() => void load()}><RefreshCw size={17} /></button></div>
              {!connections.length ? <p className={styles.muted}>No hay conexiones registradas.</p> : <div className={styles.tableWrap}><table><thead><tr><th>Nombre</th><th>Estrategia</th><th>Broker</th><th>Entorno</th><th>Estado</th><th>Capital autorizado</th><th>Riesgo</th><th aria-label="Acciones" /></tr></thead><tbody>{connections.map((connection) => <tr key={connection.id}><td>{connection.label}</td><td>{BROKER_STRATEGIES[connection.requestedStrategy.code]?.label ?? connection.requestedStrategy.code}<small>{connection.requestedStrategy.symbol} · {connection.requestedStrategy.timeframe}</small></td><td>{connection.broker}</td><td>{connection.environment}</td><td><span className={styles.status} data-status={connection.status} title={connection.status === 'MANUAL_INTERVENTION_REQUIRED' ? 'Verificá las posiciones directamente en BingX y pedí al administrador confirmar la resolución.' : undefined}>{connectionStatusLabel(connection.status)}</span></td><td><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{connection.riskPolicy ? `$${connection.riskPolicy.declaredCapitalUsd.toFixed(2)}` : '—'}</BrokerSensitiveValue></td><td>{connection.riskPolicy?.enabled ? connection.riskPolicy.sizingMode === 'EQUITY_PERCENT' ? `Compuesto ${connection.riskPolicy.exposurePerOrderPct}% · ${connection.riskPolicy.maxLeverage}x` : <><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{`$${connection.riskPolicy.fixedNotionalUsd}`}</BrokerSensitiveValue> · {connection.riskPolicy.maxLeverage}x</> : connection.riskPolicy ? <><span>Sugerido </span><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{`$${connection.riskPolicy.suggestedNotionalPerOrderUsd}`}</BrokerSensitiveValue></> : 'Desactivado'}</td><td><div className={styles.actions}>{connection.riskPolicy && ['ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL'].includes(connection.status) && <button title="Editar capital" disabled={submitting} className={styles.iconButton} onClick={() => editRisk(connection)}><Pencil size={16} /></button>}{connection.status === 'VALIDATION_FAILED' && <button title="Revalidar" disabled={submitting} className={styles.iconButton} onClick={() => action(connection.id, 'REVALIDATE')}><RefreshCw size={16} /></button>}{connection.status === 'ACTIVE' && <button title="Suspender" disabled={submitting} className={styles.iconButton} onClick={() => action(connection.id, 'SUSPEND')}><Pause size={16} /></button>}{!['REVOKED', 'DELETED', 'MANUAL_INTERVENTION_REQUIRED'].includes(connection.status) && <button title="Revocar" disabled={submitting} className={styles.dangerIcon} onClick={() => action(connection.id, 'REVOKE')}><XCircle size={16} /></button>}{canDeleteConnection(connection.status) && <button title="Eliminar" disabled={submitting} className={styles.dangerIcon} onClick={() => action(connection.id, 'DELETE')}><Trash2 size={16} /></button>}</div></td></tr>)}</tbody></table></div>}
            </section>
            <BrokerOrderHistory
              history={orderHistory}
              privacyMode={privacyMode}
              onRetry={(intentId) => void retryMissedOpen(intentId)}
              retryingIntentId={retryingIntentId}
            />
          </>
        )}
      </div>
    </main>
  )
}
