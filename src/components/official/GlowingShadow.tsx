'use client'

import { type ReactNode } from 'react'

interface GlowingShadowButtonProps {
  children: ReactNode
}

import './glowing.css'

export function GlowingShadow({ children }: GlowingShadowButtonProps) {
  return (
    <>

      <div className="glow-container">
        <span className="glow"></span>
        <div className="glow-content">{children}</div>
      </div>
    </>
  )
}
