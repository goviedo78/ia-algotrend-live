import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const pin = searchParams.get('pin') || ''
  // Incluir el bypass del muro de mantenimiento en el start_url para que la PWA
  // pueda atravesarlo al arrancar (si no, queda en "Próximamente" y se ve mal).
  const bypass = process.env.BYPASS_TOKEN || ''
  const query = bypass ? `pin=${pin}&dev=${bypass}` : `pin=${pin}`

  const manifest = {
    id: `/official/analytics/nfc?${query}`,
    name: "NFC Admin · GONOVI",
    short_name: "NFC Admin",
    description: "Panel privado para administrar tarjetas físicas NFC de GONOVI.",
    start_url: `/official/analytics/nfc?${query}`,
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
        purpose: "any"
      },
      {
        src: "/icons/nfc-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      }
    ]
  }

  return NextResponse.json(manifest)
}
