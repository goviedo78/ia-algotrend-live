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
  const labelSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const probSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  
  // Track price lines and markers plugin to clean them up
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any>(null)
  const labelMarkersRef = useRef<any>(null)
  const probMarkersRef = useRef<any>(null)
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
    
    // Invisible series for deterministic label placement (Line 1: BUY/SELL)
    labelSeriesRef.current = chart.addSeries(LineSeries, {
      color: 'transparent',
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
    })

    // Invisible series for deterministic probability placement (Line 2: 89%)
    probSeriesRef.current = chart.addSeries(LineSeries, {
      color: 'transparent',
      lastValueVisible: false,
      priceLineVisible: false,
      crosshairMarkerVisible: false,
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
    const labelAnchorData: LineData[] = []
    const probAnchorData: LineData[] = []

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
    const candleMarkers: SeriesMarker<Time>[] = []
    const labelMarkers: SeriesMarker<Time>[] = []
    const probMarkers: SeriesMarker<Time>[] = []
    
    // 1. Process closed trades
    for (const t of trades) {
      if (t.status === 'CLOSED') {
        const resultAtEntry = results.find(r => r.time === t.open_time)
        const prob = resultAtEntry 
          ? (t.direction === 'LONG' ? resultAtEntry.probUp : resultAtEntry.probDown) * 100 
          : null
        const probText = prob !== null ? `(${prob.toFixed(1)}%)` : ''
        
        // Offset 1: For 'BUY/SELL' label
        const offsetLabel = t.open_price * 0.016
        const labelPrice = t.direction === 'LONG' 
          ? (t.open_price) - offsetLabel 
          : (t.open_price) + offsetLabel
        
        // Offset 2: For '% Prob' label (further away)
        const offsetProb = t.open_price * 0.032
        const probPrice = t.direction === 'LONG' 
          ? (t.open_price) - offsetProb 
          : (t.open_price) + offsetProb
        
        labelAnchorData.push({ time: t.open_time as Time, value: labelPrice })
        probAnchorData.push({ time: t.open_time as Time, value: probPrice })

        // 1. Arrow signal on main series (No text here)
        candleMarkers.push({
          time: t.open_time as Time,
          position: t.direction === 'LONG' ? 'belowBar' : 'aboveBar',
          shape: t.direction === 'LONG' ? 'arrowUp' : 'arrowDown',
          color: t.direction === 'LONG' ? '#289eff' : '#b63e72',
          size: 1,
        })
        
        // 2. Action Label Bubble (Line 1)
        labelMarkers.push({
          time: t.open_time as Time,
          position: 'inBar',
          shape: 'circle',
          color: t.direction === 'LONG' ? '#289eff' : '#b63e72',
          text: t.direction === 'LONG' ? 'BUY' : 'SELL',
          size: 0, // Hidden shape, only text visible
        })

        // 3. Probability Label Bubble (Line 2)
        probMarkers.push({
          time: t.open_time as Time,
          position: 'inBar',
          shape: 'circle',
          color: t.direction === 'LONG' ? '#289eff' : '#b63e72',
          text: probText,
          size: 0, // Hidden shape, only text visible
        })
        
        // Exit marker
        if (t.close_time) {
          candleMarkers.push({
            time: t.close_time as Time,
            position: t.direction === 'LONG' ? 'aboveBar' : 'belowBar',
            shape: t.direction === 'LONG' ? 'arrowDown' : 'arrowUp',
            color: '#9CA3AF',
            text: `EXIT`,
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
      const probText = prob !== null ? `(${prob.toFixed(1)}%)` : ''

      const offsetLabel = openTrade.open_price * 0.016
      const labelPrice = openTrade.direction === 'LONG' 
        ? (openTrade.open_price) - offsetLabel 
        : (openTrade.open_price) + offsetLabel

      const offsetProb = openTrade.open_price * 0.032
      const probPrice = openTrade.direction === 'LONG' 
        ? (openTrade.open_price) - offsetProb 
        : (openTrade.open_price) + offsetProb
      
      labelAnchorData.push({ time: openTrade.open_time as Time, value: labelPrice })
      probAnchorData.push({ time: openTrade.open_time as Time, value: probPrice })

      // 1. Arrow
      candleMarkers.push({
        time: openTrade.open_time as Time,
        position: openTrade.direction === 'LONG' ? 'belowBar' : 'aboveBar',
        shape: openTrade.direction === 'LONG' ? 'arrowUp' : 'arrowDown',
        color: openTrade.direction === 'LONG' ? '#289eff' : '#b63e72',
        size: 1,
      })
      
      // 2. Action Label
      labelMarkers.push({
        time: openTrade.open_time as Time,
        position: 'inBar',
        shape: 'circle',
        color: openTrade.direction === 'LONG' ? '#289eff' : '#b63e72',
        text: openTrade.direction === 'LONG' ? 'BUY' : 'SELL',
        size: 0,
      })

      // 3. Prob Label
      probMarkers.push({
        time: openTrade.open_time as Time,
        position: 'inBar',
        shape: 'circle',
        color: openTrade.direction === 'LONG' ? '#289eff' : '#b63e72',
        text: `${probText} LIVE`,
        size: 0,
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

    labelSeriesRef.current?.setData(labelAnchorData.sort((a, b) => (a.time as number) - (b.time as number)))
    probSeriesRef.current?.setData(probAnchorData.sort((a, b) => (a.time as number) - (b.time as number)))

    if (markersRef.current) {
      candleRef.current?.detachPrimitive(markersRef.current)
      markersRef.current = null
    }
    if (labelMarkersRef.current) {
      labelSeriesRef.current?.detachPrimitive(labelMarkersRef.current)
      labelMarkersRef.current = null
    }
    if (probMarkersRef.current) {
      probSeriesRef.current?.detachPrimitive(probMarkersRef.current)
      probMarkersRef.current = null
    }

    // Main candles (Arrows)
    if (candleMarkers.length > 0 && candleRef.current) {
        markersRef.current = createSeriesMarkers(candleRef.current, candleMarkers.sort((a, b) => (a.time as number) - (b.time as number)))
    }
    
    // Labels (Balloons at offset 1: BUY/SELL)
    if (labelMarkers.length > 0 && labelSeriesRef.current) {
        labelMarkersRef.current = createSeriesMarkers(labelSeriesRef.current, labelMarkers.sort((a, b) => (a.time as number) - (b.time as number)))
    }

    // Labels (Balloons at offset 2: Prob)
    if (probMarkers.length > 0 && probSeriesRef.current) {
        probMarkersRef.current = createSeriesMarkers(probSeriesRef.current, probMarkers.sort((a, b) => (a.time as number) - (b.time as number)))
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
