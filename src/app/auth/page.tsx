import { AuthForm } from '@/components/auth/AuthForm'
import shellStyles from '@/components/official/official-home.module.css'
import { getSafeRedirectPath } from '@/lib/safe-redirect'

export const metadata = {
  title: 'Iniciar sesión | GONOVI',
  description: 'Acceso con código por email, sin contraseña.',
}

export const dynamic = 'force-dynamic'

export default async function AuthPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const params = await searchParams
  const nextPath = getSafeRedirectPath(params.next, '/account')

  return (
    <main className={shellStyles.shell}>
      <div className={shellStyles.noise} />
      <AuthForm nextPath={nextPath} />
    </main>
  )
}
