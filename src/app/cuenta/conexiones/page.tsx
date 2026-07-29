import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BrokerConnectionsPanel } from '@/components/brokers/BrokerConnectionsPanel'

export const metadata = { title: 'Conexiones | GONOVI' }
export const dynamic = 'force-dynamic'

export default async function BrokerConnectionsPage() {
  const supabase = await createClient()
  const [{ data: userData }, { data: aalData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ])
  if (!userData.user) redirect('/auth?next=/cuenta/conexiones')
  if (aalData?.currentLevel !== 'aal2') redirect('/cuenta/seguridad?next=/cuenta/conexiones')
  return <BrokerConnectionsPanel email={userData.user.email ?? ''} />
}
