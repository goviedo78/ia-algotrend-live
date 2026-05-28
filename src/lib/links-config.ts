// Helpers server-side para leer/escribir la config de /links desde Supabase.
// La data está en tabla links_config (single-row, JSONB).
// Si la DB no tiene config, devuelve los defaults de linksData.ts (fallback).

import { createAdminClient } from '@/lib/supabase/admin'
import {
  HEADER as DEFAULT_HEADER,
  SPONSOR as DEFAULT_SPONSOR,
  LINKS as DEFAULT_LINKS,
  ECOSYSTEM_LABEL as DEFAULT_ECOSYSTEM,
  COPYRIGHT as DEFAULT_COPYRIGHT,
  type LinkItem,
} from '@/components/links/linksData'

export type LinksConfig = {
  header: { brand: string; subtitle: string }
  sponsor: {
    pitch: string
    description: string
    ctaText: string
    ctaHref: string
  }
  links: LinkItem[]
  ecosystemLabel: string
  copyright: string
}

export const DEFAULT_CONFIG: LinksConfig = {
  header: DEFAULT_HEADER,
  sponsor: DEFAULT_SPONSOR,
  links: DEFAULT_LINKS,
  ecosystemLabel: DEFAULT_ECOSYSTEM,
  copyright: DEFAULT_COPYRIGHT,
}

function isValidConfig(value: unknown): value is LinksConfig {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    !!v.header &&
    !!v.sponsor &&
    Array.isArray(v.links) &&
    typeof v.ecosystemLabel === 'string' &&
    typeof v.copyright === 'string'
  )
}

/**
 * Lee la config de /links desde Supabase. Si está vacía o falla, devuelve los
 * defaults de linksData.ts. NUNCA tira excepción — para no romper la página pública.
 */
export async function loadLinksConfig(): Promise<LinksConfig> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('links_config')
      .select('config')
      .eq('id', 1)
      .maybeSingle()

    if (error) {
      console.error('[links-config] read error:', error.message)
      return DEFAULT_CONFIG
    }
    const raw = data?.config
    if (isValidConfig(raw)) return raw
    // DB vacía o malformada → usar defaults (página pública sigue funcionando)
    return DEFAULT_CONFIG
  } catch (e) {
    console.error('[links-config] exception:', e)
    return DEFAULT_CONFIG
  }
}

/**
 * Guarda la config completa (overwrite). Solo lo usa el admin server action,
 * que valida PIN antes de llamar.
 */
export async function saveLinksConfig(config: LinksConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    const supabase = createAdminClient()
    const { error } = await supabase
      .from('links_config')
      .upsert(
        { id: 1, config, updated_at: new Date().toISOString() },
        { onConflict: 'id' }
      )
    if (error) return { ok: false, error: error.message }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
