import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { fetchWithTimeout } from './supabase/fetch-timeout'
import { getAlgoTrendTelegramConfig, sendTelegramMessage, sendTelegramPhoto } from './telegram'
import { deliverOnce, evaluatePrealert, formatNotice, type SignalNotice } from './signal-notices'
import type { Candle } from './algotrend'
import type { Trade } from './db'

function noticeStore() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    global: { fetch: fetchWithTimeout(2000) }, auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function publishSignalNotice(notice: SignalNotice) {
  const config = getAlgoTrendTelegramConfig()
  if (!config) return
  const db = noticeStore()
  if (notice.kind === 'TRIGGER') {
    const { data, error } = await db.from('algotrend_trades').select().eq('id', notice.tradeId!).eq('status', 'OPEN').maybeSingle()
    if (error) throw new Error(`Trigger position unavailable (${error.code})`)
    if (!data || data.take_profit !== null) return
    notice = { ...notice, stopLoss: data.stop_loss, time: data.last_managed_time }
  }
  await deliverOnce(`algotrend:${config.chatId}:${config.threadId ?? ''}`, notice, {
    now: () => Date.now() / 1000,
    claim: async (key, payload) => {
      const { error } = await db.from('algotrend_telegram_notices').insert({ notice_key: key, kind: notice.kind, payload })
      if (error?.code === '23505') return false
      if (error) throw new Error(`Notice reservation failed (${error.code})`)
      return true
    },
    finish: async (key, state, messageId) => {
      const { error } = await db.from('algotrend_telegram_notices').update({ state, message_id: messageId ?? null, updated_at: new Date().toISOString() }).eq('notice_key', key)
      if (error) throw new Error(`Notice receipt failed (${error.code})`)
    },
    send: async payload => {
      const text = formatNotice(payload)
      const expired = () => payload.validUntil !== undefined && Date.now() / 1000 >= payload.validUntil - 10
      const sendText = () => expired() ? Promise.resolve({ status: 'failed' as const, code: 408 }) : sendTelegramMessage(config, text)
      let image: Uint8Array
      try { image = await (await import('./telegram-notice-card')).renderNoticeCard(payload) }
      catch { return sendText() }
      // Do not deliver a preview whose candle closed while rendering.
      if (expired()) return { status: 'failed', code: 408 }
      const result = await sendTelegramPhoto(config, image, text)
      if (result.status === 'failed' && [400, 413].includes(result.code)) return sendText()
      return result
    },
  })
}

export async function previewSignalNotice(candles: Candle[]) {
  const now = Date.now() / 1000
  const elapsed = now % 3600
  if (elapsed < 55 * 60 || elapsed >= 3570 || !getAlgoTrendTelegramConfig()) return
  const db = noticeStore()
  const setting = async (key: string) => {
    const { data, error } = await db.from('algotrend_events').select('metadata')
      .eq('event_type', 'setting_change').contains('metadata', { key }).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error) throw new Error(`Preview settings unavailable (${error.code})`)
    return data?.metadata?.value as string | undefined
  }
  const [enabled, threshold, open] = await Promise.all([
    setting('atr_filter_enabled'), setting('atr_threshold'), db.from('algotrend_trades').select().eq('status', 'OPEN').maybeSingle(),
  ])
  if (open.error) throw new Error(`Preview position unavailable (${open.error.code})`)
  const openTrade = open.data as Trade | null
  const notice = evaluatePrealert({ candles, now: Date.now() / 1000, openTrade,
    atrFilterOn: enabled === 'true' || process.env.ATR_FILTER_ENABLED === 'true',
    atrThreshold: Number.parseFloat(threshold || process.env.ATR_THRESHOLD || '0.40'),
  })
  if (notice) await publishSignalNotice(notice)
}

export async function safelyRunNotice(work: () => Promise<void>) {
  try { await work() } catch (error) {
    // No credentials, no unbounded retries; trade processing stays independent.
    console.error('[telegram:notice]', error instanceof Error ? error.message : 'failed')
  }
}
