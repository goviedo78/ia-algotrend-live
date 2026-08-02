import { createHash } from 'node:crypto'
import { Resend } from 'resend'
import { createAdminClient } from '@/lib/supabase/admin'

type OtpDeliveryDependencies = {
  generateOtp: (email: string) => Promise<string>
  sendOtp: (email: string, token: string) => Promise<void>
}

export type OtpDeliveryErrorCode =
  | 'OTP_CONFIGURATION_FAILED'
  | 'OTP_GENERATION_FAILED'
  | 'EMAIL_DELIVERY_FAILED'

export class OtpDeliveryError extends Error {
  constructor(
    readonly code: OtpDeliveryErrorCode,
    readonly providerStatus?: number,
  ) {
    super(code)
    this.name = 'OtpDeliveryError'
  }
}

function getNumericStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined

  const candidate = error as { status?: unknown; statusCode?: unknown }
  if (typeof candidate.status === 'number') return candidate.status
  if (typeof candidate.statusCode === 'number') return candidate.statusCode
  return undefined
}

async function generateSupabaseOtp(email: string): Promise<string> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (error) {
      throw new OtpDeliveryError('OTP_GENERATION_FAILED', getNumericStatus(error))
    }

    const token = data.properties.email_otp
    if (!/^\d{6}$/.test(token)) {
      throw new OtpDeliveryError('OTP_GENERATION_FAILED')
    }

    return token
  } catch (error) {
    if (error instanceof OtpDeliveryError) throw error
    throw new OtpDeliveryError('OTP_GENERATION_FAILED', getNumericStatus(error))
  }
}

function buildOtpHtml(token: string): string {
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;background:#f5f5f4;color:#171717;font-family:Arial,sans-serif">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:32px 16px">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e7e5e4">
            <tr>
              <td style="padding:32px">
                <p style="margin:0 0 24px;font-size:13px;font-weight:700;color:#171717">GONOVI</p>
                <h1 style="margin:0 0 12px;font-size:24px;line-height:1.25">Tu código de acceso</h1>
                <p style="margin:0 0 24px;color:#57534e;font-size:15px;line-height:1.6">Ingresa este código de 6 dígitos en la pantalla de inicio de sesión:</p>
                <p style="margin:0 0 24px;padding:18px;background:#f5f5f4;border:1px solid #d6d3d1;text-align:center;font-family:monospace;font-size:32px;font-weight:700;letter-spacing:8px;color:#171717">${token}</p>
                <p style="margin:0;color:#78716c;font-size:13px;line-height:1.5">Caduca en una hora. Si no solicitaste este código, ignora este mensaje.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

async function sendOtpWithResend(email: string, token: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new OtpDeliveryError('OTP_CONFIGURATION_FAILED')
  }

  try {
    const recipientHash = createHash('sha256').update(email).digest('hex').slice(0, 24)
    const tokenHash = createHash('sha256').update(token).digest('hex').slice(0, 16)
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: 'GONOVI <no-reply@gonovi.app>',
      to: email,
      subject: `${token} es tu código de acceso a GONOVI`,
      text: `Tu código de acceso a GONOVI es ${token}. Caduca en una hora. Si no lo solicitaste, ignora este mensaje.`,
      html: buildOtpHtml(token),
      tags: [{ name: 'category', value: 'gonovi_auth_otp' }],
    }, {
      idempotencyKey: `gonovi-auth-${recipientHash}-${tokenHash}`,
    })

    if (error) {
      throw new OtpDeliveryError('EMAIL_DELIVERY_FAILED', getNumericStatus(error))
    }
  } catch (error) {
    if (error instanceof OtpDeliveryError) throw error
    throw new OtpDeliveryError('EMAIL_DELIVERY_FAILED', getNumericStatus(error))
  }
}

const defaultDependencies: OtpDeliveryDependencies = {
  generateOtp: generateSupabaseOtp,
  sendOtp: sendOtpWithResend,
}

export async function deliverEmailOtp(
  email: string,
  dependencies: OtpDeliveryDependencies = defaultDependencies,
): Promise<void> {
  const token = await dependencies.generateOtp(email)

  if (!/^\d{6}$/.test(token)) {
    throw new OtpDeliveryError('OTP_GENERATION_FAILED')
  }

  await dependencies.sendOtp(email, token)
}
