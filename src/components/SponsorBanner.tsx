'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'

const GUMROAD_URL = 'https://gonovi.gumroad.com/l/ia'

export default function SponsorBanner() {
  const tracked = useRef(false)

  useEffect(() => {
    if (tracked.current) return
    tracked.current = true
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'gumroad_impression' }),
    }).catch(() => {})
  }, [])

  const handleClick = () => {
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'gumroad_click' }),
      keepalive: true,
    }).catch(() => {})
  }

  return (
    <a
      href={GUMROAD_URL}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      aria-label="Obtener el indicador completo IA AlgoTrend en Gumroad"
      className="group relative block w-full cursor-pointer overflow-hidden rounded-xl border border-[#3a2a1a] bg-[#0a0610] transition-all duration-300 hover:border-[#F44E1C]/70 hover:shadow-[0_0_24px_rgba(244,78,28,0.25)]"
    >
      <div className="relative flex h-[112px] items-center justify-between gap-3 px-4 sm:hidden">
        <Image
          src="/ia-algotrend-strip.png"
          alt=""
          fill
          className="scale-150 object-cover object-center opacity-30"
          sizes="(max-width: 639px) 92vw, 1px"
          priority
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(1,18,46,0.94)_0%,rgba(5,8,20,0.82)_48%,rgba(49,8,5,0.9)_100%)]" />
        <div className="relative z-10 min-w-0 flex-1">
          <span className="font-mono text-[8px] font-semibold uppercase tracking-[0.24em] text-[#71B7FF]">
            AI powered
          </span>
          <strong className="mt-1 flex items-center gap-1.5 whitespace-nowrap text-[20px] font-black leading-none tracking-[-0.04em] text-white">
            IA ALGOTREND <span aria-hidden className="text-[19px]">🤖</span>
          </strong>
          <span className="mt-2 block whitespace-nowrap font-mono text-[8px] font-semibold uppercase tracking-[0.1em] text-[#F6C85F]">
            SMART AI TREND DETECTION
          </span>
        </div>
        <span className="relative z-10 inline-flex max-w-[118px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-r from-[#D43D10] to-[#F44E1C] px-3 py-2 text-center text-[10px] font-bold leading-tight text-white shadow-[0_0_18px_rgba(244,78,28,0.35)]">
          Indicador COMPLETO
          <span aria-hidden className="ml-1">-&gt;</span>
        </span>
      </div>

      <div className="hidden h-[80px] items-center justify-between sm:flex">
        <div className="pointer-events-none absolute bottom-2 left-3 top-2 z-10 hidden w-[190px] flex-col justify-center rounded-lg border border-white/10 bg-black/25 px-3 shadow-[0_10px_24px_rgba(0,0,0,0.25)] backdrop-blur-[2px] sm:flex lg:w-[220px]">
          <span className="font-mono text-[9px] font-semibold uppercase tracking-[0.2em] text-[#F44E1C]">
            Indicador premium
          </span>
          <span className="mt-1 text-[13px] font-bold leading-tight text-white">
            IA AlgoTrend completo
          </span>
          <span className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-white/60">
            5 versiones + pago unico
          </span>
        </div>

        <div className="relative h-full flex-1">
          <Image
            src="/ia-algotrend-strip.png"
            alt="IA AlgoTrend - Real-time analysis, AI-powered insights, smart alerts and accurate predictions"
            fill
            className="object-contain object-left px-3 py-1.5 sm:object-center sm:px-4 sm:py-2"
            sizes="(max-width: 768px) 70vw, 50vw"
            priority
          />
        </div>

        <div className="shrink-0 pr-3 sm:pr-4">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-gradient-to-r from-[#D43D10] to-[#F44E1C] px-3 py-1.5 text-[11px] font-semibold text-white shadow-md transition-all group-hover:from-[#A82F08] group-hover:to-[#D43D10] group-hover:shadow-[0_0_20px_rgba(244,78,28,0.35)] sm:px-4 sm:text-xs">
            Indicador COMPLETO
            <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-0.5">-&gt;</span>
          </span>
        </div>
      </div>
    </a>
  )
}
