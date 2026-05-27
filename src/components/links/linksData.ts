// Single source of truth para /links. Editar acá para agregar/quitar/cambiar enlaces.

export type LinkItem = {
  title: string
  href: string
  /** Si es true → abre en nueva pestaña con rel="noopener noreferrer" */
  external?: boolean
  /** Tag opcional al costado del título (ej. 'PRO', 'Nuevo') */
  badge?: string
}

export const HEADER = {
  brand: 'GONOVI',
  subtitle: 'Indicadores, herramientas y recursos para traders.',
}

export const LINKS: LinkItem[] = [
  { title: 'Descargar indicadores gratis', href: '#', external: true },
  { title: 'Ver indicadores PRO', href: '#', external: true, badge: 'PRO' },
  { title: 'IA AlgoTrend', href: '#', external: true },
  { title: 'Fusion X10', href: '#', external: true },
  { title: 'Unirme a la membresía de YouTube', href: 'https://youtube.com/...', external: true },
  { title: 'Ver último video', href: 'https://youtube.com/...', external: true },
  { title: 'Contacto comercial / sponsors', href: 'mailto:?subject=Sponsors%20GONOVI', external: false },
  { title: 'WhatsApp / comunidad', href: 'https://wa.me/...', external: true },
  { title: 'Apps y herramientas', href: '#', external: true },
]

export const ECOSYSTEM_LABEL = 'TradingView · YouTube · Gumroad · Herramientas propias'
export const COPYRIGHT = '© GonOvi'
