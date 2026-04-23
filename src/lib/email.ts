import { Resend } from 'resend'
import { logEvent } from '@/lib/analytics'

let _resend: Resend | null = null
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}
const TO_EMAIL = process.env.ALERT_EMAIL || ''

export async function sendEmail(subject: string, body: string) {
  if (!process.env.RESEND_API_KEY || !TO_EMAIL) {
    console.log('[email] Skipped — RESEND_API_KEY or ALERT_EMAIL not set')
    return
  }

  const resend = getResend()
  if (!resend) return

  try {
    await resend.emails.send({
      from: 'IA AlgoTrend <onboarding@resend.dev>',
      to: TO_EMAIL,
      subject,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
          <div style="background: #0a0a0a; border-radius: 12px; padding: 24px; color: #fff;">
            <h2 style="margin: 0 0 16px; font-size: 18px; color: #fff;">🤖 IA AlgoTrend</h2>
            <div style="font-size: 15px; line-height: 1.6; color: #ccc;">
              ${body}
            </div>
            <hr style="border: none; border-top: 1px solid #333; margin: 16px 0;">
            <p style="font-size: 12px; color: #666; margin: 0;">
              Señal automática • <a href="https://algotrend.vercel.app" style="color: #289eff;">Ver dashboard</a>
            </p>
          </div>
        </div>
      `,
    })
    console.log('[email] Sent:', subject)
    await logEvent('email_sent', { subject })
  } catch (err) {
    console.error('[email] Error:', err)
    await logEvent('email_fail', { subject, error: String(err) })
  }
}

export function emailOpen(direction: string, price: number, sl: number, tp: number | null, prob: number) {
  const emoji = direction === 'LONG' ? '🟢' : '🔴'
  const dir = direction === 'LONG' ? 'LARGO' : 'CORTO'
  const subject = `${emoji} AlgoTrend — Señal ${dir} (${(prob * 100).toFixed(1)}%)`
  const body = `
    <p style="font-size: 20px; font-weight: bold; color: ${direction === 'LONG' ? '#289eff' : '#ce3f6c'};">
      Señal ${dir} detectada
    </p>
    <table style="width: 100%; font-size: 14px; color: #ccc;">
      <tr><td style="padding: 6px 0;">📍 Entrada</td><td style="text-align: right; font-weight: bold;">$${price.toLocaleString('en-US')}</td></tr>
      <tr><td style="padding: 6px 0;">🛑 Stop Loss</td><td style="text-align: right; color: #ff4444;">$${sl.toLocaleString('en-US')}</td></tr>
      <tr><td style="padding: 6px 0;">🎯 Take Profit</td><td style="text-align: right; color: #44ff44;">${tp ? '$' + tp.toLocaleString('en-US') : 'Trailing'}</td></tr>
      <tr><td style="padding: 6px 0;">📊 Confianza</td><td style="text-align: right;">${(prob * 100).toFixed(1)}%</td></tr>
    </table>
  `
  return sendEmail(subject, body)
}

export function emailClose(direction: string, openPrice: number, closePrice: number, pnlPct: number | null, reason: string) {
  const subject = `⚪ AlgoTrend — Salida ${direction} (${reason})`
  const pnl = pnlPct !== null ? pnlPct.toFixed(2) : '?'
  const pnlColor = (pnlPct ?? 0) >= 0 ? '#44ff44' : '#ff4444'
  const body = `
    <p style="font-size: 20px; font-weight: bold; color: #999;">
      Posición ${direction} cerrada
    </p>
    <table style="width: 100%; font-size: 14px; color: #ccc;">
      <tr><td style="padding: 6px 0;">📍 Entrada</td><td style="text-align: right;">$${openPrice.toLocaleString('en-US')}</td></tr>
      <tr><td style="padding: 6px 0;">📍 Salida</td><td style="text-align: right; font-weight: bold;">$${closePrice.toLocaleString('en-US')}</td></tr>
      <tr><td style="padding: 6px 0;">📈 PnL</td><td style="text-align: right; font-weight: bold; color: ${pnlColor};">${pnl}%</td></tr>
      <tr><td style="padding: 6px 0;">📋 Razón</td><td style="text-align: right;">${reason}</td></tr>
    </table>
  `
  return sendEmail(subject, body)
}
