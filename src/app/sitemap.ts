import type { MetadataRoute } from 'next'

const BASE = 'https://gonovi.app'

// Solo URLs indexables (200, sin noindex, con canonical propio).
// - La home es `/`: el proxy la reescribe a /official, y Google ya eligió `/`
//   como canónica. /official no se lista para no duplicar.
// - Las páginas legales llevan noindex: no van aquí.
// - Sin lastModified: un "ahora" en cada request le dice a Google que todo
//   cambia siempre y deja de creerle a la fecha.
const PAGES: Array<{
  path: string
  changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency']
  priority: number
}> = [
  { path: '/', changeFrequency: 'weekly', priority: 1.0 },
  { path: '/official/estrategias', changeFrequency: 'daily', priority: 0.9 },
  { path: '/official/lab', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/official/backtesting', changeFrequency: 'monthly', priority: 0.9 },
  { path: '/official/montecarlo', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/official/academia', changeFrequency: 'monthly', priority: 0.85 },
  { path: '/official/practica', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/official/instalacion', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/official/videos', changeFrequency: 'weekly', priority: 0.8 },
  { path: '/official/store', changeFrequency: 'monthly', priority: 0.8 },
  { path: '/official/apps', changeFrequency: 'monthly', priority: 0.75 },
  { path: '/official/mercados', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/official/community', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/official/docs', changeFrequency: 'monthly', priority: 0.7 },
  { path: '/official/soporte', changeFrequency: 'yearly', priority: 0.5 },
  { path: '/links', changeFrequency: 'monthly', priority: 0.5 },
]

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map(({ path, changeFrequency, priority }) => ({
    url: `${BASE}${path}`,
    changeFrequency,
    priority,
  }))
}
