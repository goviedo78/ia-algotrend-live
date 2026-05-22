import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { AccountPanel } from '@/components/auth/AccountPanel'
import shellStyles from '@/components/official/official-home.module.css'

export const metadata = {
  title: 'Mi cuenta | GONOVI',
}

export const dynamic = 'force-dynamic'

export default async function AccountPage() {
  let user = null;
  let supportTicketsCount = 0;

  try {
    // Attempt to load the user using the server client that Codex is building.
    // If it throws or fails to import, we will catch it and either mock it or redirect.
    const supabase = await createServerClient()
    const { data } = await supabase.auth.getUser()
    user = data.user

    if (user) {
      const { count } = await supabase
        .from('gonovi_support_tickets')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'open')

      supportTicketsCount = count ?? 0
    }
  } catch {
    console.warn('[Account UI] Auth API is not ready yet, using mock user for UI development.')
    // Para que la UI se pueda probar (screenshots) mientras Codex hace la infra,
    // injectamos un mock de usuario solo si estamos en modo dev y falla el server client.
    if (process.env.NODE_ENV === 'development') {
      user = { id: 'mock-123', email: 'trader@gonovi.app' }
    }
  }

  if (!user) {
    redirect('/auth')
  }

  return (
    <main className={shellStyles.shell}>
      <div className={shellStyles.noise} />
      <AccountPanel user={{ id: user.id, email: user.email! }} supportTicketsCount={supportTicketsCount} />
    </main>
  )
}
