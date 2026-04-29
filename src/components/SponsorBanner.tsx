'use client'

import { useEffect, useRef } from 'react'

export default function SponsorBanner() {
  const sponsor = {
    name: 'Broker Partner',
    tagline: 'Opera nuestras señales con comisión 0%',
    url: '#',
    logo: '🏦',
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
      className="block surface-panel overflow-hidden group cursor-pointer border border-[#4F5570] hover:border-[#F44E1C]/50 transition-all duration-300 relative w-full mb-4 xl:mb-0"
    >
      <div className="absolute top-0 right-0 bg-[#F44E1C]/10 px-2.5 py-1 rounded-bl-lg border-b border-l border-[#F44E1C]/20 z-10">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#F44E1C] font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#F44E1C] animate-pulse"></span>
          Partner Oficial
        </p>
      </div>

      <div className="p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-[#2A3148] to-[#1C223A] border border-[#4F5570] flex items-center justify-center text-2xl shadow-lg ring-4 ring-[#161C30]">
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

        <div className="w-full sm:w-auto shrink-0 bg-gradient-to-r from-[#D43D10] to-[#F44E1C] hover:from-[#A82F08] hover:to-[#D43D10] text-[#E5D4B6] text-sm font-semibold px-6 py-2.5 rounded-lg text-center transition-all shadow-md hover:shadow-[0_0_24px_rgba(244,78,28,0.32)] whitespace-nowrap">
          {sponsor.cta} →
        </div>
      </div>
    </a>
  )
}
