'use client'

import { useState } from 'react'
import { brokerHistoryBars, type HistoryGrouping } from '@/lib/brokers/history-filters'
import type { BrokerOrderHistoryItem } from '@/lib/brokers/order-history-types'
import styles from './brokers.module.css'

type Metric = 'netPnlUsd' | 'netReturnPct' | 'count' | 'volumeUsd'
const labels: Record<Metric, string> = { netPnlUsd: 'Resultado neto (USD)', netReturnPct: 'Retorno neto (%)', count: 'Cierres completos', volumeUsd: 'Volumen ejecutado (USD)' }

export function BrokerHistoryChart({ orders, timeZone, privacyMode }: { orders: BrokerOrderHistoryItem[]; timeZone: string; privacyMode: boolean }) {
  const [grouping, setGrouping] = useState<HistoryGrouping>('day')
  const [metric, setMetric] = useState<Metric>('netPnlUsd')
  const bars = brokerHistoryBars(orders, grouping, timeZone)
  const max = Math.max(1, ...bars.map(bar => Math.abs(bar[metric] ?? 0)))
  const width = Math.max(640, bars.length * 52 + 80)
  const format = (value: number | null) => value == null ? '—' : metric === 'count' ? String(value) : `${value > 0 ? '+' : ''}${value.toLocaleString('es-MX', { maximumFractionDigits: 2 })}${metric === 'netReturnPct' ? '%' : ' USD'}`
  return <div className={styles.statsCard}>
    <div className={styles.cardHeader}><h3>Evolución de las operaciones</h3></div>
    <div className={styles.historyFilters}>
      <label>Mostrar<select value={metric} onChange={e => setMetric(e.target.value as Metric)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Agrupar por<select value={grouping} onChange={e => setGrouping(e.target.value as HistoryGrouping)}><option value="day">Día</option><option value="week">Semana</option><option value="month">Mes</option></select></label>
    </div>
    <p className={styles.muted}>Barras por fecha de ejecución. Los resultados se realizan al cerrar; el retorno de cada barra usa su notional de entrada cerrado.</p>
    {privacyMode ? <p className={styles.notice}>Gráfico oculto en modo privacidad.</p> : !bars.length ? <p className={styles.notice}>No hay ejecuciones en esta selección.</p> : <>
      <div className={styles.historyChart} tabIndex={0} role="region" aria-label={`${labels[metric]}, gráfico desplazable`}>
        <svg viewBox={`0 0 ${width} 260`} style={{ width, height: 260 }} role="img" aria-label={labels[metric]}>
          <title>{labels[metric]} por {grouping === 'day' ? 'día' : grouping === 'week' ? 'semana' : 'mes'}</title>
          {[0, 1, 2].map(i => <g key={i}><line x1="64" x2={width - 12} y1={24 + i * 96} y2={24 + i * 96} className={styles.chartGrid}/><text x="58" y={28 + i * 96} textAnchor="end" className={styles.chartLabel}>{(max * (1 - i)).toLocaleString('es-MX', { maximumFractionDigits: 1 })}</text></g>)}
          {bars.map((bar, index) => {
            const value = bar[metric] ?? 0
            const height = Math.abs(value) / max * 92
            const x = 72 + index * (width - 90) / bars.length
            const barWidth = Math.min(32, (width - 90) / bars.length - 8)
            return <g key={bar.date}>
              <title>{bar.date}: {format(bar[metric])} · {bar.count} cierres</title>
              <rect x={x} y={value >= 0 ? 120 - height : 120} width={barWidth} height={Math.max(1, height)} rx="2" fill={value < 0 ? 'var(--broker-error-text)' : 'var(--broker-success-text)'}/>
              <text x={x + barWidth / 2} y="238" textAnchor="middle" className={styles.chartLabel}>{bar.date.slice(5)}</text>
              <text x={x + barWidth / 2} y="253" textAnchor="middle" className={styles.chartLabel}>{bar.date.slice(0, 4)}</text>
            </g>
          })}
        </svg>
      </div>
      <details className={styles.orderDetails}><summary>Ver datos del gráfico</summary><div className={styles.tableWrap}><table className={styles.orderTable}><thead><tr><th>Periodo</th><th>Neto USD</th><th>Retorno neto</th><th>Cierres</th><th>Volumen USD</th></tr></thead><tbody>{bars.map(bar => <tr key={bar.date}><td>{bar.date}</td><td>{bar.netPnlUsd.toFixed(2)}</td><td>{bar.netReturnPct == null ? '—' : `${bar.netReturnPct.toFixed(4)}%`}</td><td>{bar.count}</td><td>{bar.volumeUsd.toFixed(2)}</td></tr>)}</tbody></table></div></details>
    </>}
  </div>
}
