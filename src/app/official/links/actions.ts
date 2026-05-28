'use server'

import { revalidatePath } from 'next/cache'
import { loadLinksConfig, saveLinksConfig, type LinksConfig } from '@/lib/links-config'

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
