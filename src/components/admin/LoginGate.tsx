'use client'

import { useState } from 'react'

export default function LoginGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/dashboard/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })
      if (res.ok) {
        setAuthed(true)
      } else {
        setError('Contraseña incorrecta')
      }
    } catch {
      setError('Error de conexión')
    }
    setLoading(false)
  }

  if (authed) return <>{children}</>

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm rounded-2xl border border-[#1F2937] p-8 space-y-6"
        style={{ background: 'rgba(17,24,39,0.85)', backdropFilter: 'blur(20px)' }}
      >
        <div className="text-center space-y-2">
          <div className="text-4xl">🔒</div>
          <h1 className="text-xl font-bold text-white font-[var(--font-syne)]">AlgoTrend Admin</h1>
          <p className="text-sm text-[#9CA3AF]">Ingresá tu contraseña para acceder</p>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Contraseña"
          autoFocus
          className="w-full rounded-xl bg-[#0B1220] border border-[#1F2937] px-4 py-3 text-white placeholder:text-[#6B7280] focus:outline-none focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] transition-colors font-mono"
        />

        {error && (
          <p className="text-sm text-red-400 text-center">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading || !password}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-white font-semibold text-sm hover:from-[#1D4ED8] hover:to-[#2563EB] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-lg hover:shadow-blue-500/25"
        >
          {loading ? 'Verificando…' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
