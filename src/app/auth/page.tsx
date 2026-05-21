import { notFound } from 'next/navigation'
import { AuthForm } from '@/components/auth/AuthForm'
import shellStyles from '@/components/official/official-home.module.css'

export const metadata = {
  title: 'Iniciar sesión | GONOVI',
  description: 'Acceso con código por email, sin contraseña.',
}

export const dynamic = 'force-dynamic'

export default function AuthPage() {
  if (process.env.OFFICIAL_ENABLED !== 'true') {
    notFound()
  }

  return (
    <main className={shellStyles.shell}>
      <div className={shellStyles.noise} />
      <AuthForm />
    </main>
  )
}
