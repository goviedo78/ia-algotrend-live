import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { BrokerSecurityPanel } from '@/components/brokers/BrokerSecurityPanel'
import { getSafeRedirectPath } from '@/lib/safe-redirect'

export const metadata = { title: 'Seguridad | GONOVI' }
export const dynamic = 'force-dynamic'

export default async function BrokerSecurityPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getUser()
  const params = await searchParams
  const next = getSafeRedirectPath(params.next, '/cuenta/conexiones')
  if (!data.user) redirect(`/auth?next=${encodeURIComponent(`/cuenta/seguridad?next=${next}`)}`)
  return <BrokerSecurityPanel email={data.user.email ?? ''} nextPath={next} />
}
