'use client'

import { useRouter, useSearchParams } from 'next/navigation'

interface Props {
  cards: { id: string; label: string }[]
  pin: string
}

export function CardFilter({ cards, pin }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentCard = searchParams.get('card') || ''

  return (
    <select
      value={currentCard}
      onChange={(e) => {
        const val = e.target.value
        if (val) {
          router.push(`/official/analytics/nfc?pin=${pin}&card=${encodeURIComponent(val)}`)
        } else {
          router.push(`/official/analytics/nfc?pin=${pin}`)
        }
      }}
      style={{
        background: 'rgba(28, 34, 58, 0.4)',
        color: '#E5D4B6',
        border: '1px solid rgba(79, 85, 112, 0.6)',
        padding: '0.4rem 0.8rem',
        borderRadius: '6px',
        fontSize: '0.75rem',
        outline: 'none',
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      <option value="">Todas las tarjetas</option>
      {cards.map(c => (
        <option key={c.id} value={c.id}>{c.label}</option>
      ))}
    </select>
  )
}
