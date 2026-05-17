'use client'

import { useEffect, useRef } from 'react'
import {
  CandlestickSeries,
  createChart,
  createSeriesMarkers,
  type CandlestickData,
  type IChartApi,
  type ISeriesApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts'
import type { Candle } from '@/lib/algotrend'
import type { PublicDelayedTrade } from '@/lib/public-delayed'

interface Props {
  candles: Candle[]
  trades: PublicDelayedTrade[]
}

export function BTCDelayedChart({ candles, trades }: Props) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const chart: IChartApi = createChart(host, {
      autoSize: true,
      layout: {
        background: { color: 'transparent' },
        textColor: 'rgba(229, 212, 182, 0.78)',
        fontFamily:
          'var(--font-jetbrains-mono), ui-monospace, monospace',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(229, 212, 182, 0.05)' },
        horzLines: { color: 'rgba(229, 212, 182, 0.05)' },
      },
      timeScale: {
        borderColor: 'rgba(229, 212, 182, 0.14)',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: 'rgba(229, 212, 182, 0.14)',
      },
      crosshair: {
        horzLine: { color: 'rgba(244, 78, 28, 0.4)', labelBackgroundColor: '#11162a' },
        vertLine: { color: 'rgba(244, 78, 28, 0.4)', labelBackgroundColor: '#11162a' },
      },
    })

    const series: ISeriesApi<'Candlestick'> = chart.addSeries(CandlestickSeries, {
      upColor: '#79bc72',
      downColor: '#f44e1c',
      borderUpColor: '#79bc72',
      borderDownColor: '#f44e1c',
      wickUpColor: '#79bc72',
      wickDownColor: '#f44e1c',
    })

    const data: CandlestickData<Time>[] = candles.map((c) => ({
      time: c.time as UTCTimestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }))
    series.setData(data)

    if (trades.length > 0) {
      // Markers must be sorted by time ascending for lightweight-charts v5.
      const markers: SeriesMarker<Time>[] = [...trades]
        .sort((a, b) => a.open_time - b.open_time)
        .map((t) => ({
          time: t.open_time as UTCTimestamp,
          position: t.direction === 'LONG' ? 'belowBar' : 'aboveBar',
          color: t.direction === 'LONG' ? '#79bc72' : '#f44e1c',
          shape: t.direction === 'LONG' ? 'arrowUp' : 'arrowDown',
          text: t.direction,
        }))
      createSeriesMarkers(series, markers)
    }

    chart.timeScale().fitContent()

    return () => {
      chart.remove()
    }
  }, [candles, trades])

  return <div ref={hostRef} className="lw-chart-host" />
}
