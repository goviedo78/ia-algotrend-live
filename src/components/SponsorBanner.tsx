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
      className="block surface-panel overflow-hidden group cursor-pointer border border-[#1F2937] hover:border-[#3B82F6]/50 transition-all duration-300 relative w-full mb-4 xl:mb-0"
    >
      <div className="absolute top-0 right-0 bg-[#3B82F6]/10 px-2.5 py-1 rounded-bl-lg border-b border-l border-[#3B82F6]/20 z-10">
        <p className="text-[9px] uppercase tracking-wider text-[#3B82F6] font-semibold flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6] animate-pulse"></span>
          Partner Oficial
        </p>
      </div>

      <div className="p-4 sm:px-6 sm:py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="w-12 h-12 shrink-0 rounded-xl bg-gradient-to-br from-[#1E293B] to-[#0F172A] border border-[#334155] flex items-center justify-center text-2xl shadow-lg ring-4 ring-[#0F172A]">
            {sponsor.logo}
          </div>
          <div className="flex-1">
            <h4 className="font-bold text-[#E5E7EB] text-lg lg:text-xl group-hover:text-[#3B82F6] transition-colors leading-tight">
              {sponsor.name}
            </h4>
            <p className="text-[#9CA3AF] text-sm mt-0.5">
              {sponsor.tagline}
            </p>
          </div>
        </div>

        <div className="w-full sm:w-auto shrink-0 bg-gradient-to-r from-[#2563EB] to-[#3B82F6] hover:from-[#1D4ED8] hover:to-[#2563EB] text-white text-sm font-semibold px-6 py-2.5 rounded-lg text-center transition-all shadow-md hover:shadow-blue-500/25 whitespace-nowrap">
          {sponsor.cta} →
        </div>
      </div>
    </a>
  )
}
