'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'

export async function saveCardName(formData: FormData) {
  const cardIdRaw = String(formData.get('card_id') ?? '').trim()
  const nameRaw = String(formData.get('name') ?? '').trim()
  const pin = String(formData.get('pin') ?? '')

  const validPin = process.env.ANALYTICS_PIN ?? process.env.DASHBOARD_PASSWORD
  if (!validPin || pin !== validPin) return

  if (!cardIdRaw || !nameRaw) return
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(cardIdRaw)) return

  const name = nameRaw.substring(0, 80)

  const supabase = createAdminClient()
  await supabase
    .from('nfc_card_names')
    .upsert(
      { card_id: cardIdRaw, name, updated_at: new Date().toISOString() },
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
