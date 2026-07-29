import { createClient } from '@supabase/supabase-js'

const email = process.argv[2]?.trim().toLowerCase()
const role = process.argv[3]?.trim()
const allowCreate = process.argv.includes('--create')
const activateMembership = process.argv.includes('--activate-membership')
const allowedRoles = new Set(['admin_readonly', 'broker_operator', 'security_admin'])

if (!email || !allowedRoles.has(role)) {
  console.error('Usage: node scripts/set-broker-admin.mjs <email> <admin_readonly|broker_operator|security_admin> [--create] [--activate-membership]')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
let page = 1
let target = null

while (!target) {
  const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
  if (error) throw error
  target = data.users.find((user) => user.email?.toLowerCase() === email) ?? null
  if (target || data.users.length < 200) break
  page += 1
}

if (!target && !allowCreate) {
  console.error(`User not found: ${email}`)
  process.exit(1)
}

if (!target) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { broker_role: role },
  })
  if (error) throw error
  target = data.user
}

const { error } = await supabase.auth.admin.updateUserById(target.id, {
  app_metadata: { ...target.app_metadata, broker_role: role },
})
if (error) throw error

if (activateMembership) {
  const { error: membershipError } = await supabase.from('broker_memberships').upsert({
    user_id: target.id,
    status: 'ACTIVE',
    reviewed_at: new Date().toISOString(),
    reviewed_by: target.id,
    review_note: 'Bootstrap administrativo',
  })
  if (membershipError) throw membershipError

  const { error: auditError } = await supabase.from('broker_audit_events').insert({
    user_id: target.id,
    actor_user_id: target.id,
    event_type: 'ADMIN_BOOTSTRAPPED',
    outcome: 'SUCCESS',
    metadata: { role, membership: 'ACTIVE' },
  })
  if (auditError) throw auditError
}

console.log(`Broker role ${role} assigned to ${email}`)
