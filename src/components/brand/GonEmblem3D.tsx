'use client'

import GonoviEnamelLogo3D from './GonoviEnamelLogo3D'

export interface GonEmblem3DProps {
  /** Lado del logo en px. Default 40. */
  size?: number
  /** Se conserva por compatibilidad con usos anteriores. */
  enable3D?: boolean
  /** Clase CSS extra para el wrapper. */
  className?: string
}

export function GonEmblem3D({ size = 40, className }: GonEmblem3DProps) {
  return <GonoviEnamelLogo3D size={size} compact interactive={false} className={className} />
}

export default GonEmblem3D
