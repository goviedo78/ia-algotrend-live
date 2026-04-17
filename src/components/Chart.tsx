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
  type IPriceLine,
} from 'lightweight-charts'
import type { Candle } from '@/lib/algotrend'
import type { AlgoTrendResult } from '@/lib/algotrend'
import type { Trade } from '@/lib/db'

interface ChartProps {
  candles: Candle[]
  results: AlgoTrendResult[]
  liveCandle: Candle | null
  trades: Trade[]
  openTrade: Trade | null
}

export default function Chart({ candles, results, liveCandle, trades, openTrade }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const candleRef = useRef<ISeriesApi<'Candlestick'> | null>(null)
  const stBullRef = useRef<ISeriesApi<'Line'> | null>(null)
  const stBearRef = useRef<ISeriesApi<'Line'> | null>(null)
  
  // Track price lines and markers plugin to clean them up
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any>(null)
  const slLineRef = useRef<IPriceLine | null>(null)
  const tpLineRef = useRef<IPriceLine | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: { 
        background: { color: '#0d1323' }, 
        textColor: '#9bb1d8',
      },
      grid: { vertLines: { color: '#1f2c47' }, horzLines: { color: '#1f2c47' } },
      crosshair: { mode: 1 },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#2d3e61' },
      rightPriceScale: { borderColor: '#2d3e61' },
      width: containerRef.current.clientWidth,
      height: 500,
    })
    chartRef.current = chart

    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#289eff', 
      downColor: '#ffffff',
      borderUpColor: '#289eff', 
      borderDownColor: '#ffffff',
      wickUpColor: '#289eff', 
      wickDownColor: '#ffffff',
    })

    stBullRef.current = chart.addSeries(LineSeries, {
      color: '#289eff', lineWidth: 2,
      lastValueVisible: false, priceLineVisible: false,
    })

    stBearRef.current = chart.addSeries(LineSeries, {
      color: '#b63e72', lineWidth: 2,
      lastValueVisible: false, priceLineVisible: false,
    })

    const ro = new ResizeObserver(() => {
      if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth })
    })
    ro.observe(containerRef.current)

    return () => { ro.disconnect(); chart.remove() }
  }, [])

  // Update data and markers
  useEffect(() => {
    if (!candleRef.current || !candles.length) return

    candleRef.current.setData(
      candles.map(c => ({
        time: c.time as Time,
        open: c.open, high: c.high, low: c.low, close: c.close,
      })) as CandlestickData[]
    )

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

    // Build markers from actual trades
    const markers: SeriesMarker<Time>[] = []
    
    // 1. Process closed trades
    for (const t of trades) {
      if (t.status === 'CLOSED') {
        const resultAtEntry = results.find(r => r.time === t.open_time)
        const prob = resultAtEntry 
          ? (t.direction === 'LONG' ? resultAtEntry.probUp : resultAtEntry.probDown) * 100 
          : null
        const probText = prob !== null ? ` (${prob.toFixed(1)}%)` : ''

        markers.push({
          time: t.open_time as Time,
          position: t.direction === 'LONG' ? 'belowBar' : 'aboveBar',
          shape: t.direction === 'LONG' ? 'arrowUp' : 'arrowDown',
          color: t.direction === 'LONG' ? '#289eff' : '#b63e72',
          text: `${t.direction === 'LONG' ? 'BUY' : 'SELL'}${probText} ${t.direction}`,
          size: 2,
        })
        if (t.close_time) {
          markers.push({
            time: t.close_time as Time,
            position: t.direction === 'LONG' ? 'aboveBar' : 'belowBar',
            shape: t.direction === 'LONG' ? 'arrowDown' : 'arrowUp',
            color: '#9CA3AF',
            text: `Exit ${t.direction}`,
            size: 1.5,
          })
        }
      }
    }

    // 2. Process open trade
    if (openTrade) {
      const resultAtEntry = results.find(r => r.time === openTrade.open_time)
      const prob = resultAtEntry 
        ? (openTrade.direction === 'LONG' ? resultAtEntry.probUp : resultAtEntry.probDown) * 100 
        : null
      const probText = prob !== null ? ` (${prob.toFixed(1)}%)` : ''

      markers.push({
        time: openTrade.open_time as Time,
        position: openTrade.direction === 'LONG' ? 'belowBar' : 'aboveBar',
        shape: openTrade.direction === 'LONG' ? 'arrowUp' : 'arrowDown',
        color: openTrade.direction === 'LONG' ? '#289eff' : '#b63e72',
        text: `BUY${probText} ${openTrade.direction} (LIVE)`,
        size: 2,
      })

      if (candleRef.current) {
        if (slLineRef.current) candleRef.current.removePriceLine(slLineRef.current)
        slLineRef.current = candleRef.current.createPriceLine({
          price: openTrade.stop_loss,
          color: '#EF4444',
          lineWidth: 2,
          lineStyle: 1, // Solid or Dashed based on theme
          axisLabelVisible: true,
          title: 'SL',
        })

        if (tpLineRef.current) candleRef.current.removePriceLine(tpLineRef.current)
        if (openTrade.take_profit) {
          tpLineRef.current = candleRef.current.createPriceLine({
            price: openTrade.take_profit,
            color: '#22C55E',
            lineWidth: 2,
            lineStyle: 1,
            axisLabelVisible: true,
            title: 'TP',
          })
        }
      }
    } else {
      if (candleRef.current) {
        if (slLineRef.current) candleRef.current.removePriceLine(slLineRef.current)
        if (tpLineRef.current) candleRef.current.removePriceLine(tpLineRef.current)
        slLineRef.current = null
        tpLineRef.current = null
      }
    }

    // Update markers plugin
    if (markersRef.current) {
      markersRef.current.detachPrimitive?.()
      markersRef.current = null
    }
    if (markers.length > 0 && candleRef.current) {
      markersRef.current = createSeriesMarkers(candleRef.current, markers.sort((a, b) => (a.time as number) - (b.time as number)))
    }
    
    chartRef.current?.timeScale().scrollToRealTime()
  }, [candles, results, trades, openTrade])

  // Live candle tick
  useEffect(() => {
    if (!candleRef.current || !liveCandle) return
    candleRef.current.update({
      time: liveCandle.time as Time,
      open: liveCandle.open,
      high: liveCandle.high,
      low: liveCandle.low,
      close: liveCandle.close,
    })
  }, [liveCandle])

  return (
    <div className="relative w-full overflow-hidden rounded-[1.45rem] border border-[#d6deec] bg-gradient-to-b from-[#131b30] to-[#0d1323] shadow-[0_18px_45px_rgba(34,56,86,0.16)]">
      <div className="pointer-events-none absolute left-4 top-3 z-10 rounded-full border border-[#2f4269] bg-[#111a2f]/80 px-2.5 py-1 text-[10px] font-semibold tracking-[0.14em] text-[#95b4e9]">
        🧠 IA ALGOTREND
      </div>
      <div ref={containerRef} className="h-[500px] w-full" />
    </div>
  )
}
