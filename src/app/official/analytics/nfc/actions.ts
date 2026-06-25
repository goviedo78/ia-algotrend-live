'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

function sanitizeRedirect(raw: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim().substring(0, 500)
  if (!trimmed) return null
  // Aceptar URLs absolutas https/http o paths internos comenzando con /
  if (/^https?:\/\/[^\s<>"']+$/i.test(trimmed)) return trimmed
  if (/^\/[^\s<>"']*$/.test(trimmed)) return trimmed
  return null
}

export async function saveCardName(formData: FormData) {
  const cardIdRaw = String(formData.get('card_id') ?? '').trim()
  const nameRaw = String(formData.get('name') ?? '').trim()
  const redirectRaw = String(formData.get('redirect_url') ?? '').trim()
  const colorRaw = String(formData.get('color') ?? '').trim()
  const pin = String(formData.get('pin') ?? '')

  const validPin = process.env.ANALYTICS_PIN ?? process.env.DASHBOARD_PASSWORD
  if (!validPin || pin !== validPin) return

  if (!cardIdRaw || !nameRaw) return
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(cardIdRaw)) return

  const name = nameRaw.substring(0, 80)
  const redirectUrl = sanitizeRedirect(redirectRaw)
  const color = /^#[0-9A-Fa-f]{6}$/.test(colorRaw) ? colorRaw : null

  const supabase = createAdminClient()
  await supabase
    .from('nfc_card_names')
    .upsert(
      {
        card_id: cardIdRaw,
        name,
        redirect_url: redirectUrl,
        color,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'card_id' }
    )

  revalidatePath('/official/analytics/nfc')
}

export async function deleteCardName(formData: FormData) {
  const cardId = String(formData.get('card_id') ?? '').trim()
  const pin = String(formData.get('pin') ?? '')

  const validPin = process.env.ANALYTICS_PIN ?? process.env.DASHBOARD_PASSWORD
  if (!validPin || pin !== validPin) return
  if (!cardId) return

  const supabase = createAdminClient()
  await supabase.from('nfc_card_names').delete().eq('card_id', cardId)

  revalidatePath('/official/analytics/nfc')
}

export async function deleteScans(scanIds: string[], pin: string) {
  const validPin = process.env.ANALYTICS_PIN ?? process.env.DASHBOARD_PASSWORD
  if (!validPin || pin !== validPin) throw new Error('Unauthorized')
  if (!Array.isArray(scanIds) || scanIds.length === 0) return

  // Limitar cantidad de borrados por request (ej. 1000)
  const safeIds = scanIds.slice(0, 1000).filter(id => typeof id === 'string' || typeof id === 'number')
  if (safeIds.length === 0) return

  const supabase = createAdminClient()
  const { error } = await supabase.from('nfc_analytics').delete().in('id', safeIds)
  
  if (error) {
    console.error('[deleteScans] Supabase error:', error)
    throw new Error('Database error during deletion')
  }

  revalidatePath('/official/analytics/nfc')
}

