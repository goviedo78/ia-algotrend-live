'use client'

import { ListOrdered } from 'lucide-react'
import type { BrokerOrderHistoryResponse } from '@/lib/brokers/order-history-types'
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

export function BrokerOrderHistory({ history, showUser = false }: { history: BrokerOrderHistoryResponse; showUser?: boolean }) {
  const { orders, totals } = history
  return (
    <section className={styles.tableSection}>
      <div className={styles.sectionHeading}><ListOrdered size={18} /><h2>Órdenes, ejecuciones y resultado neto</h2></div>
      <div className={styles.metrics}>
        <span>PnL realizado <strong>{usd(totals.realizedPnlUsd)}</strong></span>
        <span>Comisiones <strong>{usd(totals.feesUsd)}</strong></span>
        <span>Financiación <strong>{usd(totals.fundingUsd)}</strong></span>
        <span>Neto <strong>{usd(totals.netPnlUsd)}</strong></span>
        <span>Órdenes / fills <strong>{totals.orderCount} / {totals.fillCount}</strong></span>
        <span>Retorno / notional <strong>{totals.netReturnPct?.toFixed(4) ?? '—'}%</strong></span>
      </div>
      {!orders.length ? <p className={styles.muted}>Todavía no hay órdenes reconciliadas.</p> : (
        <div className={styles.tableWrap}>
          <table className={styles.orderTable}>
            <thead><tr>{showUser && <th>Usuario</th>}<th>Fecha efectiva</th><th>Conexión</th><th>Operación</th><th>Lotaje</th><th>Precio</th><th>Notional</th><th>Comisión</th><th>Neto</th><th>Detalle</th></tr></thead>
            <tbody>{orders.map((order) => (
              <tr key={order.id}>
                {showUser && <td>{order.userEmail ?? order.userId}</td>}
                <td>{date(order.lastFillAt ?? order.submittedAt ?? order.createdAt)}</td>
                <td><strong>{order.connectionLabel}</strong><small>{order.strategyLabel} · {order.environment}</small></td>
                <td><strong>{order.action === 'OPEN' ? 'Entrada' : 'Salida'} {order.direction}</strong><small>{order.side} · {order.status}</small></td>
                <td>{quantity(order.filledQuantity)}<small>solicitado {quantity(order.requestedQuantity)}</small></td>
                <td>{order.averagePrice == null ? '—' : usd(order.averagePrice)}</td>
                <td>{usd(order.notionalUsd)}</td>
                <td>{usd(order.feesUsd)}</td>
                <td className={order.netPnlUsd < 0 ? styles.negative : order.netPnlUsd > 0 ? styles.positive : undefined}>{usd(order.netPnlUsd)}<small>{order.netReturnPct?.toFixed(4) ?? '—'}%</small></td>
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
                      <span>PnL realizado <strong>{usd(order.realizedPnlUsd)}</strong></span>
                      <span>Financiación / ajustes <strong>{usd(order.fundingUsd + order.adjustmentsUsd)}</strong></span>
                      <span>Order ID GONOVI <strong>{order.clientOrderId}</strong></span>
                      <span>Order ID broker <strong>{order.brokerOrderId ?? '—'}</strong></span>
                    </div>
                    <div className={styles.fillList}>
                      <strong>Fills ({order.fills.length})</strong>
                      {order.fills.map((fill) => <span key={fill.id}>{date(fill.filledAt)} · {quantity(fill.quantity)} @ {usd(fill.price)} · comisión {fill.fee.toFixed(8)} {fill.feeAsset ?? ''} · ID {fill.brokerFillId}</span>)}
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
