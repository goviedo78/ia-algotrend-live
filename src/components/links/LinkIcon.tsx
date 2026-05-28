// SVG icons inline para /links. Todos 20x20, stroke currentColor.
// Diseño line-art minimalista, consistente con el tono GONOVI.
// Sin dependencias externas.

export type IconName =
  | 'chart'        // indicadores gratis
  | 'chart-pro'    // indicadores PRO
  | 'bot'          // IA AlgoTrend
  | 'layers'       // Fusion X10
  | 'youtube'      // membresía YouTube
  | 'play'         // último video
  | 'mail'         // contacto / sponsors
  | 'whatsapp'     // WhatsApp / comunidad
  | 'grid'         // apps y herramientas
  | 'instagram'    // instagram
  | 'tiktok'       // tiktok
  | 'globe'        // website
  | 'gonovi'       // gonovi mark

const COMMON = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export function LinkIcon({ name }: { name: IconName }) {
  switch (name) {
    case 'chart':
      return (
        <svg {...COMMON}>
          <path d="M3 20h18" />
          <path d="M5 16l4-5 4 3 6-9" />
          <path d="M14 5h5v5" />
        </svg>
      )
    case 'chart-pro':
      return (
        <svg {...COMMON}>
          <path d="M3 20h18" />
          <path d="M5 16l4-5 4 3 4-6" />
          <path d="M19 4l1 2 2 .3-1.5 1.4.4 2.1L19 8.8 17.1 9.8l.4-2.1L16 6.3 18 6z" />
        </svg>
      )
    case 'bot':
      return (
        <svg {...COMMON}>
          <rect x="4" y="7" width="16" height="12" rx="3" />
          <path d="M12 3v4" />
          <circle cx="9" cy="13" r="1.2" />
          <circle cx="15" cy="13" r="1.2" />
          <path d="M9 17h6" />
        </svg>
      )
    case 'layers':
      return (
        <svg {...COMMON}>
          <path d="M12 3l9 5-9 5-9-5 9-5z" />
          <path d="M3 13l9 5 9-5" />
          <path d="M3 17l9 5 9-5" />
        </svg>
      )
    case 'youtube':
      return (
        <svg {...COMMON}>
          <rect x="2" y="6" width="20" height="12" rx="3" />
          <path d="M10 9.5l5 2.5-5 2.5z" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'play':
      return (
        <svg {...COMMON}>
          <circle cx="12" cy="12" r="9" />
          <path d="M10 8.5l6 3.5-6 3.5z" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'mail':
      return (
        <svg {...COMMON}>
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="M3 7l9 6 9-6" />
        </svg>
      )
    case 'whatsapp':
      return (
        <svg {...COMMON}>
          <path d="M21 12a9 9 0 1 0-3.6 7.2L21 21l-1.8-3.6A8.96 8.96 0 0 0 21 12z" />
          <path d="M9 10c.5 2 2 3.5 4 4l1.5-1.5 2.5 1c-.3 1.5-1.7 2.5-3.2 2.5A6 6 0 0 1 7.5 10c0-1.5 1-2.9 2.5-3.2l1 2.5z" />
        </svg>
      )
    case 'grid':
      return (
        <svg {...COMMON}>
          <rect x="3" y="3" width="7" height="7" rx="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" />
        </svg>
      )
    case 'instagram':
      return (
        <svg {...COMMON}>
          <rect x="2" y="2" width="20" height="20" rx="5" />
          <circle cx="12" cy="12" r="4" />
          <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'tiktok':
      return (
        <svg {...COMMON}>
          <path d="M15 2v3.15a5.5 5.5 0 0 0 5 5v3.31A9 9 0 0 1 15 10v9.5a5.5 5.5 0 1 1-5.5-5.5V17a2 2 0 1 0 2 2z" />
        </svg>
      )
    case 'globe':
      return (
        <svg {...COMMON}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
          <path d="M2 12h20" />
        </svg>
      )
    case 'gonovi':
      return (
        <svg {...COMMON}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 12V3" />
          <path d="M12 12l-7.5 4.5" />
          <path d="M12 12l7.5 4.5" />
        </svg>
      )
  }
}
