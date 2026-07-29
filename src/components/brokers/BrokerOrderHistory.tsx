'use client'

import { ListOrdered } from 'lucide-react'
import type { BrokerOrderHistoryResponse } from '@/lib/brokers/order-history-types'
import { BrokerSensitiveValue, redactShortId, redactText } from './BrokerPrivacy'
import styles from './brokers.module.css'

function usd(value: number) {
  return `${value.toFixed(2)} USD`
}

function quantity(value: number) {
  return value.toLocaleString('es-MX', { maximumFractionDigits: 12 })
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleString('es-MX') : '—'
}

function pct(value: number | null, digits = 2) {
  return value == null ? '—' : `${value.toFixed(digits)}%`
}

function ratio(value: number | null) {
  return value == null ? '—' : value.toFixed(2)
}

export function BrokerOrderHistory({
  history,
  showUser = false,
  privacyMode = false,
}: {
  history: BrokerOrderHistoryResponse
  showUser?: boolean
  privacyMode?: boolean
}) {
  const { orders, totals, performance } = history
  return (
    <section className={styles.tableSection}>
      <div className={styles.sectionHeading}><ListOrdered size={18} /><h2>Órdenes, ejecuciones y resultado neto</h2></div>
      <div className={styles.performanceGrid}>
        <span>Acierto <strong>{pct(performance.winRatePct)}</strong><small>{performance.winningTradeCount} ganadas · {performance.losingTradeCount} perdidas</small></span>
        <span>Ganancia neta <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(performance.netPnlUsd)}</BrokerSensitiveValue></strong><small>{performance.closedTradeCount} trades cerrados</small></span>
        <span>Profit factor <strong>{ratio(performance.profitFactor)}</strong><small>{performance.profitFactor == null && performance.grossProfitUsd > 0 ? 'Sin pérdidas cerradas' : 'Ganancia bruta / pérdida bruta'}</small></span>
        <span>Promedio <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{performance.averageNetPnlUsd == null ? '—' : usd(performance.averageNetPnlUsd)}</BrokerSensitiveValue></strong><small>Último cierre {date(performance.lastClosedAt)}</small></span>
      </div>
      <div className={styles.metrics}>
        <span>PnL realizado <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(totals.realizedPnlUsd)}</BrokerSensitiveValue></strong></span>
        <span>Comisiones <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(totals.feesUsd)}</BrokerSensitiveValue></strong></span>
        <span>Financiación <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(totals.fundingUsd)}</BrokerSensitiveValue></strong></span>
        <span>Neto <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(totals.netPnlUsd)}</BrokerSensitiveValue></strong></span>
        <span>Órdenes / fills <strong>{totals.orderCount} / {totals.fillCount}</strong></span>
        <span>Retorno / notional <strong>{totals.netReturnPct?.toFixed(4) ?? '—'}%</strong></span>
      </div>
      {!orders.length ? <p className={styles.muted}>Todavía no hay órdenes reconciliadas.</p> : (
        <div className={styles.tableWrap}>
          <table className={styles.orderTable}>
            <thead><tr>{showUser && <th>Usuario</th>}<th>Fecha efectiva</th><th>Conexión</th><th>Operación</th><th>Lotaje</th><th>Precio</th><th>Notional</th><th>Comisión</th><th>Neto</th><th>Detalle</th></tr></thead>
            <tbody>{orders.map((order) => (
              <tr key={order.id}>
                {showUser && <td>{redactText(privacyMode, order.userEmail ?? order.userId, 'Usuario oculto')}</td>}
                <td>{date(order.lastFillAt ?? order.submittedAt ?? order.createdAt)}</td>
                <td><strong>{order.connectionLabel}</strong><small>{order.strategyLabel} · {order.environment}</small></td>
                <td><strong>{order.action === 'OPEN' ? 'Entrada' : 'Salida'} {order.direction}</strong><small>{order.side} · {order.status}</small></td>
                <td>{quantity(order.filledQuantity)}<small>solicitado {quantity(order.requestedQuantity)}</small></td>
                <td><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{order.averagePrice == null ? '—' : usd(order.averagePrice)}</BrokerSensitiveValue></td>
                <td><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(order.notionalUsd)}</BrokerSensitiveValue></td>
                <td><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(order.feesUsd)}</BrokerSensitiveValue></td>
                <td className={order.netPnlUsd < 0 ? styles.negative : order.netPnlUsd > 0 ? styles.positive : undefined}><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(order.netPnlUsd)}</BrokerSensitiveValue><small>{order.netReturnPct?.toFixed(4) ?? '—'}%</small></td>
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
                      <span>PnL realizado <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(order.realizedPnlUsd)}</BrokerSensitiveValue></strong></span>
                      <span>Financiación / ajustes <strong><BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(order.fundingUsd + order.adjustmentsUsd)}</BrokerSensitiveValue></strong></span>
                      <span>Order ID GONOVI <strong>{redactShortId(privacyMode, order.clientOrderId)}</strong></span>
                      <span>Order ID broker <strong>{redactShortId(privacyMode, order.brokerOrderId)}</strong></span>
                    </div>
                    <div className={styles.fillList}>
                      <strong>Fills ({order.fills.length})</strong>
                      {order.fills.map((fill) => <span key={fill.id}>{date(fill.filledAt)} · {quantity(fill.quantity)} @ <BrokerSensitiveValue hidden={privacyMode} fallback="•••• USD">{usd(fill.price)}</BrokerSensitiveValue> · comisión <BrokerSensitiveValue hidden={privacyMode} fallback="••••">{fill.fee.toFixed(8)} {fill.feeAsset ?? ''}</BrokerSensitiveValue> · ID {redactShortId(privacyMode, fill.brokerFillId)}</span>)}
                    </div>
                  </details>
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </section>
  )
}
