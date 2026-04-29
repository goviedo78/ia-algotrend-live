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
      className="block surface-panel overflow-hidden group cursor-pointer border border-[#3D362A] hover:border-[#D8503C]/50 transition-all duration-300 relative w-full mb-4 xl:mb-0"
    >
      <div className="absolute top-0 right-0 bg-[#D8503C]/10 px-2.5 py-1 rounded-bl-lg border-b border-l border-[#D8503C]/20 z-10">
        <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#D8503C] font-medium flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#D8503C] animate-pulse"></span>
          Partner Oficial
        </p>
      </div>

      <div className="p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-[#2A2620] to-[#1A1814] border border-[#3D362A] flex items-center justify-center text-2xl shadow-lg ring-4 ring-[#14120E]">
            {sponsor.logo}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-[#F4F1EA] text-lg lg:text-xl group-hover:text-[#D8503C] transition-colors leading-tight">
              {sponsor.name}
            </h4>
            <p className="text-[#A8A39A] text-sm mt-0.5">
              {sponsor.tagline}
            </p>
          </div>
        </div>

        <div className="w-full sm:w-auto shrink-0 bg-gradient-to-r from-[#B83E2C] to-[#D8503C] hover:from-[#8E2E1F] hover:to-[#B83E2C] text-[#F4F1EA] text-sm font-semibold px-6 py-2.5 rounded-lg text-center transition-all shadow-md hover:shadow-[0_0_24px_rgba(216,80,60,0.3)] whitespace-nowrap">
          {sponsor.cta} →
        </div>
      </div>
    </a>
  )
}
