'use client'

import { useEffect, useRef } from 'react'

interface Props {
  data: Array<{ time: number; balance: number }>
}

export default function EquityChart({ data }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof import('lightweight-charts').createChart> | null>(null)

  useEffect(() => {
    if (!containerRef.current || data.length < 2) return

    let cancelled = false

    import('lightweight-charts').then(({ createChart, ColorType, AreaSeries }) => {
      if (cancelled || !containerRef.current) return

      // Clean up previous chart
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }

      const chart = createChart(containerRef.current, {
        width: containerRef.current.clientWidth,
        height: 200,
        layout: {
          background: { type: ColorType.Solid, color: 'transparent' },
          textColor: '#6B7280',
          fontSize: 10,
        },
        grid: {
          vertLines: { color: 'rgba(31,41,55,0.5)' },
          horzLines: { color: 'rgba(31,41,55,0.5)' },
        },
        rightPriceScale: {
          borderVisible: false,
        },
        timeScale: {
          borderVisible: false,
          timeVisible: false,
        },
        crosshair: {
          horzLine: { color: '#3B82F6', width: 1 },
          vertLine: { color: '#3B82F6', width: 1 },
        },
      })

      chartRef.current = chart

      const areaSeries = chart.addSeries(AreaSeries, {
        lineColor: '#3B82F6',
        topColor: 'rgba(59,130,246,0.3)',
        bottomColor: 'rgba(59,130,246,0.02)',
        lineWidth: 2,
      })

      // Convert timestamps to dates
      const chartData = data
        .filter(d => d.time > 0)
        .map(d => ({
          time: (d.time > 1e12 ? d.time / 1000 : d.time) as import('lightweight-charts').UTCTimestamp,
          value: d.balance,
        }))

      if (chartData.length > 0) {
        areaSeries.setData(chartData)
        chart.timeScale().fitContent()
      }

      // Resize observer
      const ro = new ResizeObserver(() => {
        if (containerRef.current) {
          chart.applyOptions({ width: containerRef.current.clientWidth })
        }
      })
      ro.observe(containerRef.current)

      return () => {
        ro.disconnect()
        chart.remove()
      }
    })

    return () => {
      cancelled = true
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [data])

  return <div ref={containerRef} className="w-full" />
}
