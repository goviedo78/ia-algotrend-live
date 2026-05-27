'use client'

import { saveCardName, deleteCardName } from '@/app/official/analytics/nfc/actions'

const fieldStyle: React.CSSProperties = {
  background: 'rgba(17, 22, 42, 0.6)',
  border: '1px solid rgba(79, 85, 112, 0.6)',
  color: '#e5d4b6',
  padding: '0.6rem 0.85rem',
  borderRadius: '8px',
  fontFamily: 'inherit',
  fontSize: '0.85rem',
  outline: 'none',
  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)',
}

const buttonStyle: React.CSSProperties = {
  background: 'rgba(244, 78, 28, 0.2)',
  color: '#FF8A60',
  border: '1px solid rgba(244, 78, 28, 0.32)',
  borderTop: '1px solid rgba(255, 138, 96, 0.4)',
  padding: '0.6rem 1.2rem',
  borderRadius: '8px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.85rem',
  boxShadow: '0 4px 16px rgba(244, 78, 28, 0.2), inset 0 1px 0 rgba(255, 138, 96, 0.22)',
}

const dangerButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'rgba(244, 78, 28, 0.8)',
  border: '1px solid rgba(244, 78, 28, 0.3)',
  padding: '0.25rem 0.6rem',
  borderRadius: '6px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.7rem',
}

interface Props {
  pin: string
  named: Array<{ card_id: string; name: string; redirect_url: string | null }>
}

export function CardNameForm({ pin, named }: Props) {
  return (
    <section
        style={{
          background: 'rgba(28, 34, 58, 0.35)',
          border: '1px solid rgba(79, 85, 112, 0.4)',
          borderRadius: '16px',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: 'inset 0 1px 0 rgba(229, 212, 182, 0.05), 0 12px 32px -8px rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
        }}
    >
      <h2
        style={{
          color: '#ff8a60',
          fontSize: '0.9rem',
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          marginBottom: '0.75rem',
        }}
      >
        Nombres de tarjetas
      </h2>
      <p style={{ opacity: 0.55, fontSize: '0.8rem', marginBottom: '1rem' }}>
        Asociá un nombre legible a cada código corto. Si lo guardás, la tabla de abajo lo muestra en lugar del código.
      </p>

      <form action={saveCardName} style={{ display: 'grid', gap: '0.5rem', marginBottom: named.length ? '1.25rem' : 0 }}>
        <input type="hidden" name="pin" value={pin} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            name="card_id"
            placeholder="Código (ej: b1)"
            required
            maxLength={32}
            pattern="[a-zA-Z0-9_-]{1,32}"
            style={{ ...fieldStyle, width: '160px' }}
          />
          <input
            name="name"
            placeholder="Nombre (ej: Personal LinkedIn)"
            required
            maxLength={80}
            style={{ ...fieldStyle, flex: '1', minWidth: '220px' }}
          />
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            name="redirect_url"
            placeholder="Destino opcional. Ej: https://youtube.com/@gonovi o /official"
            maxLength={500}
            style={{ ...fieldStyle, flex: '1', minWidth: '220px' }}
          />
          <button type="submit" style={buttonStyle}>Guardar</button>
        </div>
        <p style={{ opacity: 0.45, fontSize: '0.72rem', marginTop: '0.1rem' }}>
          Si dejás vacío el destino, la tarjeta abre la muestra privada de GONOVI. También acepta URLs externas o rutas internas.
        </p>
      </form>

      {named.length > 0 && (
        <div style={{ display: 'grid', gap: '0.4rem' }}>
          {named.map((row) => (
            <div
              key={row.card_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.6rem 0.8rem',
                background: 'rgba(17, 22, 42, 0.4)',
                border: '1px solid rgba(79, 85, 112, 0.3)',
                borderRadius: '8px',
                fontSize: '0.82rem',
              }}
            >
              <span
                style={{
                  background: 'rgba(244, 78, 28, 0.15)',
                  border: '1px solid rgba(244, 78, 28, 0.3)',
                  color: '#FF8A60',
                  padding: '0.15rem 0.45rem',
                  borderRadius: '4px',
                  fontWeight: 700,
                  fontSize: '0.75rem',
                  minWidth: '40px',
                  textAlign: 'center',
                }}
              >
                {row.card_id}
              </span>
              <span style={{ flex: '0 0 auto', minWidth: '140px' }}>{row.name}</span>
              <span style={{ flex: 1, opacity: row.redirect_url ? 0.8 : 0.35, fontSize: '0.74rem', wordBreak: 'break-all' }}>
                → {row.redirect_url ?? 'muestra privada GONOVI'}
              </span>
              <form action={deleteCardName}>
                <input type="hidden" name="pin" value={pin} />
                <input type="hidden" name="card_id" value={row.card_id} />
                <button type="submit" style={dangerButtonStyle} aria-label={`Borrar ${row.card_id}`}>borrar</button>
              </form>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
