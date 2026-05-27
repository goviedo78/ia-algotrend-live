// Single source of truth para /links. Editar acá para agregar/quitar/cambiar enlaces.

import type { IconName } from './LinkIcon'

export type LinkItem = {
  title: string
  href: string
  /** Si es true → abre en nueva pestaña con rel="noopener noreferrer" */
  external?: boolean
  /** Tag opcional al costado del título (ej. 'PRO', 'Nuevo') */
  badge?: string
  /** Icono opcional (definido en LinkIcon.tsx) */
  icon?: IconName
}

export const HEADER = {
  brand: 'GONOVI',
  subtitle: 'Indicadores, herramientas y recursos para traders.',
}

// Banner de patrocinadores — aparece arriba de la lista de links.
// Editar acá el copy y el destino del CTA cuando tengas la URL real.
export const SPONSOR = {
  pitch: '¿Querés que tu marca aparezca acá?',
  description:
    'Este hub se comparte en todos mis videos y redes. Exposición permanente, audiencia 100% trading.',
  ctaText: 'Quiero patrocinar →',
  ctaHref:
    'mailto:?subject=Patrocinio%20GONOVI&body=Hola%20Gonzalo%2C%20me%20interesa%20patrocinar%20tu%20canal.',
}

export const LINKS: LinkItem[] = [
  { title: 'Descargar indicadores gratis', href: '#', external: true, icon: 'chart' },
  { title: 'Ver indicadores PRO', href: '#', external: true, badge: 'PRO', icon: 'chart-pro' },
  { title: 'IA AlgoTrend', href: '#', external: true, icon: 'bot' },
  { title: 'Fusion X10', href: '#', external: true, icon: 'layers' },
  { title: 'Unirme a la membresía de YouTube', href: 'https://youtube.com/...', external: true, icon: 'youtube' },
  { title: 'Ver último video', href: 'https://youtube.com/...', external: true, icon: 'play' },
  { title: 'Contacto comercial / sponsors', href: 'mailto:?subject=Sponsors%20GONOVI', external: false, icon: 'mail' },
  { title: 'WhatsApp / comunidad', href: 'https://wa.me/...', external: true, icon: 'whatsapp' },
  { title: 'Apps y herramientas', href: '#', external: true, icon: 'grid' },
]

export const ECOSYSTEM_LABEL = 'TradingView · YouTube · Gumroad · Herramientas propias'
export const COPYRIGHT = '© GonOvi'
