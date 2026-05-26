import path from "node:path";
import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  images: {
    formats: ["image/avif", "image/webp"],
  },
  async headers() {
    return [
      {
        // Standalone HTML previews of brand assets (brand-3d.html, brand-motion.html,
        // brand-system.html). Necesitan three.js desde unpkg + Google Fonts externos.
        // Scope acotado a /brand-*.html para no relajar la CSP del sitio entero.
        source: "/brand-:slug.html",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com https://unpkg.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https: wss:;"
          }
        ],
      },
      {
        // Security headers for all routes (excepto brand-*.html que tienen su propia regla arriba)
        source: "/:path((?!brand-).*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https: wss:;"
          }
        ],
      },
      {
        // Public delayed endpoints opt-in to HTTP cache via their own headers.
        source: "/api/public/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=60, s-maxage=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // All other API routes: trading data must always be fresh.
        source: "/api/((?!public/).*)",
        headers: [
          { key: "Cache-Control", value: "no-store, max-age=0" },
        ],
      },
      ...(isProduction
        ? [
            {
              // Long cache only in production, where Next emits hashed assets.
              source: "/:path*.(js|css|woff2|png|svg|ico|webp|avif)",
              headers: [
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
              ],
            },
          ]
        : [
            {
              // Turbopack dev chunk names can be reused between edits.
              source: "/:path*.(js|css)",
              headers: [
                {
                  key: "Cache-Control",
                  value: "no-store, max-age=0",
                },
              ],
            },
          ]),
    ];
  },
};

export default nextConfig;
