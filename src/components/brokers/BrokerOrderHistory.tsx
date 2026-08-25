'use client'

import { Activity, AlertTriangle, DollarSign, ListOrdered, LoaderCircle, Percent, RotateCcw } from 'lucide-react'
import type {
  BrokerOrderHistoryItem,
  BrokerOrderHistoryResponse,
} from '@/lib/brokers/order-history-types'
import { BrokerSensitiveValue, redactShortId, redactText } from './BrokerPrivacy'
import styles from './brokers.module.css'

function usd(value: number) {
  const absolute = Math.abs(value).toFixed(2)
  return `${value < 0 ? '-' : ''}$${absolute} USD`
}

function quantity(value: number) {
  return value.toLocaleString('es-MX', { maximumFractionDigits: 12 })
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleString('es-MX') : '—'
}

function pct(value: number | null, digits = 2) {
  if (value == null) return '—'
  return `${value > 0 ? '+' : ''}${value.toFixed(digits)}%`
}

function ratio(value: number | null) {
  return value == null ? '—' : value.toFixed(2)
}

function valueClass(value: number | null) {
  if (value == null || value === 0) return undefined
  return value > 0 ? styles.positiveText : styles.negativeText
}

function displayedNetPnl(order: BrokerOrderHistoryItem) {
  return order.tradeNetPnlUsd ?? order.netPnlUsd
}

export function BrokerOrderHistory({
  history,
  showUser = false,
  privacyMode = false,
  onRetry,
  retryingIntentId = null,
}: {
  history: BrokerOrderHistoryResponse
  showUser?: boolean
  privacyMode?: boolean
  onRetry?: (intentId: string) => void
  retryingIntentId?: string | null
}) {
  const { orders, openPositions = [], totals, performance, missedOpportunities } = history
  const missed = missedOpportunities ?? []
  const missedWithResult = missed.filter((item) => item.missedReturnPct != null)
  const missedNetUsd = missedWithResult.reduce((total, item) => total + (item.missedGrossPnlUsd ?? 0), 0)

  return (
    <section className={styles.tableSection}>
      <div className={styles.sectionHeading}>
        <ListOrdered size={18} />
        <h2>Órdenes, ejecuciones y resultado neto</h2>
      </div>

      {openPositions.length > 0 && (
        <div className={styles.statsCard}>
          <div className={styles.cardHeader}>
            <Activity size={18} className={styles.pctIcon} />
            <h3>Posiciones abiertas y vinculadas ({openPositions.length})</h3>
          </div>
          <p className={styles.notice} role="status">
            Estas entradas sí fueron ejecutadas. Permanecen ligadas a su conexión y la próxima
            señal de salida de la misma estrategia, símbolo y dirección enviará su cierre.
          </p>
          <div className={styles.openPositionGrid}>
            {openPositions.map((position) => (
              <article className={styles.openPositionCard} key={position.key}>
                <div className={styles.openPositionTitle}>
                  <strong>{position.direction} · {position.symbol}</strong>
                  <span>Abierta</span>
                </div>
                <div className={styles.openPositionMetrics}>
                  <span>Capital realmente usado <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(position.notionalUsd)}</BrokerSensitiveValue></strong></span>
                  <span>Cantidad <strong>{quantity(position.quantity)}</strong></span>
                  <span>Precio medio de entrada <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(position.averageEntryPrice)}</BrokerSensitiveValue></strong></span>
                  <span>Comisión de entrada <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(position.entryFeesUsd)}</BrokerSensitiveValue></strong></span>
                </div>
                <small>{redactText(privacyMode, position.connectionLabel)} · {position.strategyLabel} · abierta {date(position.openedAt)}</small>
                <small>Señal vinculada: {position.externalSignalId ?? '—'}</small>
              </article>
            ))}
          </div>
        </div>
      )}

      {performance.unmatchedCloseCount > 0 && (
        <p className={styles.notice} role="status">
          {performance.unmatchedCloseCount} cierre(s) no tienen una apertura completa dentro del contexto cargado y no se incluyen en las estadísticas.
        </p>
      )}

      <div className={styles.statsCard}>
        <div className={styles.cardHeader}>
          <Percent size={18} className={styles.pctIcon} />
          <h3>Rendimiento porcentual</h3>
        </div>
        <div className={styles.pctGrid}>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Tasa de acierto</span>
            <strong className={styles.highlightValue}>{pct(performance.winRatePct)}</strong>
            <small>{performance.winningTradeCount} ganadas · {performance.losingTradeCount} perdidas · {performance.closedTradeCount} cerradas</small>
          </div>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Retorno neto total</span>
            <strong className={valueClass(totals.netReturnPct)}>{pct(totals.netReturnPct, 4)}</strong>
            <small>Resultado neto / notional de entrada cerrado</small>
          </div>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Promedio por trade</span>
            <strong className={valueClass(performance.averageReturnPct)}>{pct(performance.averageReturnPct)}</strong>
            <small>Media de operaciones cerradas completas</small>
          </div>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Mejor trade</span>
            <strong className={valueClass(performance.bestTradeReturnPct)}>{pct(performance.bestTradeReturnPct)}</strong>
            <small>Mayor retorno neto individual</small>
          </div>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Peor trade</span>
            <strong className={valueClass(performance.worstTradeReturnPct)}>{pct(performance.worstTradeReturnPct)}</strong>
            <small>Menor retorno neto individual</small>
          </div>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Profit factor</span>
            <strong>{ratio(performance.profitFactor)}</strong>
            <small>{performance.profitFactor == null && performance.grossProfitUsd > 0 ? 'Sin pérdidas cerradas' : 'Ganancia neta bruta / pérdida neta bruta'}</small>
          </div>
        </div>
      </div>

      <div className={styles.statsCard}>
        <div className={styles.cardHeader}>
          <DollarSign size={18} className={styles.usdIcon} />
          <h3>Resultados en USD</h3>
        </div>
        <div className={styles.usdGrid}>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Resultado neto</span>
            <strong className={valueClass(performance.netPnlUsd)}>
              <BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(performance.netPnlUsd)}</BrokerSensitiveValue>
            </strong>
            <small>Incluye comisiones de entrada y salida</small>
          </div>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Ganancia bruta neta</span>
            <strong className={valueClass(performance.grossProfitUsd)}>
              <BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(performance.grossProfitUsd)}</BrokerSensitiveValue>
            </strong>
            <small>Suma de trades ganadores</small>
          </div>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Pérdida bruta neta</span>
            <strong className={performance.grossLossUsd > 0 ? styles.negativeText : undefined}>
              <BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(-performance.grossLossUsd)}</BrokerSensitiveValue>
            </strong>
            <small>Suma de trades perdedores</small>
          </div>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Comisiones de ciclos</span>
            <strong>
              <BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(performance.totalFeesUsd)}</BrokerSensitiveValue>
            </strong>
            <small>Apertura + cierre de trades completos</small>
          </div>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Promedio neto</span>
            <strong className={valueClass(performance.averageNetPnlUsd)}>
              <BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{performance.averageNetPnlUsd == null ? '—' : usd(performance.averageNetPnlUsd)}</BrokerSensitiveValue>
            </strong>
            <small>Promedio por trade cerrado</small>
          </div>
          <div className={styles.metricBlock}>
            <span className={styles.metricLabel}>Notional de entrada</span>
            <strong>
              <BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(performance.closedEntryNotionalUsd)}</BrokerSensitiveValue>
            </strong>
            <small>{totals.orderCount} órdenes cargadas · {totals.fillCount} fills reales</small>
          </div>
        </div>
      </div>

      {!orders.length ? <p className={styles.muted}>Todavía no hay órdenes reconciliadas.</p> : (
        <div className={styles.tableWrap}>
          <table className={styles.orderTable}>
            <thead><tr>{showUser && <th>Usuario</th>}<th>Fecha efectiva</th><th>Conexión</th><th>Operación</th><th>Lotaje</th><th>Precio</th><th>Capital usado</th><th>Comisión</th><th>Neto</th><th>Detalle</th></tr></thead>
            <tbody>{orders.map((order) => {
              const netPnlUsd = displayedNetPnl(order)
              return (
                <tr key={order.id}>
                  {showUser && <td>{redactText(privacyMode, order.userEmail ?? order.userId, 'Usuario oculto')}</td>}
                  <td>{date(order.lastFillAt ?? order.submittedAt ?? order.createdAt)}</td>
                  <td><strong>{order.connectionLabel}</strong><small>{order.strategyLabel} · {order.environment}</small></td>
                  <td><strong>{order.action === 'OPEN' ? 'Entrada' : 'Salida'} {order.direction}</strong><small>{order.side} · {order.status}</small></td>
                  <td>{quantity(order.filledQuantity)}<small>solicitado {quantity(order.requestedQuantity)}</small></td>
                  <td><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{order.averagePrice == null ? '—' : usd(order.averagePrice)}</BrokerSensitiveValue></td>
                  <td><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(order.notionalUsd)}</BrokerSensitiveValue></td>
                  <td><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(order.feesUsd)}</BrokerSensitiveValue></td>
                  <td className={netPnlUsd < 0 ? styles.negative : netPnlUsd > 0 ? styles.positive : undefined}>
                    <BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(netPnlUsd)}</BrokerSensitiveValue>
                    <small>{pct(order.netReturnPct, 4)}</small>
                  </td>
                  <td>
                    <details className={styles.orderDetails}>
                      <summary>Ver</summary>
                      <div className={styles.orderDetailGrid}>
                        <span>Broker <strong>{order.broker} · {order.environment}</strong></span>
                        <span>Instrumento <strong>{order.symbol} · {order.timeframe}</strong></span>
                        <span>Señal <strong>{order.externalSignalId ?? '—'}</strong></span>
                        <span>Hora de señal <strong>{date(order.signalTime)}</strong></span>
                        <span>Enviada <strong>{date(order.submittedAt)}</strong></span>
                        <span>Primer fill <strong>{date(order.firstFillAt)}</strong></span>
                        <span>Último fill <strong>{date(order.lastFillAt)}</strong></span>
                        <span>Reconciliada <strong>{date(order.reconciledAt)}</strong></span>
                        <span>PnL informado por broker <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(order.realizedPnlUsd)}</BrokerSensitiveValue></strong></span>
                        <span>Neto del ciclo <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{order.tradeNetPnlUsd == null ? '—' : usd(order.tradeNetPnlUsd)}</BrokerSensitiveValue></strong></span>
                        <span>Financiación / ajustes <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(order.fundingUsd + order.adjustmentsUsd)}</BrokerSensitiveValue></strong></span>
                        <span>Order ID GONOVI <strong>{redactShortId(privacyMode, order.clientOrderId)}</strong></span>
                        <span>Order ID broker <strong>{redactShortId(privacyMode, order.brokerOrderId)}</strong></span>
                      </div>
                      <div className={styles.fillList}>
                        <strong>Fills reales ({order.fills.length})</strong>
                        {order.fills.map((fill) => <span key={fill.id}>{date(fill.filledAt)} · {quantity(fill.quantity)} @ <BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(fill.price)}</BrokerSensitiveValue> · comisión <BrokerSensitiveValue hidden={privacyMode} fallback="••••">{fill.fee.toFixed(8)} {fill.feeAsset ?? ''}</BrokerSensitiveValue> · ID {redactShortId(privacyMode, fill.brokerFillId)}</span>)}
                      </div>
                    </details>
                  </td>
                </tr>
              )
            })}</tbody>
          </table>
        </div>
      )}

      {missed.length > 0 && (
        <div className={`${styles.statsCard} ${styles.missedOperationsCard}`}>
          <div className={styles.cardHeader}>
            <AlertTriangle size={18} />
            <h3>Operaciones que no se ejecutaron ({missed.length})</h3>
          </div>
          <p className={styles.notice} role="status">
            El motor rechazó estas señales antes de mandarlas al broker. Cuando la estrategia ya
            cerró el trade, acá ves el resultado que te perdiste: el porcentaje sale de los precios
            reales de la señal y el importe es bruto, estimado con tu lotaje actual y sin comisiones.
            {onRetry && <> “Reenviar” sólo está disponible mientras esa operación siga abierta en la estrategia.</>}
            {missedWithResult.length > 0 && (
              <> Balance de lo no ejecutado: <strong className={valueClass(missedNetUsd)}>
                <BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(missedNetUsd)}</BrokerSensitiveValue>
              </strong>.</>
            )}
          </p>
          <div className={styles.tableWrap}>
            <table>
              <thead><tr>
                <th>Fecha</th><th>Conexión</th><th>Señal</th><th>Capital previsto</th><th>Motivo</th>
                <th>Precio señal</th><th>Precio cierre</th><th>Resultado perdido</th>{onRetry && <th>Acción</th>}
              </tr></thead>
              <tbody>
                {missed.map((item) => (
                  <tr key={item.id}>
                    <td>{date(item.signalTime ?? item.rejectedAt)}</td>
                    <td>{redactText(privacyMode, item.connectionLabel)}</td>
                    <td>{item.action === 'OPEN' ? 'Apertura no ejecutada' : 'Cierre fallido histórico'}<br /><small>{item.direction} · {item.symbol} · {item.strategyLabel}</small></td>
                    <td><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{item.notionalUsd == null ? '—' : usd(item.notionalUsd)}</BrokerSensitiveValue></td>
                    <td>
                      {item.insufficientFunds && <strong className={styles.negativeText}>Sin fondos. </strong>}
                      {item.reason}
                    </td>
                    <td><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{item.entryPrice == null ? '—' : usd(item.entryPrice)}</BrokerSensitiveValue></td>
                    <td><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{item.exitPrice == null ? '—' : usd(item.exitPrice)}</BrokerSensitiveValue></td>
                    <td>
                      {item.outcome === 'NOT_APPLICABLE' && <span>No aplica</span>}
                      {item.outcome === 'PENDING' && <span>La estrategia todavía no cerró</span>}
                      {item.missedReturnPct != null && (
                        <strong className={valueClass(item.missedReturnPct)}>
                          {pct(item.missedReturnPct)}
                          {item.missedGrossPnlUsd != null && (
                            <> · <BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(item.missedGrossPnlUsd)}</BrokerSensitiveValue> bruto</>
                          )}
                        </strong>
                      )}
                    </td>
                    {onRetry && <td>
                      {item.canRetry ? (
                        <button
                          type="button"
                          className={styles.retryButton}
                          disabled={retryingIntentId != null}
                          onClick={() => onRetry(item.id)}
                        >
                          {retryingIntentId === item.id
                            ? <LoaderCircle className={styles.spin} size={14} />
                            : <RotateCcw size={14} />}
                          {retryingIntentId === item.id ? 'Reenviando…' : 'Reenviar'}
                        </button>
                      ) : '—'}
                    </td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  )
}
