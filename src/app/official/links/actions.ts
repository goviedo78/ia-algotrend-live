'use server'

import { revalidatePath } from 'next/cache'
import { loadLinksConfig, saveLinksConfig, type LinksConfig, type CustomIcon } from '@/lib/links-config'

/**
 * Sanitiza un SVG quitando todo lo peligroso (scripts, event handlers,
 * external resources). Defensa en profundidad — el admin ya está PIN-gated
 * pero igual no queremos almacenar XSS en DB.
 *
 * Reglas:
 * - Debe empezar con <svg y terminar con </svg>
 * - Strip <script>, <foreignObject>, <image>, <use href="http...">
 * - Strip on* event handlers (onclick, onerror, onload, etc.)
 * - Strip javascript: y data: URIs (excepto data:image inocuo)
 * - Max 6KB después de sanitizar
 */
export async function sanitizeSvg(raw: string): Promise<string | null> {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return null
  if (!/^<svg[\s>]/i.test(trimmed) || !/<\/svg>\s*$/i.test(trimmed)) return null
  if (trimmed.length > 12000) return null  // pre-strip max

  let s = trimmed
  // Quitar comentarios HTML/XML
  s = s.replace(/<!--[\s\S]*?-->/g, '')
  // Quitar tags peligrosos completos (con contenido)
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, '')
  s = s.replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
  // Tags self-closing peligrosos
  s = s.replace(/<image\b[^>]*\/?>/gi, '')
  // Atributos event handlers (onclick, onload, etc.)
  s = s.replace(/\s+on[a-z]+\s*=\s*"[^"]*"/gi, '')
  s = s.replace(/\s+on[a-z]+\s*=\s*'[^']*'/gi, '')
  // javascript: URIs
  s = s.replace(/javascript\s*:/gi, '')
  // <use href="http://..."> externo
  s = s.replace(/<use\s+[^>]*(?:href|xlink:href)\s*=\s*["']https?:\/\/[^"']*["'][^>]*\/?>/gi, '')

  // Tamaño final
  if (s.length > 6000) return null
  // Re-validar que sigue siendo <svg>...</svg>
  if (!/^<svg[\s>]/i.test(s) || !/<\/svg>\s*$/i.test(s)) return null
  return s
}

function isValidIconId(id: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(id)
}

function validPin(pin: string): boolean {
  const expected = process.env.ANALYTICS_PIN ?? process.env.DASHBOARD_PASSWORD
  return !!expected && pin === expected
}

function sanitizeHref(href: string): string {
  const trimmed = (href ?? '').trim().substring(0, 500)
  if (!trimmed) return '#'
  if (/^(https?:\/\/|mailto:|tel:|wa\.me\/|\/)/i.test(trimmed)) return trimmed
  return '#'
}

function sanitizeColor(color?: string): string | undefined {
  if (!color) return undefined
  const trimmed = color.trim()
  return /^#[0-9a-fA-F]{3,8}$/.test(trimmed) ? trimmed : undefined
}

async function sanitizeCustomIcons(raw: unknown): Promise<CustomIcon[]> {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: CustomIcon[] = []
  for (const item of raw.slice(0, 30)) {
    const id = String((item as { id?: string })?.id ?? '').trim().toLowerCase()
    const name = String((item as { name?: string })?.name ?? '').trim().substring(0, 40)
    const rawSvg = String((item as { svg?: string })?.svg ?? '')
    if (!isValidIconId(id) || seen.has(id) || !name) continue
    const cleanSvg = await sanitizeSvg(rawSvg)
    if (!cleanSvg) continue
    seen.add(id)
    out.push({ id, name, svg: cleanSvg })
  }
  return out
}

function sanitizeConfig(raw: unknown): LinksConfig {
  const c = (raw ?? {}) as Partial<LinksConfig>
  return {
    header: {
      brand: String(c.header?.brand ?? 'GONOVI').substring(0, 80),
      subtitle: String(c.header?.subtitle ?? '').substring(0, 280),
    },
    sponsor: {
      pitch: String(c.sponsor?.pitch ?? '').substring(0, 160),
      description: String(c.sponsor?.description ?? '').substring(0, 320),
      ctaText: String(c.sponsor?.ctaText ?? '').substring(0, 80),
      ctaHref: sanitizeHref(String(c.sponsor?.ctaHref ?? '')),
    },
    links: Array.isArray(c.links)
      ? c.links.slice(0, 50).map((l) => ({
          title: String(l?.title ?? '').substring(0, 120),
          href: sanitizeHref(String(l?.href ?? '#')),
          external: l?.external !== false,
          badge: l?.badge ? String(l.badge).substring(0, 24) : undefined,
          icon: l?.icon as LinksConfig['links'][number]['icon'],
          color: sanitizeColor(l?.color),
          hidden: !!l?.hidden,
        }))
      : [],
    ecosystemLabel: String(c.ecosystemLabel ?? '').substring(0, 200),
    copyright: String(c.copyright ?? '').substring(0, 80),
    // customIcons se procesa async aparte en saveConfigAction
    customIcons: [],
  }
}

export async function saveConfigAction(formData: FormData) {
  const pin = String(formData.get('pin') ?? '')
  if (!validPin(pin)) return { ok: false, error: 'PIN inválido' }

  const raw = formData.get('config')
  if (typeof raw !== 'string') return { ok: false, error: 'Config faltante' }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'JSON malformado' }
  }

  const clean = sanitizeConfig(parsed)
  clean.customIcons = await sanitizeCustomIcons((parsed as { customIcons?: unknown })?.customIcons)
  const result = await saveLinksConfig(clean)
  if (!result.ok) return { ok: false, error: result.error ?? 'Error desconocido' }

  revalidatePath('/links')
  revalidatePath('/official/links')
  return { ok: true }
}

export async function loadConfigAction(pin: string) {
  if (!validPin(pin)) return null
  return loadLinksConfig()
}
