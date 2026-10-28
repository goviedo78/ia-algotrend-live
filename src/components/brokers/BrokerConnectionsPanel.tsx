'use client'

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Cable, CircleDollarSign, KeyRound, LoaderCircle, Pause, Pencil, Plus, RefreshCw, RotateCcw, ShieldAlert, ShieldCheck, Trash2, XCircle } from 'lucide-react'
import { canDeleteConnection, connectionStatusLabel } from '@/lib/brokers/domain'
import type { BrokerConnectionDto, RiskPolicy, RiskProfile } from '@/lib/brokers/domain'
import { requiredMaxExposureUsd, withCoherentExposure } from '@/lib/brokers/risk-draft'
import { FULL_BALANCE_CAPITAL_USD, planOpeningNotional, sizingChoiceOf, type SizingChoice } from '@/lib/brokers/sizing'
import { BrokerBrand } from './BrokerBrand'
import { BrokerFieldLabel } from './BrokerFieldHelp'
import { SizingChoiceField, sizingSummary } from './BrokerSizingChoice'
import { BrokerThemeToggle, useBrokerTheme } from './BrokerThemeToggle'
import { BrokerOrderHistory } from './BrokerOrderHistory'
import {
  EMPTY_BROKER_ORDER_HISTORY,
  type BrokerOpenPositionSummary,
  type BrokerOrderHistoryResponse,
} from '@/lib/brokers/order-history-types'
import { BrokerPrivacyToggle, BrokerSensitiveValue, redactText, useBrokerPrivacy } from './BrokerPrivacy'
import { BROKER_STRATEGIES } from '@/lib/brokers/strategies'
import { calculateOpeningFundingRequirement, DEFAULT_BINGX_TAKER_FEE_RATE, defaultTakerFeeRate } from '@/lib/brokers/funding-requirement'
import styles from './brokers.module.css'

type Membership = { status: string; requested_at?: string } | null
type RiskEditDraft = {
  connectionId: string
  choice: SizingChoice
  dailyLossLimitPct: number
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
  limitedByBalance?: boolean
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
  const [closingPositionKey, setClosingPositionKey] = useState<string | null>(null)
  const [strategyCode, setStrategyCode] = useState('ALGOTREND_BTC_1H')
  const [broker, setBroker] = useState<'BINGX' | 'BITUNIX'>('BINGX')
  const brokerLabel = broker === 'BITUNIX' ? 'Bitunix' : 'BingX'
  const [environment, setEnvironment] = useState<'DEMO' | 'LIVE'>('DEMO')
  const [sizingChoice, setSizingChoice] = useState<SizingChoice>('FULL_BALANCE')
  const [percentValue, setPercentValue] = useState(50)
  const [fixedUsd, setFixedUsd] = useState(10)
  const [dailyLossPct, setDailyLossPct] = useState(100)
  const [reservePct, setReservePct] = useState(0)
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
    // React suelta currentTarget al terminar el evento: después del await ya es null.
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const fixedCapitalUsd = Math.max(100, fixedUsd)
    const sizing = sizingChoice === 'FIXED'
      ? { sizingMode: 'FIXED_NOTIONAL', capitalUsd: fixedCapitalUsd, allocationPct: Math.min(100, Math.max(1, fixedUsd / fixedCapitalUsd * 100)), fixedNotionalUsd: fixedUsd }
      : { sizingMode: 'EQUITY_PERCENT', capitalUsd: FULL_BALANCE_CAPITAL_USD, allocationPct: sizingChoice === 'FULL_BALANCE' ? 100 : percentValue }
    try {
      await api('/api/broker-connections', {
        method: 'POST',
        body: JSON.stringify({
          broker: form.get('broker'), environment: form.get('environment'), label: form.get('label'),
          strategyCode: form.get('strategyCode'), riskProfile: 'CONSERVATIVE',
          ...sizing, marginReservePct: reservePct, dailyLossLimitPct: dailyLossPct,
          apiKey: form.get('apiKey'), secretKey: form.get('secretKey'), ipRestrictionConfirmed: false,
          permissions: { read: true, perpetualTrading: true, spot: false, withdrawal: false, universalTransfer: false, subaccounts: false, p2p: false },
        }),
      })
      formElement.reset()
      await load()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo crear la conexión.') }
    finally { setSubmitting(false) }
  }

  async function rotateCredentials(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting) return
    setSubmitting(true)
    setError('')
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    try {
      await api(`/api/broker-connections/${form.get('connectionId')}/rotate`, {
        method: 'POST',
        body: JSON.stringify({ apiKey: form.get('apiKey'), secretKey: form.get('secretKey') }),
      })
      formElement.reset()
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
        // Lo que no aplica al modo elegido no se manda: el servidor conserva o deriva su valor.
        body: JSON.stringify({
          capitalUsd: riskEdit.capitalUsd,
          riskProfile: riskEdit.riskProfile,
          sizingMode: riskEdit.choice === 'FIXED' ? 'FIXED_NOTIONAL' : 'EQUITY_PERCENT',
          allocationPct: riskEdit.allocationPct,
          ...(riskEdit.choice === 'FIXED'
            ? { fixedNotionalUsd: riskEdit.fixedNotionalUsd, dailyLossLimitUsd: riskEdit.dailyLossLimitUsd, maxTotalExposureUsd: riskEdit.maxTotalExposureUsd }
            : { dailyLossLimitPct: riskEdit.dailyLossLimitPct }),
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

  // Cerrar a mano una posición que la conexión abrió. Si el broker todavía la tiene, sale una
  // orden reduce-only real; si el titular ya la cerró allá, el motor la da de baja en libros.
  async function closeOpenPosition(position: BrokerOpenPositionSummary) {
    if (closingPositionKey) return
    const confirmed = window.confirm(
      `Cerrar la posición ${position.direction} de ${position.symbol} en “${position.connectionLabel}”.\n\n`
      + 'Si sigue abierta en el broker se envía su cierre a mercado ahora mismo. '
      + 'Si ya la cerraste vos, deja de figurar como abierta.',
    )
    if (!confirmed) return
    setClosingPositionKey(position.key)
    setError('')
    try {
      await api(`/api/broker-connections/${position.connectionId}/positions/close`, {
        method: 'POST',
        body: JSON.stringify({ symbol: position.symbol, direction: position.direction }),
      })
      await load(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo cerrar la posición.')
    } finally {
      setClosingPositionKey(null)
    }
  }

  function editRisk(connection: BrokerConnectionDto) {
    if (!connection.riskPolicy) return
    setError('')
    setRiskEdit(withCoherentExposure({
      connectionId: connection.id,
      choice: sizingChoiceOf(connection.riskPolicy),
      dailyLossLimitPct: connection.riskPolicy.dailyLossLimitPct || 100,
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

  // Cambiar de modo reacomoda sólo lo que ese modo usa. Volver al modo que la conexión ya
  // tenía restituye sus números guardados, así editar no altera una conexión que funciona.
  function changeEditChoice(choice: SizingChoice) {
    setRiskEdit((current) => {
      if (!current) return current
      const saved = connections.find((item) => item.id === current.connectionId)?.riskPolicy
      const savedChoice = saved ? sizingChoiceOf(saved) : null
      const capitalUsd = choice === 'FULL_BALANCE' ? FULL_BALANCE_CAPITAL_USD
        : saved && savedChoice === choice ? saved.declaredCapitalUsd
          : choice === 'PERCENT' ? FULL_BALANCE_CAPITAL_USD : Math.max(100, current.fixedNotionalUsd)
      const allocationPct = choice === 'FULL_BALANCE' ? 100
        : choice === 'PERCENT' ? (saved && savedChoice === 'PERCENT' ? saved.exposurePerOrderPct : 50) : current.allocationPct
      return withCoherentExposure({
        ...current, choice, capitalUsd, allocationPct, compoundEnabled: choice !== 'FIXED',
        marginReservePct: saved && savedChoice === choice ? Math.min(10, Math.max(0, saved.marginReservePct)) : 0,
      })
    })
  }

  async function action(id: string, value: 'SUSPEND' | 'REVOKE' | 'DELETE' | 'REVALIDATE') {
    if (actionInFlight.current) return
    if (value === 'REVOKE' && !window.confirm('Revocar elimina la credencial guardada en GONOVI. No cierra posiciones abiertas en el broker. ¿Continuar?')) return
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
              {broker === 'BITUNIX' && <p className={styles.notice}>Bitunix está disponible para BTC 1H con cuenta real y requiere aprobación antes de operar. Creá una API exclusiva con lectura y trading de futuros, sin retiros ni transferencias. La conexión actual desde Vercel requiere dejar la restricción de IP vacía.</p>}
              <form className={styles.formGrid} onSubmit={createConnection} autoComplete="off">
                <label className={styles.field}>
                  <BrokerFieldLabel label="Broker" tooltip="Plataforma donde se ejecutarán las órdenes de esta conexión." example="Ejemplo: BingX." />
                  <select name="broker" value={broker} onChange={(event) => { const next = event.target.value as 'BINGX' | 'BITUNIX'; setBroker(next); if (next === 'BITUNIX') { setEnvironment('LIVE'); setStrategyCode('ALGOTREND_BTC_1H') } }}><option value="BINGX">BingX</option><option value="BITUNIX">Bitunix</option><option value="BINANCE" disabled>Binance (próximamente)</option></select>
                </label>
                <label className={styles.field}>
                  <BrokerFieldLabel label="Entorno" tooltip="Demo usa fondos simulados de BingX. Real opera con fondos reales de esa API." example="Ejemplo: elegí Demo para la primera prueba." />
                  <select name="environment" value={environment} onChange={(event) => setEnvironment(event.target.value as 'DEMO' | 'LIVE')}><option value="DEMO" disabled={broker === 'BITUNIX'}>Demo · fondos simulados de BingX</option><option value="LIVE">Real · fondos reales</option></select>
                </label>
                <label className={styles.field}>
                  <BrokerFieldLabel label="Estrategia" tooltip="Cada conexión queda vinculada a una sola estrategia, con lotaje, órdenes y estadísticas independientes." example="Ejemplo: creá una API para BTC 1H y otra API distinta para Oro 30m." />
                  <select name="strategyCode" value={strategyCode} onChange={(event) => setStrategyCode(event.target.value)}><option value="ALGOTREND_BTC_1H">{BROKER_STRATEGIES.ALGOTREND_BTC_1H.label}</option><option value="ALGOTREND_GOLD_30M" disabled={broker === 'BITUNIX'}>{BROKER_STRATEGIES.ALGOTREND_GOLD_30M.label}</option></select>
                </label>
                <label className={styles.field}>
                  <BrokerFieldLabel label="Nombre" tooltip="Identificador interno para reconocer esta cuenta. No modifica el nombre en el broker." example="Ejemplo: BTC principal 1H." />
                  <input name="label" required maxLength={80} placeholder="BTC principal 1H" />
                </label>
                <SizingChoiceField name="sizingChoice" value={sizingChoice} onChange={setSizingChoice} />
                {sizingChoice === 'FIXED' && <label className={`${styles.field} ${privacyMode ? styles.sensitiveInput : ''}`}>
                  <BrokerFieldLabel label="USD por operación" tooltip="Importe exacto de cada apertura. Si el saldo libre no alcanza, la orden no se envía." example="Ejemplo: 10 USD." />
                  <input name="fixedUsd" required type="number" min="1" max="1000000" step="0.01" value={fixedUsd} onChange={(event) => setFixedUsd(Number(event.target.value) || 0)} />
                </label>}
                {sizingChoice === 'PERCENT' && <label className={styles.field}>
                  <BrokerFieldLabel label="Porcentaje del saldo (%)" tooltip="Parte del saldo de la cuenta que usa cada apertura." example="Ejemplo: 50% de 200 USD son 100 USD por entrada." />
                  <input name="percentValue" required type="number" min="1" max="99" step="1" value={percentValue} onChange={(event) => setPercentValue(Number(event.target.value) || 0)} />
                </label>}
                <div className={`${styles.capitalScope} ${styles.fullWidth}`}>
                  <ShieldCheck size={18} />
                  <div><strong>Apalancamiento 1x</strong><span>{environment === 'DEMO' ? 'Opera con el saldo simulado de BingX.' : 'Opera con el saldo real de Futuros. Nunca transfiere fondos.'} Si esta API la comparte otra estrategia, usá Monto fijo para no quitarle saldo. Podés cambiar el apalancamiento después de aprobar.</span></div>
                </div>
                <details className={`${styles.advancedRisk} ${styles.fullWidth}`}>
                  <summary>Avanzado <span>Opcional</span></summary>
                  <div className={styles.advancedRiskGrid}>
                    <label className={styles.field}>
                      <BrokerFieldLabel label="Corte de pérdida diaria (%)" tooltip="Frena nuevas aperturas el resto del día al perder este porcentaje. 100 = sin corte." example="Ejemplo: 5 frena tras perder 5% en el día." />
                      <input name="dailyLossPct" required type="number" min="0.1" max="100" step="0.1" value={dailyLossPct} onChange={(event) => setDailyLossPct(Number(event.target.value) || 0)} />
                    </label>
                    <label className={styles.field}>
                      <BrokerFieldLabel label="Saldo que queda libre (%)" tooltip="Parte del saldo que nunca se usa para abrir. 0 = usa todo." example="Ejemplo: 10 deja libre el 10%." />
                      <input name="reservePct" required type="number" min="0" max="10" step="0.1" value={reservePct} onChange={(event) => setReservePct(Number(event.target.value) || 0)} />
                    </label>
                  </div>
                </details>
                <label className={styles.field}>
                  <BrokerFieldLabel label="API key" tooltip="Clave pública de la API correspondiente al entorno elegido." example={`API de ${brokerLabel}, correspondiente al entorno elegido.`} />
                  <input name="apiKey" required type="password" minLength={16} placeholder={`API key de ${brokerLabel}`} />
                </label>
                <label className={styles.field}>
                  <BrokerFieldLabel label="Secret key" tooltip="Se cifra antes de guardarse y no vuelve a mostrarse. Nunca uses una clave con permiso de retiro." example="Ejemplo: secret de la misma API seleccionada." />
                  <input name="secretKey" required type="password" minLength={16} placeholder={`Secret key de ${brokerLabel}`} />
                </label>
                <div className={styles.fullWidth}>
                  <p className={styles.permissionText}><KeyRound size={16} /> Permitido: lectura y futuros perpetuos. Prohibido: Spot, retiros, transferencias, subcuentas y P2P.</p>
                  <BrokerFieldLabel label="Confirmación de permisos" tooltip="Esta confirmación debe coincidir con los permisos reales de la API. GONOVI no necesita retiros ni transferencias." example="Ejemplo: sólo Leer y Trading con Futuros Perpetuos." />
                  <label className={styles.check}><input type="checkbox" required /><span>Confirmo que la clave sólo permite lectura y trading de futuros perpetuos.</span></label>
                </div>
                <button className={styles.primaryButton} disabled={submitting || (sizingChoice === 'FIXED' && fixedUsd <= 0) || (sizingChoice === 'PERCENT' && (percentValue < 1 || percentValue > 99))} type="submit">Conectar y validar</button>
              </form>
            </section>
            {riskEdit && (() => {
              const connection = connections.find((item) => item.id === riskEdit.connectionId)
              if (!connection) return null
              const fixed = riskEdit.choice === 'FIXED'
              const takerFeeRate = fundingRequirements[connection.id]?.takerFeeRate ?? defaultTakerFeeRate(connection.broker)
              const availableMarginUsd = fundingRequirements[connection.id]?.availableMarginUsd
              // Vista previa con el mismo cálculo del motor y el saldo libre que informa el broker.
              const preview = planOpeningNotional({
                policy: {
                  sizingMode: fixed ? 'FIXED_NOTIONAL' : 'EQUITY_PERCENT',
                  fixedNotionalUsd: riskEdit.fixedNotionalUsd,
                  exposurePerOrderPct: riskEdit.allocationPct,
                  marginReservePct: riskEdit.marginReservePct,
                  minAvailableMarginUsd: Math.floor(riskEdit.capitalUsd * riskEdit.marginReservePct) / 100,
                  maxLeverage: riskEdit.maxLeverage,
                },
                sizingCapitalUsd: Math.min(riskEdit.capitalUsd, availableMarginUsd ?? riskEdit.capitalUsd),
                availableMarginUsd: availableMarginUsd ?? Number.POSITIVE_INFINITY,
                takerFeeRate,
              })
              const exposicionRequeridaUsd = requiredMaxExposureUsd(riskEdit)
              const exposicionInsuficiente = fixed && riskEdit.maxTotalExposureUsd < riskEdit.fixedNotionalUsd
              const margenFaltanteUsd = fixed && typeof availableMarginUsd === 'number'
                ? Math.round((preview.requiredAvailableMarginUsd - availableMarginUsd) * 100) / 100
                : 0
              const update = (patch: Partial<RiskEditDraft>, coherent = false) => setRiskEdit((current) => current ? (coherent ? withCoherentExposure({ ...current, ...patch }) : { ...current, ...patch }) : current)
              return <section className={styles.section} id="editar-capital">
                <div className={styles.sectionHeading}><Pencil size={18} /><h2>Editar {connection.label}</h2></div>
                <div className={styles.capitalScope}><ShieldCheck size={18} /><div><strong>{BROKER_STRATEGIES[connection.requestedStrategy.code]?.label ?? connection.requestedStrategy.code} · {connection.broker} · {connection.environment}</strong><span>Las claves quedan guardadas. El cambio aplica desde la próxima entrada y se rechaza si hay una orden en curso.</span></div></div>
                <form className={styles.formGrid} onSubmit={requestRiskChange}>
                  <SizingChoiceField name="editSizingChoice" value={riskEdit.choice} onChange={changeEditChoice} />
                  {fixed && <label className={`${styles.field} ${privacyMode ? styles.sensitiveInput : ''}`}><BrokerFieldLabel label="USD por operación" tooltip="Importe exacto de cada apertura. Si el saldo libre no alcanza, la orden no se envía." example={`Necesita ${preview.requiredAvailableMarginUsd.toFixed(2)} USD libres con margen, comisión y reserva.`} /><input type="number" min="1" max="1000000" step="0.01" value={riskEdit.fixedNotionalUsd} onChange={(event) => update({ fixedNotionalUsd: Number(event.target.value) || 0 }, true)} required /></label>}
                  {riskEdit.choice === 'PERCENT' && <label className={styles.field}><BrokerFieldLabel label="Porcentaje del saldo (%)" tooltip="Parte del saldo que usa cada apertura." example="Ejemplo: 90." /><input type="number" min="1" max="100" step="0.1" value={riskEdit.allocationPct} onChange={(event) => update({ allocationPct: Number(event.target.value) || 0 }, true)} required /></label>}
                  <label className={styles.field}><BrokerFieldLabel label="Apalancamiento" tooltip="Multiplica exposición y riesgo. La plataforma impone su máximo con BROKER_MAX_ALLOWED_LEVERAGE." example="1x = sin apalancamiento." /><input type="number" min="1" max="20" step="1" value={riskEdit.maxLeverage} onChange={(event) => update({ maxLeverage: Number(event.target.value) || 1 })} required /></label>
                  <details className={`${styles.advancedRisk} ${styles.fullWidth}`}>
                    <summary>Avanzado <span>Opcional</span></summary>
                    <div className={styles.advancedRiskGrid}>
                      {fixed
                        ? <label className={`${styles.field} ${privacyMode ? styles.sensitiveInput : ''}`}><BrokerFieldLabel label="Corte de pérdida diaria (USD)" tooltip="Frena nuevas aperturas el resto del día al perder este importe." example="Ejemplo: 20." /><input type="number" min="1" max="10000000" step="0.01" value={riskEdit.dailyLossLimitUsd} onChange={(event) => update({ dailyLossLimitUsd: Number(event.target.value) || 0 })} required /></label>
                        : <label className={styles.field}><BrokerFieldLabel label="Corte de pérdida diaria (%)" tooltip="Frena nuevas aperturas el resto del día al perder este porcentaje. 100 = sin corte." example="Ejemplo: 5." /><input type="number" min="0.1" max="100" step="0.1" value={riskEdit.dailyLossLimitPct} onChange={(event) => update({ dailyLossLimitPct: Number(event.target.value) || 0 })} required /></label>}
                      <label className={styles.field}><BrokerFieldLabel label="Saldo que queda libre (%)" tooltip={fixed ? 'Porcentaje del capital de referencia que debe quedar libre después de abrir.' : 'Parte del saldo que nunca se usa para abrir. 0 = usa todo.'} example={fixed ? `Hoy: ${(Math.floor(riskEdit.capitalUsd * riskEdit.marginReservePct) / 100).toFixed(2)} USD sobre ${riskEdit.capitalUsd.toFixed(2)} USD.` : 'Ejemplo: 10.'} /><input type="number" min="0" max="10" step="0.1" value={riskEdit.marginReservePct} onChange={(event) => update({ marginReservePct: Number(event.target.value) || 0 })} required /></label>
                      {riskEdit.choice === 'PERCENT' && <label className={`${styles.field} ${privacyMode ? styles.sensitiveInput : ''}`}><BrokerFieldLabel label="Tope de capital (USD)" tooltip="Base del interés compuesto: el porcentaje se calcula sobre este capital más los resultados propios, sin superar el saldo real." example={`${FULL_BALANCE_CAPITAL_USD.toLocaleString('es-MX')} = usar el saldo real sin tope.`} /><input type="number" min="100" max="10000000" step="0.01" value={riskEdit.capitalUsd} onChange={(event) => update({ capitalUsd: Number(event.target.value) || 0 }, true)} required /></label>}
                      {fixed && <label className={`${styles.field} ${privacyMode ? styles.sensitiveInput : ''}`}><BrokerFieldLabel label="Exposición total máxima (USD)" tooltip="Suma de posiciones abiertas a la vez. No puede ser menor que una entrada." example="Igual al monto si operás de a una posición." /><input type="number" min="1" max="10000000" step="0.01" value={riskEdit.maxTotalExposureUsd} onChange={(event) => update({ maxTotalExposureUsd: Number(event.target.value) || 0 })} required /></label>}
                      <label className={styles.field}><BrokerFieldLabel label="Posiciones simultáneas" tooltip="Cuántas posiciones propias puede tener abiertas a la vez." example="1 = una por vez." /><input type="number" min="1" max="20" step="1" value={riskEdit.maxOpenPositions} onChange={(event) => update({ maxOpenPositions: Number(event.target.value) || 1 }, true)} required /></label>
                      <label className={styles.field}><BrokerFieldLabel label="Órdenes por minuto" tooltip="Freno contra ráfagas. Un reverso necesita 2: cerrar y abrir." example="2 permite cerrar y abrir en la misma vela." /><input type="number" min="1" max="60" step="1" value={riskEdit.maxOrdersPerMinute} onChange={(event) => update({ maxOrdersPerMinute: Number(event.target.value) || 1 })} required /></label>
                    </div>
                  </details>
                  <div className={`${styles.metrics} ${styles.fullWidth}`}>
                    <span>Próxima entrada {fixed ? '' : '(estimada)'} <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{typeof availableMarginUsd === 'number' || fixed ? `${preview.notionalUsd.toFixed(2)} USD` : 'según tu saldo'}</BrokerSensitiveValue></strong></span>
                    {typeof availableMarginUsd === 'number' && <span>Saldo libre en {connection.broker} <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{availableMarginUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span>}
                    <span>Comisión de apertura <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{preview.openingFeeUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span>
                    <span>Corte diario <strong>{fixed ? `${riskEdit.dailyLossLimitUsd.toFixed(2)} USD` : riskEdit.dailyLossLimitPct >= 100 ? 'Sin corte' : `${riskEdit.dailyLossLimitPct}%`}</strong></span>
                  </div>
                  {margenFaltanteUsd > 0 && <p className={`${styles.notice} ${styles.noticeWrap} ${styles.fullWidth}`} role="alert">Con este monto hacen falta <strong>{preview.requiredAvailableMarginUsd.toFixed(2)} USD libres</strong> y en {connection.broker} tenés <strong>{(availableMarginUsd ?? 0).toFixed(2)} USD</strong>. Podés guardarlo, pero la orden no va a abrir hasta que alcance el saldo. Con Todo el saldo abriría con lo que tengas.</p>}
                  {exposicionInsuficiente && <p className={`${styles.notice} ${styles.noticeWrap} ${styles.fullWidth}`} role="alert">La exposición total ({riskEdit.maxTotalExposureUsd.toFixed(2)} USD) no alcanza para una entrada. <button className={styles.linkButton} type="button" onClick={() => update({ maxTotalExposureUsd: exposicionRequeridaUsd })}>Ajustar a {exposicionRequeridaUsd.toFixed(2)} USD</button></p>}
                  <div className={`${styles.commandRow} ${styles.fullWidth}`}><button className={styles.primaryButton} disabled={submitting || riskEdit.capitalUsd < 100 || exposicionInsuficiente} type="submit">Guardar cambios</button><button className={styles.secondaryButton} disabled={submitting} type="button" onClick={() => setRiskEdit(null)}>Cancelar</button></div>
                </form>
              </section>
            })()}
            {connections.some((connection) => connection.status === 'SUSPENDED') && <section className={styles.section}>
              <div className={styles.sectionHeading}><RotateCcw size={18} /><h2>Editar conexión suspendida</h2></div>
              <h3 className={styles.subsectionHeading}>Cambiar credenciales</h3>
              <form className={styles.formGrid} onSubmit={rotateCredentials} autoComplete="off">
                <label className={styles.field}><BrokerFieldLabel label="Conexión" tooltip="La rotación sólo se permite con la conexión suspendida, sin posiciones ni órdenes pendientes." example="Ejemplo: Oro 30m principal." /><select name="connectionId" required>{connections.filter((connection) => connection.status === 'SUSPENDED').map((connection) => <option value={connection.id} key={connection.id}>{connection.label} · {BROKER_STRATEGIES[connection.requestedStrategy.code]?.label ?? connection.requestedStrategy.code}</option>)}</select></label>
                <label className={styles.field}><BrokerFieldLabel label="Nueva API key" tooltip="Reemplaza la clave cifrada anterior. El administrador nunca puede verla ni ingresarla por vos." example="Ejemplo: nueva API exclusiva de esta estrategia." /><input name="apiKey" required type="password" minLength={16} placeholder="Nueva API key del broker de esta conexión" /></label>
                <label className={styles.field}><BrokerFieldLabel label="Nueva Secret key" tooltip="Debe pertenecer a la misma API y tener sólo lectura y futuros perpetuos." example="Ejemplo: secret de la misma API seleccionada." /><input name="secretKey" required type="password" minLength={16} placeholder="Nueva Secret key del broker de esta conexión" /></label>
                <button className={styles.primaryButton} disabled={submitting} type="submit">Cambiar y revalidar</button>
              </form>
            </section>}

            {connections.some((connection) => connection.riskPolicy?.enabled) && (
              <section className={styles.tableSection}>
                <div className={styles.sectionHeading}><CircleDollarSign size={18} /><h2>Capital previsto para la próxima entrada</h2></div>
                <p className={styles.notice}>Monto fijo: se envía tal como está y necesita el saldo mínimo indicado. Todo el saldo y porcentaje: se ajustan a tu saldo libre al abrir.</p>
                <div className={styles.fundingEstimateGrid}>
                  {connections.filter((connection) => connection.riskPolicy?.enabled).map((connection) => {
                    const policy = connection.riskPolicy!
                    const liveRequirement = fundingRequirements[connection.id]
                    const estimate = liveRequirement ?? fundingEstimate(policy, defaultTakerFeeRate(connection.broker))
                    const byBalance = sizingChoiceOf(policy) !== 'FIXED'
                    return <article className={styles.fundingEstimateCard} key={connection.id}>
                      <strong>{redactText(privacyMode, connection.label)}</strong>
                      <small>{BROKER_STRATEGIES[connection.requestedStrategy.code]?.label ?? connection.requestedStrategy.code} · {policy.maxLeverage}x</small>
                      {byBalance
                        ? <div className={styles.requiredCapitalBox}><span>Saldo libre en el broker</span><strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{liveRequirement ? `${liveRequirement.availableMarginUsd.toFixed(2)} USD` : 'Consultando…'}</BrokerSensitiveValue></strong><small>Abre con lo que haya, si alcanza el lote mínimo</small></div>
                        : <div className={styles.requiredCapitalBox}><span>Saldo libre mínimo para abrir</span><strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{estimate.requiredAvailableMarginUsd.toFixed(2)} USD</BrokerSensitiveValue></strong><small>Umbral estricto contra falta de fondos</small></div>}
                      <div><span>{byBalance ? 'Entrada estimada' : 'Capital fijo por entrada'}<strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{byBalance && !liveRequirement ? 'Según tu saldo' : `${estimate.targetNotionalUsd.toFixed(2)} USD`}</BrokerSensitiveValue></strong></span><span>Margen de la orden<strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{estimate.orderMarginUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Comisión cubierta<strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{estimate.openingFeeUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span><span>Reserva protegida<strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{estimate.reserveUsd.toFixed(2)} USD</BrokerSensitiveValue></strong></span></div>
                      <small>Tasa taker usada: {(estimate.takerFeeRate * 100).toFixed(4)}% {liveRequirement && connection.broker === 'BINGX' ? '· consultada en BingX' : '· estimación conservadora'}</small>
                      {byBalance && <small>{liveRequirement?.limitedByBalance ? 'Ajustada a tu saldo libre actual. ' : ''}El importe final se calcula con tu saldo al abrir.</small>}
                    </article>
                  })}
                </div>
              </section>
            )}

            <section className={styles.tableSection}>
              <div className={styles.sectionHeading}><Cable size={18} /><h2>Conexiones</h2><button className={styles.iconButton} title="Actualizar" disabled={loading || submitting} onClick={() => void load()}><RefreshCw size={17} /></button></div>
              {!connections.length ? <p className={styles.muted}>No hay conexiones registradas.</p> : <div className={styles.tableWrap}><table><thead><tr><th>Nombre</th><th>Estrategia</th><th>Broker</th><th>Entorno</th><th>Estado</th><th>Tamaño por entrada</th><th aria-label="Acciones" /></tr></thead><tbody>{connections.map((connection) => <tr key={connection.id}><td>{connection.label}</td><td>{BROKER_STRATEGIES[connection.requestedStrategy.code]?.label ?? connection.requestedStrategy.code}<small>{connection.requestedStrategy.symbol} · {connection.requestedStrategy.timeframe}</small></td><td>{connection.broker}</td><td>{connection.environment}</td><td><span className={styles.status} data-status={connection.status} title={connection.status === 'MANUAL_INTERVENTION_REQUIRED' ? 'Verificá las posiciones directamente en el broker y pedí al administrador confirmar la resolución.' : undefined}>{connectionStatusLabel(connection.status)}</span></td><td>{connection.riskPolicy ? (() => {
                const policy = connection.riskPolicy
                const choice = sizingChoiceOf(policy)
                return <><BrokerSensitiveValue hidden={privacyMode && choice === 'FIXED'} fallback="•••• USD">{sizingSummary(choice, { percent: policy.exposurePerOrderPct, fixedUsd: policy.fixedNotionalUsd || policy.suggestedNotionalPerOrderUsd }, policy.maxLeverage)}</BrokerSensitiveValue>{choice === 'PERCENT' && policy.declaredCapitalUsd < FULL_BALANCE_CAPITAL_USD && <small><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{`Base $${policy.declaredCapitalUsd.toFixed(2)}`}</BrokerSensitiveValue></small>}{!policy.enabled && <small>Pendiente de aprobación</small>}</>
              })() : '—'}</td><td><div className={styles.actions}>{connection.riskPolicy && ['ACTIVE', 'SUSPENDED', 'PENDING_APPROVAL'].includes(connection.status) && <button title="Editar capital" disabled={submitting} className={styles.iconButton} onClick={() => editRisk(connection)}><Pencil size={16} /></button>}{connection.status === 'VALIDATION_FAILED' && <button title="Revalidar" disabled={submitting} className={styles.iconButton} onClick={() => action(connection.id, 'REVALIDATE')}><RefreshCw size={16} /></button>}{connection.status === 'ACTIVE' && <button title="Suspender" disabled={submitting} className={styles.iconButton} onClick={() => action(connection.id, 'SUSPEND')}><Pause size={16} /></button>}{!['REVOKED', 'DELETED', 'MANUAL_INTERVENTION_REQUIRED'].includes(connection.status) && <button title="Revocar" disabled={submitting} className={styles.dangerIcon} onClick={() => action(connection.id, 'REVOKE')}><XCircle size={16} /></button>}{canDeleteConnection(connection.status) && <button title="Eliminar" disabled={submitting} className={styles.dangerIcon} onClick={() => action(connection.id, 'DELETE')}><Trash2 size={16} /></button>}</div></td></tr>)}</tbody></table></div>}
            </section>
            <BrokerOrderHistory
              history={orderHistory}
              connections={connections}
              privacyMode={privacyMode}
              onRetry={(intentId) => void retryMissedOpen(intentId)}
              retryingIntentId={retryingIntentId}
              onClosePosition={(position) => void closeOpenPosition(position)}
              closingPositionKey={closingPositionKey}
            />
          </>
        )}
      </div>
    </main>
  )
}
