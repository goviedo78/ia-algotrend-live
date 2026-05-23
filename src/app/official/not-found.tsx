import Link from 'next/link'

export default function NotFound() {
  return (
    <main
      style={{
        height: '100svh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        textAlign: 'center',
        padding: '2rem',
        background:
          'radial-gradient(circle at 20% 20%, rgba(244,78,28,0.12), transparent 30rem), linear-gradient(180deg, #1c223a 0%, #11162a 44%, #0d1122 100%)',
        color: '#ffffff',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      <div
        style={{
          fontSize: '0.7rem',
          color: '#e5d4b6',
          opacity: 0.5,
          letterSpacing: '0.15em',
          fontWeight: 500,
          marginBottom: '-0.5rem',
        }}
      >
        RUTA NO ENCONTRADA
      </div>

      <h1
        style={{
          fontSize: '10rem',
          color: '#f44e1c',
          fontWeight: 700,
          margin: 0,
          lineHeight: 1,
        }}
      >
        404
      </h1>

      <h2
        style={{
          fontSize: 'clamp(1.4rem, 2vw, 2rem)',
          color: '#ffffff',
          fontWeight: 600,
          margin: 0,
        }}
      >
        Esta señal no existe.
      </h2>

      <p
        style={{
          fontSize: '0.9rem',
          color: '#a8aaba',
          maxWidth: '20rem',
          margin: '0 0 1rem 0',
        }}
      >
        Puede que la ruta haya cambiado o aún no esté disponible.
      </p>

      <Link
        href="/official"
        style={{
          border: '1px solid rgba(244,78,28,0.4)',
          padding: '0.7rem 1.6rem',
          borderRadius: '0.6rem',
          color: '#e5d4b6',
          background: 'rgba(244,78,28,0.08)',
          textDecoration: 'none',
          fontSize: '0.9rem',
          fontWeight: 500,
        }}
      >
        Volver al Inicio
      </Link>
    </main>
  )
}
