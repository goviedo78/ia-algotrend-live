'use client'

import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

const DEPTH_SLICES = 12

const LAYERS = [
  {
    name: 'Superficie metálica',
    detail: 'Disco superior de titanio oscuro con bisel crema y pulso orange.',
    className: 'metalLayer',
    x: -18,
    y: -380,
    scale: 0.98,
    rotate: -4,
  },
  {
    name: 'Cristal translúcido',
    detail: 'Capa óptica con la silueta del logo grabada en vidrio técnico.',
    className: 'glassLayer',
    x: 16,
    y: -245,
    scale: 1.02,
    rotate: 3,
  },
  {
    name: 'Circuitos holográficos',
    detail: 'Trazos de datos y rutas internas de señal.',
    className: 'circuitLayer',
    x: -10,
    y: -95,
    scale: 0.98,
    rotate: -2,
  },
  {
    name: 'Estructura geométrica',
    detail: 'La silueta intacta del emblema como chasis visual.',
    className: 'structureLayer',
    x: 0,
    y: 70,
    scale: 1,
    rotate: 0,
  },
  {
    name: 'Núcleo IA',
    detail: 'Lógica algorítmica y procesamiento de señales.',
    className: 'aiLayer',
    x: 10,
    y: 225,
    scale: 0.9,
    rotate: 2,
  },
  {
    name: 'Base energética',
    detail: 'Base inferior en navy con glow cian y presencia orange.',
    className: 'energyLayer',
    x: -14,
    y: 370,
    scale: 0.88,
    rotate: -3,
  },
]

const LEFT_LABELS = [
  {
    title: 'Núcleo IA',
    body: 'Representa la lógica algorítmica y el procesamiento avanzado de señales.',
  },
  {
    title: 'Estructura geométrica',
    body: 'Diseño preciso inspirado en tecnología financiera moderna.',
  },
  {
    title: 'Capas volumétricas',
    body: 'Profundidad visual premium con sensación cinematográfica.',
  },
]

const RIGHT_LABELS = [
  {
    title: 'Superficie metálica',
    body: 'Acabado brillante futurista con reflejos azul eléctrico.',
  },
  {
    title: 'Iluminación reactiva',
    body: 'Efectos neón inspirados en interfaces de IA.',
  },
  {
    title: 'Cristal translúcido',
    body: 'Detalles modernos con sensación tecnológica avanzada.',
  },
  {
    title: 'Partículas digitales',
    body: 'Movimiento visual elegante inspirado en datos financieros.',
  },
]

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export default function ExplodedMateriaPage() {
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    let frame = 0
    const update = () => {
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      const next = maxScroll <= 0 ? 0 : clamp(window.scrollY / maxScroll, 0, 1)
      setProgress(next)
    }
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [])

  const explode = clamp((progress - 0.08) / 0.66, 0, 1)
  const settle = clamp((progress - 0.78) / 0.18, 0, 1)
  const displayProgress = Math.round(explode * 100)
  const stageTiltX = 68 * explode
  const stageTiltY = -12 * explode
  const stageSpin = 6 * explode

  return (
    <main className="explodedPage">
      <section className="posterStage">
        <div className="ambientGrid" />
        <div className="plasma plasmaOne" />
        <div className="plasma plasmaTwo" />
        <div className="plasma plasmaThree" />

        <header className="topHud">
          <div>
            <span className="hudLogo">◉ GonOvi / AlgoTrend</span>
            <p>Un sistema construido desde la estructura para visualizar inteligencia y precisión.</p>
          </div>
          <div className="scrollMeter" aria-label={`Progreso de explosión ${displayProgress}%`}>
            <span style={{ transform: `scaleX(${Math.max(0.06, explode)})` }} />
          </div>
        </header>

        <aside className="callouts leftCallouts">
          {LEFT_LABELS.map((label, index) => (
            <article
              className="callout"
              key={label.title}
              style={{ '--delay': `${index * 0.08}s` } as CSSProperties}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <h2>{label.title}</h2>
              <p>{label.body}</p>
            </article>
          ))}
        </aside>

        <section
          aria-label="Logotipo GONOVI en vista explosionada"
          className="logoExploded"
          style={{
            transform: `
              translate(-50%, -50%)
              rotateX(${stageTiltX}deg)
              rotateY(${stageTiltY}deg)
              rotateZ(${stageSpin}deg)
            `,
          }}
        >
          <div className="assemblyHalo" style={{ opacity: 0.18 + explode * 0.58 }} />
          <div className="stackSpine" style={{ opacity: explode }} />
          <div className="orbitRing ringOne" style={{ opacity: 0.16 + explode * 0.52 }} />
          <div className="orbitRing ringTwo" style={{ opacity: 0.08 + explode * 0.36 }} />
          <div className="energyCore" style={{ transform: `scale(${0.78 + explode * 0.55})` }} />
          <div className="dataParticles" aria-hidden="true">
            {Array.from({ length: 22 }, (_, index) => {
              const angle = index * 16.36
              const radius = 11 + explode * 10

              return (
                <span
                  key={index}
                  style={{
                    opacity: 0.12 + explode * 0.64,
                    transform: `
                      rotate(${angle}deg)
                      translateX(${radius}rem)
                      rotate(${-angle}deg)
                    `,
                  }}
                />
              )
            })}
          </div>

          {LAYERS.map((layer, index) => {
            const depth = 1 + index * 0.08
            const translateX = layer.x * explode
            const translateY = layer.y * explode
            const translateZ = (index - (LAYERS.length - 1) / 2) * 92 * explode
            const scale = 1 + (layer.scale - 1) * explode - settle * 0.035
            const rotate = layer.rotate * explode
            const layerTilt = (index - 2.5) * 5 * explode
            const opacity = 0.9 - index * 0.035 + explode * 0.12

            return (
              <div
                aria-label={`${layer.name}: ${layer.detail}`}
                className={`logoLayer ${layer.className}`}
                key={layer.name}
                style={{
                  zIndex: 20 + index,
                  opacity,
                  transform: `
                    translate3d(${translateX}px, ${translateY}px, ${translateZ}px)
                    rotateX(${layerTilt}deg)
                    rotate(${rotate}deg)
                    scale(${scale * depth})
                  `,
                }}
              >
                <b aria-hidden="true" className="layerRim" />
                <b aria-hidden="true" className="layerGlow" />
                {Array.from({ length: DEPTH_SLICES }, (_, sliceIndex) => (
                  <i
                    aria-hidden="true"
                    className="depthSlice"
                    key={sliceIndex}
                    style={
                      {
                        opacity: 0.18 + sliceIndex * 0.052,
                        zIndex: sliceIndex + 1,
                        filter: `brightness(${0.58 + sliceIndex * 0.035})`,
                        transform: `
                          translate3d(${sliceIndex * 2.2}px, ${sliceIndex * 4.8}px, ${sliceIndex * -7}px)
                          scale(${1 - sliceIndex * 0.002})
                        `,
                      } as CSSProperties
                    }
                  />
                ))}
                <span style={{ opacity: explode }}>{layer.name}</span>
              </div>
            )
          })}
        </section>

        <aside className="callouts rightCallouts">
          {RIGHT_LABELS.map((label, index) => (
            <article
              className="callout"
              key={label.title}
              style={{ '--delay': `${index * 0.08 + 0.1}s` } as CSSProperties}
            >
              <span>{String(index + 4).padStart(2, '0')}</span>
              <h2>{label.title}</h2>
              <p>{label.body}</p>
            </article>
          ))}
        </aside>

        <footer className="posterFooter">
          <div>
            <h2>La identidad evoluciona desde la estructura.</h2>
            <p>
              Cada capa del logotipo representa precisión, tecnología e inteligencia visual
              aplicada al trading moderno. El diseño transmite una sensación premium,
              futurista y cinematográfica alineada con la estética AlgoTrend.
            </p>
          </div>
          <strong>◉ AlgoTrend</strong>
        </footer>
      </section>

      <section className="afterPanel">
        <span>Scroll animation prototype</span>
        <h2>La siguiente iteración puede convertir estas capas CSS en meshes reales de Three.js.</h2>
        <p>
          Esta versión prioriza dirección visual, composición y timing. La silueta sale del SVG
          original como máscara, así la forma del logo no se reinterpreta.
        </p>
      </section>

      <style jsx>{`
        .explodedPage {
          min-height: 380vh;
          background:
            radial-gradient(circle at 50% 10%, rgba(64, 128, 255, 0.2), transparent 28rem),
            linear-gradient(180deg, #0b1024 0%, #11162a 42%, #060914 100%);
          color: #f2dfc3;
          font-family: var(--font-space-grotesk), var(--gon-font-display), system-ui, sans-serif;
        }

        .posterStage {
          position: sticky;
          top: 0;
          min-height: 100vh;
          overflow: hidden;
          isolation: isolate;
          background:
            radial-gradient(circle at 18% 12%, rgba(244, 78, 28, 0.18), transparent 28rem),
            radial-gradient(circle at 78% 18%, rgba(248, 218, 194, 0.1), transparent 22rem),
            radial-gradient(circle at 52% 112%, rgba(201, 168, 122, 0.11), transparent 34rem),
            linear-gradient(180deg, #1c223a 0%, #11162a 58%, #0d1122 100%);
        }

        .ambientGrid {
          position: absolute;
          inset: -20%;
          z-index: -4;
          background:
            linear-gradient(rgba(79, 85, 112, 0.2) 1px, transparent 1px),
            linear-gradient(90deg, rgba(201, 168, 122, 0.08) 1px, transparent 1px);
          background-size: 34px 34px;
          mask-image: radial-gradient(circle at 50% 50%, black, transparent 72%);
          transform: rotate(-5deg);
        }

        .plasma {
          position: absolute;
          z-index: -3;
          border-radius: 999px;
          filter: blur(58px);
          pointer-events: none;
        }

        .plasmaOne {
          width: 34vw;
          height: 34vw;
          right: 5vw;
          top: 10vh;
          background: rgba(244, 78, 28, 0.18);
        }

        .plasmaTwo {
          width: 28vw;
          height: 28vw;
          left: 22vw;
          bottom: 3vh;
          background: rgba(248, 218, 194, 0.12);
        }

        .plasmaThree {
          width: 22vw;
          height: 22vw;
          left: 46vw;
          top: 34vh;
          background: rgba(64, 128, 255, 0.12);
        }

        .topHud {
          position: absolute;
          top: clamp(1.25rem, 3vw, 3rem);
          left: clamp(1.25rem, 4vw, 4.5rem);
          right: clamp(1.25rem, 4vw, 4.5rem);
          z-index: 70;
          display: flex;
          justify-content: space-between;
          gap: 2rem;
          color: rgba(242, 223, 195, 0.8);
        }

        .hudLogo {
          display: inline-flex;
          width: fit-content;
          margin-bottom: 0.7rem;
          padding: 0.34rem 0.62rem;
          background: #f2dfc3;
          color: #11162a;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 0.68rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .topHud p {
          max-width: 36rem;
          margin: 0;
          font-size: clamp(0.95rem, 1.4vw, 1.3rem);
          line-height: 1.35;
          color: rgba(242, 223, 195, 0.66);
        }

        .scrollMeter {
          width: min(25vw, 21rem);
          height: 0.54rem;
          border: 1px solid rgba(242, 223, 195, 0.16);
          background: rgba(6, 9, 20, 0.64);
          overflow: hidden;
        }

        .scrollMeter span {
          display: block;
          width: 100%;
          height: 100%;
          transform-origin: left center;
          background: linear-gradient(90deg, #ec5e27, #44d9ff, #f2dfc3);
        }

        .logoExploded {
          position: absolute;
          inset: 50% auto auto 50%;
          width: min(42vw, 36rem);
          aspect-ratio: 1;
          transform-style: preserve-3d;
          perspective: 1600px;
          will-change: transform;
        }

        .assemblyHalo {
          position: absolute;
          inset: -6%;
          z-index: 0;
          border-radius: 50%;
          background:
            radial-gradient(circle at 50% 50%, rgba(68, 217, 255, 0.2), transparent 31%),
            conic-gradient(from 220deg, transparent 0 18%, rgba(236, 94, 39, 0.52), transparent 35% 58%, rgba(242, 223, 195, 0.42), transparent 76%);
          filter: blur(8px);
          transform: translateZ(-180px) rotateX(68deg) scale(1.2);
          pointer-events: none;
        }

        .stackSpine {
          position: absolute;
          left: 50%;
          top: -34%;
          z-index: 1;
          width: 3px;
          height: 168%;
          transform: translateX(-50%) translateZ(-80px);
          background: linear-gradient(
            180deg,
            transparent,
            rgba(68, 217, 255, 0.82) 18%,
            rgba(242, 223, 195, 0.64) 48%,
            rgba(236, 94, 39, 0.68) 72%,
            transparent
          );
          box-shadow:
            0 0 18px rgba(68, 217, 255, 0.78),
            0 0 42px rgba(236, 94, 39, 0.28);
          pointer-events: none;
        }

        .logoLayer {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
          transform-origin: center;
          transition: opacity 120ms linear;
          will-change: transform, opacity;
          filter:
            drop-shadow(0 38px 52px rgba(0, 0, 0, 0.5))
            drop-shadow(0 0 26px rgba(68, 217, 255, 0.18))
            drop-shadow(0 0 24px rgba(236, 94, 39, 0.14));
        }

        .layerRim,
        .layerGlow {
          position: absolute;
          pointer-events: none;
          border-radius: 50%;
          transform-style: preserve-3d;
        }

        .layerRim {
          inset: 3.5%;
          z-index: 0;
          border: 1.05rem solid rgba(242, 223, 195, 0.78);
          background:
            radial-gradient(circle at 52% 52%, rgba(6, 9, 20, 0.3) 0 54%, transparent 55%),
            linear-gradient(130deg, rgba(255, 247, 224, 0.25), rgba(17, 22, 42, 0.92) 45%, rgba(236, 94, 39, 0.3));
          box-shadow:
            inset 0 1px 0 rgba(255, 247, 224, 0.7),
            inset 0 -18px 34px rgba(0, 0, 0, 0.36),
            0 16px 36px rgba(0, 0, 0, 0.34);
          transform: translate3d(18px, 34px, -82px);
        }

        .layerGlow {
          inset: 2%;
          z-index: 18;
          border: 2px solid rgba(68, 217, 255, 0.54);
          box-shadow:
            0 0 18px rgba(68, 217, 255, 0.74),
            0 0 42px rgba(68, 217, 255, 0.3),
            inset 0 0 24px rgba(68, 217, 255, 0.18);
          transform: translateZ(48px);
        }

        .logoLayer::before,
        .depthSlice {
          content: '';
          position: absolute;
          inset: 8%;
          background: #f2dfc3;
          mask: url('/logo-gon-mark.svg') center / contain no-repeat;
          -webkit-mask: url('/logo-gon-mark.svg') center / contain no-repeat;
        }

        .logoLayer::before {
          z-index: 14;
          transform: translateZ(48px);
          box-shadow:
            inset 0 1px 0 rgba(255, 248, 226, 0.46),
            inset 0 -24px 46px rgba(0, 0, 0, 0.3);
        }

        .depthSlice {
          background: var(--depth-color, #6f4b2e);
        }

        .logoLayer::after {
          content: '';
          position: absolute;
          inset: 8%;
          z-index: 16;
          opacity: 0.34;
          mix-blend-mode: screen;
          background:
            radial-gradient(circle at 30% 22%, rgba(255, 246, 220, 0.42), transparent 14%),
            radial-gradient(circle at 68% 74%, rgba(244, 78, 28, 0.42), transparent 20%),
            repeating-linear-gradient(112deg, rgba(255, 255, 255, 0.14) 0 1px, transparent 1px 9px);
          mask: url('/logo-gon-mark.svg') center / contain no-repeat;
          -webkit-mask: url('/logo-gon-mark.svg') center / contain no-repeat;
          pointer-events: none;
        }

        .logoLayer span {
          position: absolute;
          left: 50%;
          top: 106%;
          transform: translateX(-50%);
          color: rgba(242, 223, 195, 0.58);
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 0.55rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          white-space: nowrap;
          transition: opacity 160ms linear;
        }

        .metalLayer::before {
          --depth-color: #6f4325;
          background:
            radial-gradient(circle at 26% 16%, #fff0d8 0%, transparent 17%),
            linear-gradient(128deg, #f2dfc3 0%, #c9a87a 22%, #1a1814 48%, #ec5e27 72%, #3a2a24 100%);
        }

        .metalLayer {
          --depth-color: #2b2c36;
        }

        .metalLayer .layerRim {
          border-color: rgba(242, 223, 195, 0.84);
          background:
            radial-gradient(circle at 50% 50%, rgba(17, 22, 42, 0.2) 0 51%, transparent 52%),
            linear-gradient(135deg, #f2dfc3, #2a2c38 38%, #0c1020 64%, #ec5e27);
        }

        .metalLayer .layerGlow {
          border-color: rgba(236, 94, 39, 0.56);
          box-shadow:
            0 0 20px rgba(236, 94, 39, 0.72),
            0 0 48px rgba(236, 94, 39, 0.24),
            inset 0 0 18px rgba(242, 223, 195, 0.16);
        }

        .glassLayer::before {
          background:
            linear-gradient(150deg, rgba(255, 245, 226, 0.72), rgba(201, 168, 122, 0.2), rgba(244, 78, 28, 0.08));
          opacity: 0.48;
          backdrop-filter: blur(12px);
        }

        .glassLayer {
          --depth-color: rgba(40, 74, 102, 0.64);
        }

        .glassLayer .layerRim {
          border-color: rgba(242, 223, 195, 0.22);
          background: rgba(68, 217, 255, 0.06);
          box-shadow:
            inset 0 0 26px rgba(242, 223, 195, 0.12),
            0 0 34px rgba(68, 217, 255, 0.28);
        }

        .glassLayer .layerGlow {
          border-color: rgba(68, 217, 255, 0.82);
        }

        .circuitLayer::before {
          background:
            linear-gradient(90deg, rgba(201, 168, 122, 0.45) 1px, transparent 1px),
            linear-gradient(rgba(244, 78, 28, 0.62) 1px, transparent 1px),
            #11162a;
          background-size: 42px 42px, 42px 42px, auto;
        }

        .circuitLayer {
          --depth-color: #1c223a;
        }

        .circuitLayer .layerRim {
          border-color: rgba(68, 217, 255, 0.34);
          background:
            radial-gradient(circle at 50% 50%, rgba(17, 22, 42, 0.18) 0 52%, transparent 53%),
            repeating-conic-gradient(from 20deg, rgba(68, 217, 255, 0.28) 0 4deg, rgba(17, 22, 42, 0.8) 4deg 12deg);
        }

        .circuitLayer .layerGlow {
          border-color: rgba(68, 217, 255, 0.72);
          box-shadow:
            0 0 22px rgba(68, 217, 255, 0.78),
            0 0 56px rgba(68, 217, 255, 0.3);
        }

        .structureLayer::before {
          background:
            radial-gradient(circle at 50% 42%, rgba(236, 94, 39, 0.42), transparent 16%),
            linear-gradient(135deg, #f2dfc3, #c9a87a 44%, #3a2f25 72%, #ec5e27);
        }

        .structureLayer {
          --depth-color: #8b5a32;
        }

        .structureLayer .layerRim {
          border-color: rgba(236, 94, 39, 0.52);
          background:
            radial-gradient(circle at 50% 50%, rgba(6, 9, 20, 0.24) 0 52%, transparent 53%),
            linear-gradient(135deg, rgba(236, 94, 39, 0.86), rgba(242, 223, 195, 0.54), rgba(17, 22, 42, 0.88));
        }

        .structureLayer .layerGlow {
          border-color: rgba(242, 223, 195, 0.55);
        }

        .aiLayer::before {
          inset: 18%;
          background:
            radial-gradient(circle, #f2dfc3 0%, #ec5e27 28%, rgba(244, 78, 28, 0.05) 62%);
          filter: blur(0.2px) drop-shadow(0 0 38px rgba(244, 78, 28, 0.7));
        }

        .aiLayer {
          --depth-color: #552516;
        }

        .aiLayer .layerRim {
          inset: 12%;
          border-width: 0.72rem;
          border-color: rgba(236, 94, 39, 0.64);
          background: radial-gradient(circle, rgba(236, 94, 39, 0.3), rgba(17, 22, 42, 0.74) 64%);
        }

        .aiLayer .layerGlow {
          inset: 11%;
          border-color: rgba(236, 94, 39, 0.78);
          box-shadow:
            0 0 26px rgba(236, 94, 39, 0.82),
            0 0 64px rgba(236, 94, 39, 0.28);
        }

        .energyLayer::before {
          inset: 23%;
          background:
            radial-gradient(circle, #fff2cf 0%, #ec5e27 36%, rgba(236, 94, 39, 0.06) 68%);
          filter: drop-shadow(0 0 48px rgba(236, 94, 39, 0.78));
        }

        .energyLayer {
          --depth-color: #11162a;
        }

        .energyLayer .layerRim {
          border-color: rgba(28, 34, 58, 0.98);
          background:
            radial-gradient(circle at 50% 50%, rgba(236, 94, 39, 0.1) 0 52%, transparent 53%),
            linear-gradient(135deg, #1c223a, #060914 58%, #ec5e27);
          box-shadow:
            inset 0 1px 0 rgba(242, 223, 195, 0.18),
            0 0 32px rgba(68, 217, 255, 0.28),
            0 28px 62px rgba(0, 0, 0, 0.55);
        }

        .energyLayer .layerGlow {
          border-color: rgba(68, 217, 255, 0.9);
          box-shadow:
            0 0 22px rgba(68, 217, 255, 0.82),
            0 0 70px rgba(68, 217, 255, 0.4),
            inset 0 0 30px rgba(236, 94, 39, 0.14);
        }

        .orbitRing {
          position: absolute;
          inset: 0;
          border-radius: 50%;
          pointer-events: none;
          border: 1px solid rgba(68, 217, 255, 0.6);
          box-shadow:
            0 0 36px rgba(64, 128, 255, 0.32),
            inset 0 0 24px rgba(242, 223, 195, 0.08);
        }

        .ringOne {
          transform: rotateX(64deg) rotateZ(-18deg) scale(1.22);
        }

        .ringTwo {
          border-color: rgba(236, 94, 39, 0.58);
          transform: rotateX(64deg) rotateZ(24deg) scale(0.84);
        }

        .energyCore {
          position: absolute;
          inset: 31%;
          border-radius: 50%;
          background:
            radial-gradient(circle, rgba(242, 223, 195, 0.88), rgba(68, 217, 255, 0.42) 30%, rgba(236, 94, 39, 0.12) 58%, transparent 70%);
          filter: blur(5px);
          opacity: 0.72;
        }

        .dataParticles {
          position: absolute;
          inset: -6%;
          pointer-events: none;
        }

        .dataParticles span {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 0.34rem;
          height: 0.34rem;
          border-radius: 999px;
          background: #44d9ff;
          box-shadow: 0 0 18px rgba(68, 217, 255, 0.82);
        }

        .callouts {
          position: absolute;
          top: 21vh;
          z-index: 60;
          display: grid;
          gap: 1rem;
          width: min(22vw, 21rem);
        }

        .leftCallouts {
          left: clamp(1rem, 4vw, 4.5rem);
        }

        .rightCallouts {
          right: clamp(1rem, 4vw, 4.5rem);
        }

        .callout {
          position: relative;
          padding: 1rem 1rem 1rem 1.08rem;
          border: 1px solid rgba(242, 223, 195, 0.16);
          background:
            linear-gradient(135deg, rgba(242, 223, 195, 0.075), rgba(64, 128, 255, 0.03)),
            rgba(6, 9, 20, 0.46);
          box-shadow: inset 0 1px 0 rgba(242, 223, 195, 0.08);
          backdrop-filter: blur(18px);
          animation: calloutIn 700ms cubic-bezier(0.16, 1, 0.3, 1) both;
          animation-delay: var(--delay);
        }

        .callout::after {
          content: '';
          position: absolute;
          top: 50%;
          width: 4.2rem;
          height: 1px;
          background: linear-gradient(90deg, rgba(68, 217, 255, 0.0), rgba(68, 217, 255, 0.7));
        }

        .leftCallouts .callout::after {
          right: -4.2rem;
        }

        .rightCallouts .callout::after {
          left: -4.2rem;
          transform: rotate(180deg);
        }

        .callout span {
          color: #ec5e27;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 0.62rem;
          font-weight: 800;
          letter-spacing: 0.16em;
        }

        .callout h2 {
          margin: 0.3rem 0 0.3rem;
          color: #f2dfc3;
          font-size: clamp(1rem, 1.45vw, 1.42rem);
          letter-spacing: -0.04em;
        }

        .callout p {
          margin: 0;
          color: rgba(242, 223, 195, 0.62);
          font-size: 0.82rem;
          line-height: 1.35;
        }

        .posterFooter {
          position: absolute;
          left: clamp(1.25rem, 4vw, 4.5rem);
          right: clamp(1.25rem, 4vw, 4.5rem);
          bottom: clamp(1rem, 3vw, 2.6rem);
          z-index: 70;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 2rem;
          border-top: 1px solid rgba(242, 223, 195, 0.14);
          padding-top: 1rem;
        }

        .posterFooter h2 {
          max-width: 42rem;
          margin: 0 0 0.5rem;
          color: #f2dfc3;
          font-size: clamp(1.4rem, 2.4vw, 2.8rem);
          letter-spacing: -0.06em;
          line-height: 0.92;
        }

        .posterFooter p {
          max-width: 54rem;
          margin: 0;
          color: rgba(242, 223, 195, 0.62);
          font-size: 0.9rem;
          line-height: 1.42;
        }

        .posterFooter strong {
          color: #f2dfc3;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 0.82rem;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .afterPanel {
          min-height: 100vh;
          display: grid;
          place-content: center;
          padding: 8rem 7vw;
          background:
            radial-gradient(circle at 50% 0%, rgba(64, 128, 255, 0.16), transparent 26rem),
            #060914;
        }

        .afterPanel span {
          width: fit-content;
          margin-bottom: 1rem;
          padding: 0.34rem 0.62rem;
          background: #ec5e27;
          color: #11162a;
          font-family: var(--font-jetbrains-mono), monospace;
          font-size: 0.7rem;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }

        .afterPanel h2 {
          max-width: 62rem;
          margin: 0;
          font-size: clamp(2.4rem, 7vw, 6.8rem);
          letter-spacing: -0.08em;
          line-height: 0.88;
        }

        .afterPanel p {
          max-width: 44rem;
          color: rgba(242, 223, 195, 0.66);
          font-size: 1.1rem;
          line-height: 1.55;
        }

        @keyframes calloutIn {
          from {
            opacity: 0;
            transform: translateY(14px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 1050px) {
          .topHud {
            position: fixed;
          }

          .logoExploded {
            width: min(76vw, 32rem);
          }

          .callouts {
            display: none;
          }

          .posterFooter {
            display: none;
          }
        }

        @media (max-width: 720px) {
          .topHud {
            flex-direction: column;
          }

          .scrollMeter {
            width: 100%;
          }

          .logoExploded {
            width: min(92vw, 27rem);
          }

        }
      `}</style>
    </main>
  )
}
