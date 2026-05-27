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
        background: 'rgba(28, 34, 58, 0.4)',
        border: '1px solid rgba(79, 85, 112, 0.6)',
        color: '#E5D4B6',
        padding: '0.4rem 0.8rem',
        borderRadius: '6px',
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
          e.currentTarget.style.background = 'rgba(42, 49, 72, 0.6)'
          e.currentTarget.style.borderColor = 'rgba(244, 78, 28, 0.4)'
        }
      }}
      onMouseOut={(e) => {
        if (!isPending) {
          e.currentTarget.style.background = 'rgba(28, 34, 58, 0.4)'
          e.currentTarget.style.borderColor = 'rgba(79, 85, 112, 0.6)'
        }
      }}
    >
      {isPending ? 'Refrescando...' : '↻ Actualizar Datos'}
    </button>
  )
}
