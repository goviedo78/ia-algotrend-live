'use client'

import { useState, useRef } from 'react'
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
  borderTopColor: 'rgba(255, 138, 96, 0.4)',
  padding: '0.6rem 1.2rem',
  borderRadius: '8px',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.85rem',
  boxShadow: '0 4px 16px rgba(244, 78, 28, 0.2), inset 0 1px 0 rgba(255, 138, 96, 0.22)',
  transition: 'all 0.2s',
}

const secondaryButtonStyle: React.CSSProperties = {
  background: 'rgba(79, 85, 112, 0.2)',
  color: '#E5D4B6',
  border: '1px solid rgba(79, 85, 112, 0.5)',
  padding: '0.25rem 0.6rem',
  borderRadius: '6px',
  cursor: 'pointer',
  fontFamily: 'inherit',
  fontSize: '0.7rem',
  transition: 'all 0.2s',
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
  transition: 'all 0.2s',
}

interface Props {
  pin: string
  named: Array<{ card_id: string; name: string; redirect_url: string | null; color?: string | null }>
}

export function CardNameForm({ pin, named }: Props) {
  const [formData, setFormData] = useState({ card_id: '', name: '', redirect_url: '', color: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  const isEditing = named.some(n => n.card_id === formData.card_id)

  const handleEdit = (row: typeof named[0]) => {
    setFormData({
      card_id: row.card_id,
      name: row.name,
      redirect_url: row.redirect_url || '',
      color: row.color || ''
    })
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const nameInput = formRef.current?.querySelector('input[name="name"]') as HTMLInputElement
    if (nameInput) nameInput.focus()
  }

  const handleCancel = () => {
    setFormData({ card_id: '', name: '', redirect_url: '', color: '' })
  }

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    const data = new FormData(e.currentTarget)
    await saveCardName(data)
    setFormData({ card_id: '', name: '', redirect_url: '', color: '' })
    setIsSubmitting(false)
  }

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
        Tarjetas Personalizadas
      </h2>
      <p style={{ opacity: 0.55, fontSize: '0.8rem', marginBottom: '1rem' }}>
        Asocia un nombre legible a cada código corto físico o cambia su URL de destino y color.
      </p>

      <form ref={formRef} onSubmit={onSubmit} style={{ display: 'grid', gap: '0.5rem', marginBottom: named.length ? '1.25rem' : 0 }}>
        <input type="hidden" name="pin" value={pin} />
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            name="card_id"
            placeholder="Código (ej: b1)"
            required
            maxLength={32}
            pattern="[a-zA-Z0-9_-]{1,32}"
            value={formData.card_id}
            onChange={e => setFormData({ ...formData, card_id: e.target.value })}
            style={{ ...fieldStyle, width: '160px', opacity: isEditing ? 0.6 : 1 }}
            readOnly={isEditing}
            title={isEditing ? "El código físico no se puede editar. Crea uno nuevo si necesitas." : ""}
          />
          <input
            name="name"
            placeholder="Nombre (ej: Personal LinkedIn)"
            required
            maxLength={80}
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            style={{ ...fieldStyle, flex: '1', minWidth: '180px' }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', background: 'rgba(17, 22, 42, 0.6)', padding: '0 0.5rem', borderRadius: '8px', border: '1px solid rgba(79, 85, 112, 0.6)' }}>
            <span style={{ fontSize: '0.75rem', color: '#e5d4b6', opacity: 0.8 }}>Color</span>
            <input
              type="color"
              name="color"
              value={formData.color || '#f44e1c'}
              onChange={e => setFormData({ ...formData, color: e.target.value })}
              style={{ width: '28px', height: '28px', padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
              title="Color de la tarjeta"
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input
            name="redirect_url"
            placeholder="Destino opcional. Ej: https://youtube.com/@gonovi o /official"
            maxLength={500}
            value={formData.redirect_url}
            onChange={e => setFormData({ ...formData, redirect_url: e.target.value })}
            style={{ ...fieldStyle, flex: '1', minWidth: '220px' }}
          />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={isSubmitting} style={{ ...buttonStyle, opacity: isSubmitting ? 0.5 : 1 }}>
              {isSubmitting ? 'Guardando...' : (isEditing ? 'Actualizar' : 'Crear nueva')}
            </button>
            {formData.card_id !== '' && (
              <button type="button" onClick={handleCancel} style={{ ...buttonStyle, background: 'rgba(79, 85, 112, 0.3)', borderColor: 'rgba(79, 85, 112, 0.5)', borderTopColor: 'rgba(79, 85, 112, 0.6)', color: '#E5D4B6', boxShadow: 'none' }}>
                Cancelar
              </button>
            )}
          </div>
        </div>
        <p style={{ opacity: 0.45, fontSize: '0.72rem', marginTop: '0.1rem' }}>
          Si dejas vacío el destino, la tarjeta abre el perfil por defecto.
        </p>
      </form>

      {named.length > 0 && (
        <div style={{ display: 'grid', gap: '0.5rem' }}>
          {named.map((row) => (
            <div
              key={row.card_id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.6rem 0.8rem',
                background: formData.card_id === row.card_id ? 'rgba(244, 78, 28, 0.08)' : 'rgba(17, 22, 42, 0.4)',
                border: formData.card_id === row.card_id ? '1px solid rgba(244, 78, 28, 0.3)' : '1px solid rgba(79, 85, 112, 0.3)',
                borderRadius: '8px',
                fontSize: '0.82rem',
                transition: 'all 0.2s',
              }}
            >
              <span
                style={{
                  background: row.color ? `${row.color}25` : 'rgba(244, 78, 28, 0.15)',
                  border: `1px solid ${row.color ? `${row.color}50` : 'rgba(244, 78, 28, 0.3)'}`,
                  color: row.color || '#FF8A60',
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
              <div style={{ flex: 1, display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, color: row.color || 'inherit' }}>{row.name}</span>
                <span style={{ opacity: row.redirect_url ? 0.7 : 0.35, fontSize: '0.74rem', wordBreak: 'break-all' }}>
                  → {row.redirect_url ?? 'Muestra nativa'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button type="button" onClick={() => handleEdit(row)} style={secondaryButtonStyle} aria-label={`Editar ${row.card_id}`}>
                  Editar
                </button>
                <form action={deleteCardName} onSubmit={(e) => {
                  if (!window.confirm(`¿Seguro que deseas borrar la tarjeta ${row.card_id}?`)) e.preventDefault()
                }}>
                  <input type="hidden" name="pin" value={pin} />
                  <input type="hidden" name="card_id" value={row.card_id} />
                  <button type="submit" style={dangerButtonStyle} aria-label={`Borrar ${row.card_id}`}>
                    Borrar
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
