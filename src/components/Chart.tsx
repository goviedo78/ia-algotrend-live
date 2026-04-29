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
  const arrowSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const labelSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const bubbleSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  const probSeriesRef = useRef<ISeriesApi<'Line'> | null>(null)
  
  // Track price lines and markers plugin to clean them up.
  // createSeriesMarkers returns an opaque primitive — `any` is the pragmatic call.
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const markersRef = useRef<any>(null)
  const arrowMarkersRef = useRef<any>(null)
  const labelMarkersRef = useRef<any>(null)
  const bubbleMarkersRef = useRef<any>(null)
  const probMarkersRef = useRef<any>(null)
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const slLineRef = useRef<IPriceLine | null>(null)
  const tpLineRef = useRef<IPriceLine | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        // GON warm palette — Ink-deep bg + bone-warm muted text
        background: { color: '#14120E' },
        textColor: '#A8A39A',
        fontSize: 13,
        fontFamily: '"JetBrains Mono", ui-monospace, monospace',
      },
      grid: { vertLines: { color: '#2A2620' }, horzLines: { color: '#2A2620' } },
      crosshair: { mode: 1 },
      timeScale: { timeVisible: true, secondsVisible: false, borderColor: '#3D362A' },
      rightPriceScale: { borderColor: '#3D362A' },
      width: containerRef.current.clientWidth,
      height: 500,
    })
    chartRef.current = chart

    // GON trading semantic — warm green up, pulse down (= LONG/SHORT)
    candleRef.current = chart.addSeries(CandlestickSeries, {
      upColor: '#34D178',
      downColor: '#D8503C',
      borderUpColor: '#34D178',
      borderDownColor: '#D8503C',
      wickUpColor: '#34D178',
      wickDownColor: '#D8503C',
    })

    stBullRef.current = chart.addSeries(LineSeries, {
      color: '#34D178', lineWidth: 2,
      lastValueVisible: false, priceLineVisible: false,
    })

    stBearRef.current = chart.addSeries(LineSeries, {
      color: '#D8503C', lineWidth: 2,
      lastValueVisible: false, priceLineVisible: false,
    })
    
    // Invisible series for Arrow (Line 0: Closest to vela)
    arrowSeriesRef.current = chart.addSeries(LineSeries, {
      color: 'transparent', lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
    })

    // Invisible series for Word (Line 1: BUY/SELL)
    labelSeriesRef.current = chart.addSeries(LineSeries, {
      color: 'transparent', lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
    })

    // Invisible series for Bubble (Line 2: Cirle)
    bubbleSeriesRef.current = chart.addSeries(LineSeries, {
      color: 'transparent', lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
    })

    // Invisible series for Prob (Line 3: 89%)
    probSeriesRef.current = chart.addSeries(LineSeries, {
      color: 'transparent', lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false,
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
    const arrowAnchorData: LineData[] = []
    const labelAnchorData: LineData[] = []
    const bubbleAnchorData: LineData[] = []
    const probAnchorData: LineData[] = []

    // Map-based lookup for O(1) performance
    const candleMap = new Map(candles.map(c => [c.time, c]))
    const resultsMap = new Map(results.map(r => [r.time, r]))

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
    const arrowMarkers: SeriesMarker<Time>[] = []
    const labelMarkers: SeriesMarker<Time>[] = []
    const bubbleMarkers: SeriesMarker<Time>[] = []
    const probMarkers: SeriesMarker<Time>[] = []
    
    // 1. Process closed trades
    for (const t of trades) {
      if (t.status === 'CLOSED') {
        const resultAtEntry = resultsMap.get(t.open_time)
        const prob = resultAtEntry 
          ? (t.direction === 'LONG' ? resultAtEntry.probUp : resultAtEntry.probDown) * 100 
          : null
        
        const probText = prob !== null ? `(${prob.toFixed(1)}%)` : ''
        
        // Base anchor from candle high/low to ensure clearance
        const baseCandle = candleMap.get(t.open_time)
        const basePrice = t.direction === 'LONG' ? baseCandle?.low || t.open_price : baseCandle?.high || t.open_price
        
        // Offset 0: Arrow (Closest)
        const offsetArrow = basePrice * 0.010
        const arrowPrice = t.direction === 'LONG' ? basePrice - offsetArrow : basePrice + offsetArrow

        // Offset 1: For 'BUY/SELL' word
        const offsetLabel = basePrice * 0.022
        const labelPrice = t.direction === 'LONG' ? basePrice - offsetLabel : basePrice + offsetLabel
        
        // Offset 2: For Bubble circle
        const offsetBubble = basePrice * 0.034
        const bubblePrice = t.direction === 'LONG' ? basePrice - offsetBubble : basePrice + offsetBubble

        // Offset 3: For % Prob
        const offsetProb = basePrice * 0.046
        const probPrice = t.direction === 'LONG' ? basePrice - offsetProb : basePrice + offsetProb
        
        arrowAnchorData.push({ time: t.open_time as Time, value: arrowPrice })
        labelAnchorData.push({ time: t.open_time as Time, value: labelPrice })
        bubbleAnchorData.push({ time: t.open_time as Time, value: bubblePrice })
        probAnchorData.push({ time: t.open_time as Time, value: probPrice })

        // 1. Arrow signal (Line 0)
        arrowMarkers.push({
          time: t.open_time as Time,
          position: 'inBar',
          shape: t.direction === 'LONG' ? 'arrowUp' : 'arrowDown',
          color: t.direction === 'LONG' ? '#34D178' : '#D8503C',
          size: 1,
        })
        
        // 2. Word Label (Line 1)
        labelMarkers.push({
          time: t.open_time as Time,
          position: 'inBar',
          shape: 'circle',
          color: t.direction === 'LONG' ? '#34D178' : '#D8503C',
          text: t.direction === 'LONG' ? 'BUY' : 'SELL',
          size: 0, 
        })

        // 3. Bubble Circle (Line 2)
        bubbleMarkers.push({
          time: t.open_time as Time,
          position: 'inBar',
          shape: 'circle',
          color: t.direction === 'LONG' ? '#34D178' : '#D8503C',
          text: '',
          size: 2, 
        })

        // 4. Prob Label (Line 3)
        probMarkers.push({
          time: t.open_time as Time,
          position: 'inBar',
          shape: 'circle',
          color: t.direction === 'LONG' ? '#34D178' : '#D8503C',
          text: probText,
          size: 0, 
        })
        
        // Exit marker
        if (t.close_time) {
          candleMarkers.push({
            time: t.close_time as Time,
            position: t.direction === 'LONG' ? 'aboveBar' : 'belowBar',
            shape: t.direction === 'LONG' ? 'arrowDown' : 'arrowUp',
            color: '#A8A39A',
            text: `EXIT`,
            size: 1.5,
          })
        }
      }
    }

    // 2. Process open trade
    if (openTrade) {
      const resultAtEntry = resultsMap.get(openTrade.open_time)
      const prob = resultAtEntry 
        ? (openTrade.direction === 'LONG' ? resultAtEntry.probUp : resultAtEntry.probDown) * 100 
        : null
      
      const probText = prob !== null ? `(${prob.toFixed(1)}%)` : ''

      const baseCandle = candleMap.get(openTrade.open_time)
      const basePrice = openTrade.direction === 'LONG' ? baseCandle?.low || openTrade.open_price : baseCandle?.high || openTrade.open_price

      const offsetArrow = basePrice * 0.010
      const arrowPrice = openTrade.direction === 'LONG' ? basePrice - offsetArrow : basePrice + offsetArrow

      const offsetLabel = basePrice * 0.022
      const labelPrice = openTrade.direction === 'LONG' ? basePrice - offsetLabel : basePrice + offsetLabel

      const offsetBubble = basePrice * 0.034
      const bubblePrice = openTrade.direction === 'LONG' ? basePrice - offsetBubble : basePrice + offsetBubble

      const offsetProb = basePrice * 0.046
      const probPrice = openTrade.direction === 'LONG' ? basePrice - offsetProb : basePrice + offsetProb
      
      arrowAnchorData.push({ time: openTrade.open_time as Time, value: arrowPrice })
      labelAnchorData.push({ time: openTrade.open_time as Time, value: labelPrice })
      bubbleAnchorData.push({ time: openTrade.open_time as Time, value: bubblePrice })
      probAnchorData.push({ time: openTrade.open_time as Time, value: probPrice })

      // 1. Arrow
      arrowMarkers.push({
        time: openTrade.open_time as Time,
        position: 'inBar',
        shape: openTrade.direction === 'LONG' ? 'arrowUp' : 'arrowDown',
        color: openTrade.direction === 'LONG' ? '#34D178' : '#D8503C',
        size: 1,
      })
      
      // 2. Action Label
      labelMarkers.push({
        time: openTrade.open_time as Time,
        position: 'inBar',
        shape: 'circle',
        color: openTrade.direction === 'LONG' ? '#34D178' : '#D8503C',
        text: openTrade.direction === 'LONG' ? 'BUY' : 'SELL',
        size: 0,
      })

      // 3. Bubble
      bubbleMarkers.push({
        time: openTrade.open_time as Time,
        position: 'inBar',
        shape: 'circle',
        color: openTrade.direction === 'LONG' ? '#34D178' : '#D8503C',
        text: '',
        size: 2,
      })

      // 4. Prob Label
      probMarkers.push({
        time: openTrade.open_time as Time,
        position: 'inBar',
        shape: 'circle',
        color: openTrade.direction === 'LONG' ? '#34D178' : '#D8503C',
        text: `${probText} LIVE`,
        size: 0,
      })

      if (candleRef.current) {
        if (slLineRef.current) candleRef.current.removePriceLine(slLineRef.current)
        slLineRef.current = candleRef.current.createPriceLine({
          price: openTrade.stop_loss,
          color: '#D8503C',
          lineWidth: 2,
          lineStyle: 1,
          axisLabelVisible: true,
          title: 'SL',
        })

        if (tpLineRef.current) candleRef.current.removePriceLine(tpLineRef.current)
        if (openTrade.take_profit) {
          tpLineRef.current = candleRef.current.createPriceLine({
            price: openTrade.take_profit,
            color: '#34D178',
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

    arrowSeriesRef.current?.setData(arrowAnchorData.sort((a, b) => (a.time as number) - (b.time as number)))
    labelSeriesRef.current?.setData(labelAnchorData.sort((a, b) => (a.time as number) - (b.time as number)))
    bubbleSeriesRef.current?.setData(bubbleAnchorData.sort((a, b) => (a.time as number) - (b.time as number)))
    probSeriesRef.current?.setData(probAnchorData.sort((a, b) => (a.time as number) - (b.time as number)))

    if (markersRef.current) {
      candleRef.current?.detachPrimitive(markersRef.current)
      markersRef.current = null
    }
    if (arrowMarkersRef.current) {
      arrowSeriesRef.current?.detachPrimitive(arrowMarkersRef.current)
      arrowMarkersRef.current = null
    }
    if (labelMarkersRef.current) {
      labelSeriesRef.current?.detachPrimitive(labelMarkersRef.current)
      labelMarkersRef.current = null
    }
    if (bubbleMarkersRef.current) {
      bubbleSeriesRef.current?.detachPrimitive(bubbleMarkersRef.current)
      bubbleMarkersRef.current = null
    }
    if (probMarkersRef.current) {
      probSeriesRef.current?.detachPrimitive(probMarkersRef.current)
      probMarkersRef.current = null
    }

    // Main candles (Arrows on Line 0)
    if (arrowMarkers.length > 0 && arrowSeriesRef.current) {
        arrowMarkersRef.current = createSeriesMarkers(arrowSeriesRef.current, arrowMarkers.sort((a, b) => (a.time as number) - (b.time as number)))
    }

    // Restore EXIT markers on the main candle series
    if (candleMarkers.length > 0 && candleRef.current) {
        markersRef.current = createSeriesMarkers(candleRef.current, candleMarkers.sort((a, b) => (a.time as number) - (b.time as number)))
    }
    
    // Line 1: Word (BUY/SELL)
    if (labelMarkers.length > 0 && labelSeriesRef.current) {
        labelMarkersRef.current = createSeriesMarkers(labelSeriesRef.current, labelMarkers.sort((a, b) => (a.time as number) - (b.time as number)))
    }

    // Line 2: Bubble (◯)
    if (bubbleMarkers.length > 0 && bubbleSeriesRef.current) {
        bubbleMarkersRef.current = createSeriesMarkers(bubbleSeriesRef.current, bubbleMarkers.sort((a, b) => (a.time as number) - (b.time as number)))
    }

    // Line 3: Prob (%)
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
    <div className="relative w-full overflow-hidden rounded-[1.45rem] border border-[#3D362A] bg-gradient-to-b from-[#1F1B14] to-[#14120E] shadow-[0_18px_45px_rgba(0,0,0,0.4)]">
      <div className="pointer-events-none absolute left-4 top-3 z-10 rounded-full border border-[#3D362A] bg-[#1A1814]/85 px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.18em] text-[#A8A39A]">
        IA Algotrend
      </div>
      <div ref={containerRef} className="h-[500px] w-full" />
    </div>
  )
}
