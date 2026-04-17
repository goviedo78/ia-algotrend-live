'use client'

import { useEffect, useRef } from 'react'
import {
  createChart,
  createSeriesMarkers,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type SeriesMarker,
  type Time,
} from 'lightweight-charts'
import type { Candle } from '@/lib/algotrend'
import type { AlgoTrendResult } from '@/lib/algotrend'

interface ChartProps {
  candles: Candle[]
  results: AlgoTrendResult[]
  liveCandle: Candle | null
}

export default function Chart({ candles, results, liveCandle }: ChartProps) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const chartRef      = useRef<IChartApi | null>(null)
  const candleRef     = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const stBullRef     = useRef<ISeriesApi<'Line'> | null>(null)
  const stBearRef     = useRef<ISeriesApi<'Line'> | null>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef    = useRef<any>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: { background: { color: '#0d1323' }, textColor: '#9bb1d8' },
      grid:   { vertLines: { color: '#1f2c47' }, horzLines: { color: '#1f2c47' } },
      crosshair: { mode: 1 },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#2d3e61' },
      rightPriceScale: { borderColor: '#2d3e61' },
      width:  containerRef.current.clientWidth,
      height: 500,
    })
    chartRef.current = chart

    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#289eff', downColor: '#ffffff',
      borderUpColor: '#289eff', borderDownColor: '#ffffff',
      wickUpColor: '#289eff', wickDownColor: '#ffffff',
    })

    // SuperTrend bullish line
    stBullRef.current = chart.addSeries(LineSeries, {
      color: '#289eff', lineWidth: 2,
      lastValueVisible: false, priceLineVisible: false,
      lineStyle: 0,
    })

    // SuperTrend bearish line
    stBearRef.current = chart.addSeries(LineSeries, {
      color: '#b63e72', lineWidth: 2,
      lastValueVisible: false, priceLineVisible: false,
      lineStyle: 0,
    })

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); chart.remove() }
  }, [])

  // Update data when results change
  useEffect(() => {
    if (!candleRef.current || !candles.length || !results.length) return

    candleRef.current.setData(
      candles.map(c => ({
        time: c.time as Time,
        open: c.open, high: c.high, low: c.low, close: c.close,
      })) as CandlestickData[]
    )

    // Split SuperTrend using confirmed direction (last_stdir in Pine)
    const bullData: LineData[] = []
    const bearData: LineData[] = []

    for (const r of results) {
      if (isNaN(r.supertrend) || isNaN(r.lastStDir)) continue
      if (r.lastStDir === 1) {
        bullData.push({ time: r.time as Time, value: r.supertrend })
      } else if (r.lastStDir === -1) {
        bearData.push({ time: r.time as Time, value: r.supertrend })
      }
    }

    stBullRef.current?.setData(bullData)
    stBearRef.current?.setData(bearData)

    // Signal markers — arrows with probability %
    const markers: SeriesMarker<Time>[] = []
    for (const r of results) {
      if (r.longSig) {
        const prob = (r.probUp * 100).toFixed(1)
        markers.push({
          time:     r.time as Time,
          position: 'belowBar',
          shape:    'arrowUp',
          color:    '#289eff',
          text:     `COMPRA (${prob}%)`,
          size:     1,
        })
      } else if (r.shortSig) {
        const prob = (r.probDown * 100).toFixed(1)
        markers.push({
          time:     r.time as Time,
          position: 'aboveBar',
          shape:    'arrowDown',
          color:    '#b63e72',
          text:     `VENTA (${prob}%)`,
          size:     1,
        })
      }
    }
    // Remove old marker plugin and create fresh one
    if (markersRef.current) {
      markersRef.current.detachPrimitive?.()
      markersRef.current = null
    }
    if (markers.length > 0 && candleRef.current) {
      markersRef.current = createSeriesMarkers(candleRef.current, markers)
    }

    chartRef.current?.timeScale().scrollToRealTime()
  }, [candles, results])

  // Live candle tick
  useEffect(() => {
    if (!candleRef.current || !liveCandle) return
    candleRef.current.update({
      time:  liveCandle.time as Time,
      open:  liveCandle.open,
      high:  liveCandle.high,
      low:   liveCandle.low,
      close: liveCandle.close,
    })
  }, [liveCandle])

  return (
    <div className="relative w-full overflow-hidden rounded-[1.45rem] border border-[#d6deec] bg-gradient-to-b from-[#131b30] to-[#0d1323] shadow-[0_18px_45px_rgba(34,56,86,0.16)]">
      <div className="pointer-events-none absolute left-4 top-3 z-10 rounded-full border border-[#2f4269] bg-[#111a2f]/80 px-2.5 py-1 text-[10px] font-semibold tracking-[0.12em] text-[#95b4e9]">
        SUPERTREND + KNN
      </div>
      <div ref={containerRef} className="h-[500px] w-full" />
    </div>
  )
}
