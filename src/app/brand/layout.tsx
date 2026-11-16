import type { Metadata } from 'next'

// /brand/* son galerías internas de diseño (logo, paletas, materiales):
// no son contenido público y no deben competir con la landing en Google.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default function BrandLayout({ children }: { children: React.ReactNode }) {
  return children
}
