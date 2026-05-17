'use client'

interface Props {
  email: string
  productName: string
  onClose: () => void
}

export default function OrderConfirmModal({ email, productName, onClose }: Props) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        style={{
          background: '#11162a',
          border: '1px solid rgba(244,78,28,0.3)',
          borderRadius: '1rem',
          padding: '2rem',
          maxWidth: '420px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.75rem',
          textAlign: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Icono check */}
        <div
          style={{
            width: '3rem', height: '3rem',
            borderRadius: '50%',
            background: '#f44e1c',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', color: '#fff', fontWeight: 700,
          }}
        >
          ✓
        </div>

        <h2 style={{ margin: 0, color: '#fff', fontSize: '1.4rem', fontWeight: 600 }}>
          Pago recibido
        </h2>

        <p style={{ margin: 0, color: '#a8aaba', fontSize: '0.9rem', maxWidth: '300px' }}>
          Recibirás el script en <strong style={{ color: '#e5d4b6' }}>{email}</strong> en menos de 24 horas.
        </p>

        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', width: '100%', margin: '0.25rem 0' }} />

        <p style={{ margin: 0, color: '#ffffff', fontSize: '0.85rem', opacity: 0.7 }}>
          {productName}
        </p>

        <button
          onClick={() => { window.location.href = '/official/dashboard' }}
          style={{
            marginTop: '0.25rem',
            background: '#f44e1c', color: '#fff',
            border: 'none', borderRadius: '0.5rem',
            padding: '0.7rem 1.4rem',
            fontWeight: 600, fontSize: '0.95rem',
            cursor: 'pointer', width: '100%',
          }}
        >
          Ir a mi Dashboard
        </button>

        <button
          onClick={onClose}
          style={{
            background: 'none', border: 'none',
            color: '#a8aaba', fontSize: '0.85rem',
            cursor: 'pointer', padding: '0.25rem',
          }}
        >
          Cerrar
        </button>
      </div>
    </div>
  )
}
