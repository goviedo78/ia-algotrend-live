import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublicTradesBtc1h, type PublicDelayedTrade } from '@/lib/public-delayed'
import { getPublicCandlesDelayed, getPublicDelayHours } from '@/lib/public-candles'
import { BTCDelayedChart } from './BTCDelayedChart'
import styles from './btc-1h.module.css'

export const metadata: Metadata = {
  title: 'BTC 1H · Demo público · GONOVI',
  description:
    'Espejo público con 24 horas de retraso del desk BTC 1H. Señales, trades y velas con corte temporal. No es tiempo real.',
}

export const revalidate = 600

function formatPrice(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—'
  return value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatPct(value: number | null): string {
  if (value === null || Number.isNaN(value)) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatTime(unixSeconds: number): string {
  return new Date(unixSeconds * 1000).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default async function BTC1HDelayedPage() {
  const delayHours = getPublicDelayHours()

  const [trades, candles] = await Promise.all([
    getPublicTradesBtc1h(120),
    getPublicCandlesDelayed({ limit: 500 }).catch(() => []),
  ])

  const openTrade: PublicDelayedTrade | null =
    trades.find((t) => t.status === 'OPEN') ?? null
  const closedTrades = trades.filter((t) => t.status === 'CLOSED').slice(0, 30)
  const totalClosed = closedTrades.length
  const wins = closedTrades.filter((t) => (t.pnl_pct ?? 0) > 0).length
  const winRate = totalClosed > 0 ? (wins / totalClosed) * 100 : 0

  return (
    <main className={styles.shell}>
      <header className={styles.head}>
        <div className={styles.headLeft}>
          <span className={styles.badge}>
            <span className={styles.badgeDot} aria-hidden="true" />
            DEMO · DELAY {delayHours}H
          </span>
          <h1>BTC · 1H</h1>
          <p>
            Espejo público del desk BTC 1H con {delayHours} horas de retraso.
            Mismas señales, mismos trades, misma lógica — pero nunca en tiempo
            real.
          </p>
        </div>
        <div className={styles.headRight}>
          <Link
            className={styles.liveCta}
            href="https://algotrend.gonovi.app"
            rel="noreferrer"
            target="_blank"
          >
            Ver desk en vivo →
          </Link>
          <Link className={styles.backLink} href="/official">
            ← Volver a gonovi.app
          </Link>
        </div>
      </header>

      <section className={styles.chartCard} aria-label="Gráfico BTC 1H delayed">
        {candles.length > 0 ? (
          <BTCDelayedChart candles={candles} trades={trades} />
        ) : (
          <div className={styles.chartFallback}>
            <p>No fue posible cargar las velas públicas en este momento.</p>
            <small>Reintentá en unos minutos.</small>
          </div>
        )}
      </section>

      <section className={styles.metaGrid}>
        <article className={styles.metaCard}>
          <span className={styles.kicker}>Última señal pública</span>
          {openTrade ? (
            <>
              <h2 className={openTrade.direction === 'LONG' ? styles.long : styles.short}>
                {openTrade.direction === 'LONG' ? 'LARGO' : 'CORTO'}
              </h2>
              <dl>
                <div>
                  <dt>Apertura</dt>
                  <dd>{formatPrice(openTrade.open_price)} USD</dd>
                </div>
                <div>
                  <dt>Stop</dt>
                  <dd>{formatPrice(openTrade.stop_loss)}</dd>
                </div>
                <div>
                  <dt>Objetivo</dt>
                  <dd>{formatPrice(openTrade.take_profit)}</dd>
                </div>
                <div>
                  <dt>Hora pública</dt>
                  <dd>{formatTime(openTrade.signal_time)}</dd>
                </div>
              </dl>
              <small>
                El resultado de esta señal se hace público recién{' '}
                {delayHours} h después del cierre real.
              </small>
            </>
          ) : (
            <>
              <h2>—</h2>
              <p className={styles.muted}>
                No hay señales abiertas en el rango público.
              </p>
            </>
          )}
        </article>

        <article className={styles.metaCard}>
          <span className={styles.kicker}>Resumen público</span>
          <dl className={styles.statsList}>
            <div>
              <dt>Trades cerrados</dt>
              <dd>{totalClosed}</dd>
            </div>
            <div>
              <dt>Win rate</dt>
              <dd>{totalClosed > 0 ? `${winRate.toFixed(1)}%` : '—'}</dd>
            </div>
            <div>
              <dt>Ventana</dt>
              <dd>últimos {totalClosed > 0 ? totalClosed : 0} trades públicos</dd>
            </div>
          </dl>
          <small>
            Los números reflejan únicamente la porción del historial con más de{' '}
            {delayHours} h de antigüedad.
          </small>
        </article>
      </section>

      <section className={styles.tradesCard}>
        <header>
          <h2>Historial público</h2>
          <small>
            Trades cerrados hace más de {delayHours} h. El resto sigue siendo
            privado.
          </small>
        </header>
        {closedTrades.length === 0 ? (
          <p className={styles.muted}>
            Aún no hay trades cerrados visibles para esta ventana pública.
          </p>
        ) : (
          <ol className={styles.tradeList}>
            {closedTrades.map((t) => (
              <li key={t.id} className={styles.tradeRow}>
                <span
                  className={
                    t.direction === 'LONG' ? styles.long : styles.short
                  }
                >
                  {t.direction}
                </span>
                <time>{formatTime(t.open_time)}</time>
                <span className={styles.reason}>{t.close_reason ?? '—'}</span>
                <strong
                  className={(t.pnl_pct ?? 0) >= 0 ? styles.pos : styles.neg}
                >
                  {formatPct(t.pnl_pct)}
                </strong>
              </li>
            ))}
          </ol>
        )}
      </section>

      <footer className={styles.footer}>
        <p>
          Datos delayed {delayHours} h · Demo educativo · No constituye
          asesoría financiera.
        </p>
      </footer>
    </main>
  )
}
