import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BrokerAdminPanel } from '@/components/brokers/BrokerAdminPanel'
import { BROKER_ADMIN_ROLES, type BrokerAdminRole } from '@/lib/brokers/auth'

export const metadata = { title: 'Administrar conexiones | GONOVI' }
export const dynamic = 'force-dynamic'

export default async function BrokerAdminPage() {
  const supabase = await createClient()
  const [{ data: userData }, { data: aalData }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ])
  if (!userData.user) redirect('/auth?next=/admin/conexiones')
  if (aalData?.currentLevel !== 'aal2') redirect('/cuenta/seguridad?next=/admin/conexiones')
  const role = userData.user.app_metadata?.broker_role as BrokerAdminRole | undefined
  if (!role || !BROKER_ADMIN_ROLES.includes(role)) notFound()
  return <BrokerAdminPanel email={userData.user.email ?? ''} role={role} />
}
