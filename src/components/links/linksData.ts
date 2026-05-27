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
