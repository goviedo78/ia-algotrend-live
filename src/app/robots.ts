import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: ['/', '/official/'],
        disallow: [
          '/api/',
          // Áreas privadas: solo redirigen a /auth, no hay nada que indexar.
          '/auth',
          '/account',
          '/cuenta/',
          '/admin/',
          // Enlaces cortos de seguimiento: redirigen fuera y ensucian analytics.
          '/x/',
          '/official/dashboard/',
          '/official/analytics/',
          '/official/checkout/',
        ],
      },
    ],
    sitemap: 'https://gonovi.app/sitemap.xml',
  }
}
