import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pin = searchParams.get('pin') || ''

  const manifest = {
    id: `/official/analytics/nfc?pin=${pin}`,
    name: "NFC Admin · GONOVI",
    short_name: "NFC Admin",
    description: "Panel privado para administrar tarjetas físicas NFC de GONOVI.",
    start_url: `/official/analytics/nfc?pin=${pin}`,
    scope: "/official/analytics/nfc",
    display: "standalone",
    background_color: "#11162A",
    theme_color: "#11162A",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/icons/nfc-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable"
      },
      {
        src: "/icons/nfc-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable"
      }
    ]
  }

  return NextResponse.json(manifest)
}
