'use client'

import { saveCardName, deleteCardName } from '@/app/official/analytics/nfc/actions'

const fieldStyle: React.CSSProperties = {
  background: 'rgba(229,212,182,0.05)',
  border: '1px solid rgba(229,212,182,0.2)',
  color: '#e5d4b6',
  padding: '0.5rem 0.75rem',
  borderRadius: '4px',
  fontFamily: 'inherit',
  fontSize: '0.85rem',
}

const buttonStyle: React.CSSProperties = {
  background: '#ff8a60',
  color: '#0d1122',
  border: 'none',
  padding: '0.5rem 1rem',
  borderRadius: '4px',
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.85rem',
}

const dangerButtonStyle: React.CSSProperties = {
  background: 'transparent',
  color: '#f44e1c',
  border: '1px solid rgba(244,78,28,0.4)',
  padding: '0.25rem 0.6rem',
  borderRadius: '4px',
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
        background: 'rgba(229,212,182,0.04)',
        border: '1px solid rgba(229,212,182,0.1)',
        borderRadius: '8px',
        padding: '1.25rem',
        marginBottom: '2rem',
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
            placeholder="URL de redirección (opcional, dejar vacío = landing). Ej: https://linkedin.com/in/gonzalo o /official/montecarlo"
            maxLength={500}
            style={{ ...fieldStyle, flex: '1', minWidth: '220px' }}
          />
          <button type="submit" style={buttonStyle}>Guardar</button>
        </div>
        <p style={{ opacity: 0.45, fontSize: '0.72rem', marginTop: '0.1rem' }}>
          Si dejás vacío el campo de URL, la tarjeta lleva al landing (<code>/?dev=...</code>). También aceptamos URLs externas (https://…) o rutas internas (/algo).
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
                padding: '0.4rem 0.6rem',
                background: 'rgba(229,212,182,0.03)',
                borderRadius: '4px',
                fontSize: '0.82rem',
              }}
            >
              <span
                style={{
                  background: '#ff8a60',
                  color: '#0d1122',
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
                → {row.redirect_url ?? 'landing (default)'}
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
