'use client'

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

export function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  return (
    <button
      onClick={() => startTransition(() => router.refresh())}
      disabled={isPending}
      style={{
        background: 'rgba(240,236,228,0.05)',
        border: '1px solid rgba(240,236,228,0.15)',
        color: '#F0ECE4',
        padding: '0.4rem 0.8rem',
        borderRadius: '4px',
        fontSize: '0.75rem',
        fontFamily: 'var(--font-mono, ui-monospace, monospace)',
        cursor: isPending ? 'wait' : 'pointer',
        opacity: isPending ? 0.5 : 1,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        transition: 'all 0.2s ease',
      }}
      onMouseOver={(e) => {
        if (!isPending) {
          e.currentTarget.style.background = 'rgba(240,236,228,0.1)'
          e.currentTarget.style.borderColor = 'rgba(240,236,228,0.3)'
        }
      }}
      onMouseOut={(e) => {
        if (!isPending) {
          e.currentTarget.style.background = 'rgba(240,236,228,0.05)'
          e.currentTarget.style.borderColor = 'rgba(240,236,228,0.15)'
        }
      }}
    >
      {isPending ? 'Refrescando...' : '↻ Actualizar Datos'}
    </button>
  )
}
