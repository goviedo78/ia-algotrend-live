'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Image from 'next/image'

interface Props {
  cards: { id: string; label: string }[]
  pin: string
}

export function FloatingLogoFilter({ cards, pin }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentCard = searchParams.get('card') || ''
  const menuRef = useRef<HTMLDivElement>(null)

  // Cerrar el menú si se hace clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const handleSelect = (val: string) => {
    setIsOpen(false)
    if (val) {
      router.push(`/official/analytics/nfc?pin=${pin}&card=${encodeURIComponent(val)}`)
    } else {
      router.push(`/official/analytics/nfc?pin=${pin}`)
    }
  }

  return (
    <div 
      ref={menuRef}
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 100,
      }}
    >
      {/* Menú Desplegable (Hacia Arriba) */}
      <div 
        style={{
          position: 'absolute',
          bottom: '84px',
          right: '0',
          background: 'rgba(13, 17, 34, 0.85)',
          backdropFilter: 'blur(32px) saturate(150%)',
          WebkitBackdropFilter: 'blur(32px) saturate(150%)',
          border: '1px solid rgba(229, 212, 182, 0.15)',
          borderTop: '1px solid rgba(229, 212, 182, 0.3)',
          borderLeft: '1px solid rgba(229, 212, 182, 0.2)',
          borderRadius: '16px',
          padding: '0.5rem',
          display: isOpen ? 'flex' : 'none',
          flexDirection: 'column',
          gap: '0.25rem',
          minWidth: '220px',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255, 255, 255, 0.05)',
          transformOrigin: 'bottom right',
          animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div style={{ 
          padding: '0.5rem', 
          fontSize: '0.75rem', 
          color: '#A8AABA', 
          textTransform: 'uppercase', 
          letterSpacing: '0.1em', 
          borderBottom: '1px solid rgba(255,255,255,0.05)', 
          marginBottom: '0.25rem' 
        }}>
          Filtrar Registros
        </div>
        <button
          onClick={() => handleSelect('')}
          style={{
            background: currentCard === '' ? 'rgba(244, 78, 28, 0.15)' : 'transparent',
            color: currentCard === '' ? '#f44e1c' : '#E5D4B6',
            border: 'none',
            padding: '0.6rem 0.8rem',
            borderRadius: '8px',
            textAlign: 'left',
            cursor: 'pointer',
            fontSize: '0.85rem',
            transition: 'background 0.2s',
            fontWeight: currentCard === '' ? 600 : 400
          }}
          onMouseOver={(e) => {
            if (currentCard !== '') e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
          }}
          onMouseOut={(e) => {
            if (currentCard !== '') e.currentTarget.style.background = 'transparent'
          }}
        >
          Todas las tarjetas
        </button>
        {cards.map(c => (
          <button
            key={c.id}
            onClick={() => handleSelect(c.id)}
            style={{
              background: currentCard === c.id ? 'rgba(244, 78, 28, 0.15)' : 'transparent',
              color: currentCard === c.id ? '#f44e1c' : '#E5D4B6',
              border: 'none',
              padding: '0.6rem 0.8rem',
              borderRadius: '8px',
              textAlign: 'left',
              cursor: 'pointer',
              fontSize: '0.85rem',
              transition: 'background 0.2s',
              fontWeight: currentCard === c.id ? 600 : 400
            }}
            onMouseOver={(e) => {
              if (currentCard !== c.id) e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            }}
            onMouseOut={(e) => {
              if (currentCard !== c.id) e.currentTarget.style.background = 'transparent'
            }}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Botón Flotante con Efecto 3D Bevel */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '68px',
          height: '68px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, rgba(28, 34, 58, 0.85) 0%, rgba(13, 17, 34, 0.95) 100%)',
          backdropFilter: 'blur(24px) saturate(120%)',
          WebkitBackdropFilter: 'blur(24px) saturate(120%)',
          border: '1px solid rgba(229, 212, 182, 0.15)',
          borderTop: '2px solid rgba(229, 212, 182, 0.35)',
          borderLeft: '1px solid rgba(229, 212, 182, 0.25)',
          boxShadow: isOpen 
            ? '0 8px 16px rgba(0, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.1), inset 0 -2px 6px rgba(0, 0, 0, 0.8)'
            : '0 16px 32px rgba(0, 0, 0, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.1), inset 0 -2px 6px rgba(0, 0, 0, 0.8)',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
          padding: 0,
          transition: 'transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.25s ease',
          transform: isOpen ? 'scale(0.92)' : 'scale(1)',
        }}
        onMouseOver={(e) => {
          if (!isOpen) {
            e.currentTarget.style.transform = 'scale(1.05) translateY(-4px)'
            e.currentTarget.style.boxShadow = '0 24px 48px rgba(0, 0, 0, 0.7), inset 0 2px 4px rgba(255, 255, 255, 0.2), inset 0 -2px 6px rgba(0, 0, 0, 0.8)'
          }
        }}
        onMouseOut={(e) => {
          if (!isOpen) {
            e.currentTarget.style.transform = 'scale(1) translateY(0)'
            e.currentTarget.style.boxShadow = '0 16px 32px rgba(0, 0, 0, 0.6), inset 0 2px 4px rgba(255, 255, 255, 0.1), inset 0 -2px 6px rgba(0, 0, 0, 0.8)'
          }
        }}
        title="Filtrar por tarjeta"
      >
        <Image 
          src="/logo-orange-graphite-navy/01-navy-cream-orange-transparent.svg" 
          alt="Filtro" 
          width={36}
          height={36}
          style={{ opacity: 0.95, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.6))', transition: 'transform 0.3s ease' }} 
        />
      </button>
      
      {/* Definición de la animación para el menú */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}} />
    </div>
  )
}
