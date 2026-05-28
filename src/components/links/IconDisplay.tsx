// Wrapper que decide entre icono built-in (LinkIcon) o icono custom subido
// por el usuario. Para custom usa dangerouslySetInnerHTML — el SVG ya está
// sanitizado server-side antes de guardarse en DB (ver actions.ts/sanitizeSvg).

import { LinkIcon, type IconName } from './LinkIcon'
import type { CustomIcon } from '@/lib/links-config'

// Lista de built-in icons hardcoded para que el cliente decida sin tocar el
// switch de LinkIcon. Si LinkIcon agrega un nuevo built-in, actualizar acá.
const BUILT_IN_NAMES = new Set<string>([
  'chart', 'chart-pro', 'bot', 'layers',
  'youtube', 'play', 'mail', 'whatsapp',
  'grid', 'instagram', 'tiktok', 'globe',
])

interface Props {
  /** Identificador del icono. Puede ser built-in o custom ID. */
  name?: string
  /** Lista de iconos custom disponibles (viene de LinksConfig). */
  customIcons?: CustomIcon[]
}

export function IconDisplay({ name, customIcons }: Props) {
  if (!name) return null
  if (BUILT_IN_NAMES.has(name)) {
    return <LinkIcon name={name as IconName} />
  }
  const custom = customIcons?.find((ic) => ic.id === name)
  if (!custom) return null
  return (
    <span
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}
      // SVG ya sanitizado server-side antes de guardarse en DB.
      dangerouslySetInnerHTML={{ __html: custom.svg }}
      aria-hidden="true"
    />
  )
}
