import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/official/',
        disallow: [
          '/api/',
          '/official/dashboard/',
          '/official/analytics/',
          '/official/checkout/',
        ],
      },
    ],
    sitemap: 'https://gonovi.app/sitemap.xml',
  }
}
