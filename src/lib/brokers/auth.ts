import 'server-only'

import type { NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { BrokerPlatformError } from './errors'

export const BROKER_ADMIN_ROLES = ['admin_readonly', 'broker_operator', 'security_admin'] as const
export type BrokerAdminRole = (typeof BROKER_ADMIN_ROLES)[number]

function userRole(user: User): BrokerAdminRole | null {
  const role = user.app_metadata?.broker_role
  return BROKER_ADMIN_ROLES.includes(role) ? role : null
}

export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) {
    if (process.env.NODE_ENV === 'production') {
      throw new BrokerPlatformError('ORIGIN_REQUIRED', 'Origen de solicitud inválido.', 403)
    }
    return
  }
  let parsedOrigin: URL
  try {
    parsedOrigin = new URL(origin)
  } catch {
    throw new BrokerPlatformError('ORIGIN_DENIED', 'Origen de solicitud inválido.', 403)
  }
  if (parsedOrigin.origin !== request.nextUrl.origin) {
    throw new BrokerPlatformError('ORIGIN_DENIED', 'Origen de solicitud inválido.', 403)
  }
}

export async function requireAal2User() {
  const supabase = await createClient()
  const [{ data: userData, error: userError }, { data: aalData, error: aalError }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ])

  if (userError || !userData.user) {
    throw new BrokerPlatformError('AUTH_REQUIRED', 'Tenés que iniciar sesión.', 401)
  }
  if (aalError || aalData.currentLevel !== 'aal2') {
    throw new BrokerPlatformError('MFA_REQUIRED', 'Esta sección requiere verificación en dos pasos.', 403)
  }

  return { user: userData.user, role: userRole(userData.user), supabase }
}

export async function requireBrokerMember(options: { allowPending?: boolean } = {}) {
  const auth = await requireAal2User()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('broker_memberships')
    .select('status')
    .eq('user_id', auth.user.id)
    .maybeSingle()

  if (error) throw new BrokerPlatformError('MEMBERSHIP_LOOKUP_FAILED', 'No se pudo verificar el acceso.', 503, true)
  if (!data) throw new BrokerPlatformError('MEMBERSHIP_REQUIRED', 'Solicitá acceso antes de conectar un broker.', 403)
  if (!options.allowPending && data.status !== 'ACTIVE') {
    throw new BrokerPlatformError('MEMBERSHIP_INACTIVE', 'El acceso a brokers todavía no está activo.', 403)
  }

  return { ...auth, membershipStatus: String(data.status) }
}

export async function requireBrokerAdmin(allowedRoles: BrokerAdminRole[]) {
  const auth = await requireAal2User()
  if (!auth.role || !allowedRoles.includes(auth.role)) {
    throw new BrokerPlatformError('ADMIN_FORBIDDEN', 'No tenés permiso para esta acción.', 403)
  }
  return auth
}
