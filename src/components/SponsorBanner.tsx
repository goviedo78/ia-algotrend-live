'use client'

import { useEffect, useRef } from 'react'

export default function SponsorBanner() {
  const sponsor = {
    name: 'Broker Partner',
    tagline: 'Opera nuestras señales con comisión 0%',
    url: '#',
    logo: 'AT',
    cta: 'Abrir cuenta con bono'
  }

  const tracked = useRef(false)

  // Track impression once
  useEffect(() => {
    if (tracked.current) return
    tracked.current = true
    fetch('/api/analytics/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: '/sponsor/impression' }),
    }).catch(() => {})
    // Also log event server-side
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'sponsor_impression' }),
    }).catch(() => {})
  }, [])

  const handleClick = () => {
    fetch('/api/analytics/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'sponsor_click' }),
    }).catch(() => {})
  }

  return (
    <a
      href={sponsor.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={handleClick}
      className="group relative mb-4 block w-full cursor-pointer overflow-hidden rounded-xl border border-[#4F5570] bg-[#1C223A] transition-all duration-300 hover:border-[#F44E1C]/50 xl:mb-0"
    >
      <div className="absolute top-0 right-0 bg-[#F44E1C]/10 px-2.5 py-1 rounded-bl-lg border-b border-l border-[#F44E1C]/20 z-10">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#F44E1C] font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F44E1C] animate-pulse"></span>
          Partner Oficial
        </p>
      </div>

      <div className="p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-[#4F5570] bg-gradient-to-br from-[#C9A87A] to-[#9A7E54] font-display text-sm font-bold tracking-[0.08em] text-[#11162A] shadow-lg ring-4 ring-[#11162A]">
            {sponsor.logo}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-[#E5D4B6] text-lg lg:text-xl group-hover:text-[#F44E1C] transition-colors leading-tight">
              {sponsor.name}
            </h4>
            <p className="text-[#A8AABA] text-sm mt-0.5">
              {sponsor.tagline}
            </p>
          </div>
        </div>

        <div className="w-full shrink-0 whitespace-nowrap rounded-lg bg-gradient-to-r from-[#D43D10] to-[#F44E1C] px-6 py-2.5 text-center text-sm font-semibold text-[#E5D4B6] shadow-md transition-all hover:from-[#A82F08] hover:to-[#D43D10] hover:shadow-[0_0_24px_rgba(244,78,28,0.32)] sm:w-auto">
          {sponsor.cta} →
        </div>
      </div>
    </a>
  )
}
