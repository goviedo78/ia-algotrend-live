import { type NextRequest, NextResponse } from 'next/server'
import { after } from 'next/server'
import { cookies, headers } from 'next/headers'
import crypto from 'node:crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const bypassToken = process.env.BYPASS_TOKEN ?? 'materia'
  const defaultRedirect = new URL(`/?dev=${bypassToken}`, request.url)

  // 1. Validar id (1-32 chars alfanuméricos)
  if (!/^[a-zA-Z0-9_-]{1,32}$/.test(id)) {
    return NextResponse.redirect(defaultRedirect, 302)
  }

  // 1.5. Lookup de URL custom configurada en el dashboard
  let redirectUrl: URL = defaultRedirect
  try {
    const supabaseLookup = createAdminClient()
    const { data: cardConfig } = await supabaseLookup
      .from('nfc_card_names')
      .select('redirect_url')
      .eq('card_id', id)
      .maybeSingle()
    if (cardConfig?.redirect_url) {
      try {
        redirectUrl = new URL(cardConfig.redirect_url, request.url)
      } catch {
        redirectUrl = defaultRedirect
      }
    }
  } catch {
    redirectUrl = defaultRedirect
  }

  // 2. Extraer headers
  const headersList = await headers()
  const ip = headersList.get('x-vercel-forwarded-for') ?? 
             headersList.get('x-forwarded-for')?.split(',')[0].trim() ?? 
             null

  const country = headersList.get('x-vercel-ip-country') ?? null
  const city = headersList.get('x-vercel-ip-city') ?? null
  const region = headersList.get('x-vercel-ip-region') ?? null
  const latitude = headersList.get('x-vercel-ip-latitude') ?? null
  const longitude = headersList.get('x-vercel-ip-longitude') ?? null
  
  const userAgentRaw = headersList.get('user-agent') ?? ''
  const userAgent = userAgentRaw.substring(0, 500)

  const acceptLanguageRaw = headersList.get('accept-language') ?? ''
  const browserLanguage = acceptLanguageRaw.split(',')[0].trim().substring(0, 50) || null

  const refererRaw = headersList.get('referer') ?? ''
  const referer = refererRaw.substring(0, 500) || null

  // 3. Hashear IP
  let ipHash = null
  if (ip) {
    const salt = process.env.NFC_HASH_SALT
    if (!salt) {
      const fallbackSalt = crypto.randomBytes(32).toString('hex')
      console.warn('WARNING: NFC_HASH_SALT no está definido. Usando un salt temporal:', fallbackSalt)
      ipHash = crypto.createHash('sha256').update(ip + fallbackSalt).digest('hex')
    } else {
      ipHash = crypto.createHash('sha256').update(ip + salt).digest('hex')
    }
  }

  // 4. Leer/crear cookie device id
  const cookieStore = await cookies()
  let deviceCookieId = cookieStore.get('nfc_device_id')?.value
  
  if (!deviceCookieId || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(deviceCookieId)) {
    deviceCookieId = crypto.randomUUID()
  }

  // 5. Preparar la respuesta de redirect y setear la cookie
  const response = NextResponse.redirect(redirectUrl, 302)
  response.cookies.set({
    name: 'nfc_device_id',
    value: deviceCookieId,
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365, // 1 año
  })

  // 6. Ejecutar insert de forma no bloqueante
  after(async () => {
    try {
      const supabaseAdmin = createAdminClient()
      const { error } = await supabaseAdmin.from('nfc_analytics').insert({
        card_id: id,
        ip_hash: ipHash,
        user_agent: userAgent,
        country,
        city,
        region,
        latitude,
        longitude,
        browser_language: browserLanguage,
        device_cookie_id: deviceCookieId,
        referer,
      })
      if (error) {
        console.error('nfc_insert_failed', error)
      }
    } catch (e) {
      console.error('nfc_insert_exception', e)
    }
  })

  return response
}
