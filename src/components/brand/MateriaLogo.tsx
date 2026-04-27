'use client'

/**
 * MateriaLogo · GON brand
 * Concepto 3 — "Materia"
 *
 * Hero 3D del emblema GON. Superficie viscosa (PBR + clearcoat) con
 * desplazamiento por noise simplex 3D en la cara frontal. Reacciona al puntero
 * (perturbación local) y al click sostenido (calmar la materia). Camera entry
 * de 1800ms desde 60° lateral hasta frontal. Falls back to <img> si WebGL2
 * no está disponible.
 *
 * Uso:
 *   <MateriaLogo />
 *   <MateriaLogo height="80vh" />
 *   <MateriaLogo svgUrl="/logo-gon-mark.svg" amplitude={6} />
 *
 * El SVG debe ser el del emblema solo (sin círculo de fondo). Default
 * '/logo-gon-mark.svg' que ya cumple.
 */

import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import * as THREE from 'three'
import { SVGLoader, type SVGResult } from 'three/examples/jsm/loaders/SVGLoader.js'

// ──────────────────────────────────────────────────────────────────────────────
// Tipos públicos
// ──────────────────────────────────────────────────────────────────────────────
export interface MateriaLogoProps {
  /** Altura del canvas. Default '100vh' */
  height?: string | number
  /** URL del SVG del emblema (sin fondo). Default '/logo-gon-mark.svg' */
  svgUrl?: string
  /** Color base del material (hex). Default Ink */
  baseColor?: number
  /** Color de fondo del canvas (hex). Default Ink oscuro */
  background?: number
  /** Amplitud del noise base (px de desplazamiento). Default 8 */
  amplitude?: number
  /** Habilitar entry desde 60° lateral. Default true */
  entryAnimation?: boolean
  /** Distancia de cámara en reposo (Z). Default 1500 */
  cameraDistance?: number
  /** El logo gira sutilmente siguiendo al cursor. Default true */
  cursorTilt?: boolean
  /** Habilitar zoom con rueda del mouse. Default true */
  enableZoom?: boolean
  /** Distancia mínima de zoom (más cerca). Default 600 */
  minZoom?: number
  /** Distancia máxima de zoom (más lejos). Default 3000 */
  maxZoom?: number
  /** Class CSS opcional para el wrapper */
  className?: string
  /** Estilo CSS opcional para el wrapper */
  style?: CSSProperties
}

// ──────────────────────────────────────────────────────────────────────────────
// Constantes y utilidades
// ──────────────────────────────────────────────────────────────────────────────

const ENTRY_OFFSET = new THREE.Vector3(900, 200, -800) // delta vs REST_CAM al inicio
const ENTRY_DUR    = 1.8 // seconds
const TILT_MAX_Y   = THREE.MathUtils.degToRad(15) // ±15° rotación horizontal
const TILT_MAX_X   = THREE.MathUtils.degToRad(10) // ±10° rotación vertical
const TILT_LERP    = 0.06
const ZOOM_LERP    = 0.12
// Bias permanente del eje X: por defecto el logo está tilteado con el top
// hacia atrás, para que la luz del key catch el bevel superior y produzca el
// look plateado. Equivalente a tener el cursor al 60% hacia abajo siempre.
const TILT_REST_BIAS_Y = -0.6

const easeOutQuint = (t: number) => 1 - Math.pow(1 - t, 5)

// Simplex 3D noise (ashima/webgl-noise) inyectado en el vertex shader
const NOISE_GLSL = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
               i.z + vec4(0.0, i1.z, i2.z, 1.0))
             + i.y + vec4(0.0, i1.y, i2.y, 1.0))
             + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
  }
`

// ──────────────────────────────────────────────────────────────────────────────
// Detección WebGL2 (single-shot, cached)
// ──────────────────────────────────────────────────────────────────────────────
function detectWebGL2(): boolean {
  if (typeof document === 'undefined') return true // SSR optimistic
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Mesh de Materia (dentro del Canvas)
// ──────────────────────────────────────────────────────────────────────────────
interface MateriaMeshProps {
  svgUrl: string
  baseColor: number
  amplitude: number
  cursorTilt: boolean
  entryDoneRef: React.MutableRefObject<boolean>
}

function MateriaMesh({ svgUrl, baseColor, amplitude, cursorTilt, entryDoneRef }: MateriaMeshProps) {
  const tiltGroupRef  = useRef<THREE.Group>(null)
  const groupRef      = useRef<THREE.Group>(null)
  const tiltTarget    = useRef(new THREE.Vector2(0, 0))
  const tiltCurrent   = useRef(new THREE.Vector2(0, 0))

  // Uniforms compartidos entre material y useFrame
  const uniformsRef = useRef({
    uTime:          { value: 0 },
    uMouse:         { value: new THREE.Vector2(0.5, 0.5) },
    uMouseStrength: { value: 0 },
    uCalm:          { value: 0 },
    uAmp:           { value: amplitude },
  })

  // Estado del puntero
  const targetMouse  = useRef(new THREE.Vector2(0.5, 0.5))
  const currentMouse = useRef(new THREE.Vector2(0.5, 0.5))
  const mouseDownRef = useRef(false)
  const [hovering, setHovering] = useState(false)

  // Cargar SVG y construir geometrías
  const svgData = useLoader(SVGLoader, svgUrl) as SVGResult

  const geometries = useMemo(() => {
    const geoms: THREE.BufferGeometry[] = []
    svgData.paths.forEach((path) => {
      const shapes = SVGLoader.createShapes(path)
      shapes.forEach((shape) => {
        const g = new THREE.ExtrudeGeometry(shape, {
          depth: 80,
          bevelEnabled: true,
          bevelThickness: 4,
          bevelSize: 3,
          bevelOffset: 0,
          bevelSegments: 3,
          curveSegments: 64,
          steps: 1,
        })
        g.computeVertexNormals()
        geoms.push(g)
      })
    })
    return geoms
  }, [svgData])

  // Material: PBR Ink viscoso con clearcoat + noise injection
  const material = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: 0.18,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
      reflectivity: 0.4,
    })

    mat.onBeforeCompile = (shader) => {
      const u = uniformsRef.current
      shader.uniforms.uTime          = u.uTime
      shader.uniforms.uMouse         = u.uMouse
      shader.uniforms.uMouseStrength = u.uMouseStrength
      shader.uniforms.uCalm          = u.uCalm
      shader.uniforms.uAmp           = u.uAmp

      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform float uTime;
           uniform vec2  uMouse;
           uniform float uMouseStrength;
           uniform float uCalm;
           uniform float uAmp;
           varying vec2  vGonUV;
           varying float vGonHeat;
           ${NOISE_GLSL}`
        )
        .replace(
          '#include <begin_vertex>',
          `
          vec3 transformed = vec3(position);

          float frontFactor = smoothstep(0.5, 1.0, normal.z);

          vec2 localUV = (position.xy + 500.0) / 1000.0;
          vGonUV = localUV;

          float n = snoise(vec3(position.x * 0.004, position.y * 0.004, uTime * 0.25)) * 0.5
                  + snoise(vec3(position.x * 0.012, position.y * 0.012, uTime * 0.4))  * 0.25;

          float dist = distance(localUV, uMouse);
          float mouseAmp = smoothstep(0.28, 0.0, dist) * uMouseStrength;
          vGonHeat = mouseAmp * frontFactor; // pass to fragment for copper tint

          float aliveAmp = mix(uAmp, 0.0, uCalm);

          // Mouse displacement aumentado de 32 → 60 para picos más altos
          // y walls más visibles con el tint copper.
          transformed += normal * (n * aliveAmp + mouseAmp * 60.0) * frontFactor;
          `
        )

      // Fragment shader: cursor-shadow + copper tint en peaks.
      // - Shadow sutil bajo el cursor (no anula el peak)
      // - Tint copper-orange en zonas displaceadas: las walls de los picos
      //   adquieren el color del rim light "desde dentro" del material.
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform vec2  uMouse;
           uniform float uMouseStrength;
           varying vec2  vGonUV;
           varying float vGonHeat;`
        )
        .replace(
          '#include <color_fragment>',
          `#include <color_fragment>
           // 1) Sombra sutil bajo el cursor (no apaga los peaks)
           float gonCursorDist = distance(vGonUV, uMouse);
           float gonShadow = smoothstep(0.0, 0.40, gonCursorDist);
           gonShadow = mix(1.0, gonShadow, uMouseStrength * 0.45);
           diffuseColor.rgb *= gonShadow;
           // 2) Tint copper-orange profundo en peaks (las walls "brillan" desde dentro)
           vec3 gonHeatColor = vec3(0.88, 0.30, 0.05); // ~ #E04D0D — burnt orange saturado
           diffuseColor.rgb = mix(diffuseColor.rgb, gonHeatColor, vGonHeat * 0.95);`
        )
    }

    return mat
  }, [baseColor])

  // Centrar el grupo después de cargar
  useEffect(() => {
    if (!groupRef.current) return
    const bbox = new THREE.Box3().setFromObject(groupRef.current)
    const center = bbox.getCenter(new THREE.Vector3())
    groupRef.current.position.sub(center)
  }, [geometries])

  // Mantener uAmp sincronizado si cambia la prop
  useEffect(() => {
    uniformsRef.current.uAmp.value = amplitude
  }, [amplitude])

  // Tracking del cursor a nivel ventana (no solo sobre el mesh) para tilt.
  // Coords normalizadas -1..1 en ambos ejes. NDC standard.
  useEffect(() => {
    if (!cursorTilt) return
    const onMove = (e: PointerEvent) => {
      tiltTarget.current.set(
        (e.clientX / window.innerWidth)  * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1)
      )
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [cursorTilt])

  // Loop por frame
  useFrame((state) => {
    const u = uniformsRef.current
    u.uTime.value = state.clock.elapsedTime

    // Smooth lerp de mouse uv y strength
    currentMouse.current.lerp(targetMouse.current, 0.12)
    u.uMouse.value.copy(currentMouse.current)

    const targetStrength = hovering ? 1 : 0
    u.uMouseStrength.value += (targetStrength - u.uMouseStrength.value) * 0.08

    const targetCalm = mouseDownRef.current ? 1 : 0
    u.uCalm.value += (targetCalm - u.uCalm.value) * 0.02

    // Cursor tilt: solo después de la entrada, rotación sutil hacia el cursor.
    // Negate Y (rotation.y) para que el lado que apunta al cursor "venga hacia"
    // el viewer, no se aleje. El eje X tiene bias permanente para que el look
    // plateado del bevel superior sea el default (sin tener que bajar el cursor).
    if (cursorTilt && entryDoneRef.current && tiltGroupRef.current) {
      tiltCurrent.current.lerp(tiltTarget.current, TILT_LERP)
      tiltGroupRef.current.rotation.y = -tiltCurrent.current.x * TILT_MAX_Y
      tiltGroupRef.current.rotation.x = (tiltCurrent.current.y + TILT_REST_BIAS_Y) * TILT_MAX_X
    }
  })

  // Pointer handlers — calculan UV local en el espacio del logo.
  // worldToLocal ya deshace el scale.y = -1 del group, así que local.y es la Y
  // original del vértice (la misma que ve el shader). NO negar.
  const handlePointerMove = (e: { point: THREE.Vector3 }) => {
    if (!groupRef.current) return
    const local = groupRef.current.worldToLocal(e.point.clone())
    targetMouse.current.set(
      (local.x + 500) / 1000,
      (local.y + 500) / 1000
    )
    setHovering(true)
  }
  const handlePointerOut = () => setHovering(false)

  return (
    // Outer group: solo aplica tilt rotation. Inner group: Y flip + centering
    // + handlers de puntero. Separar capas evita conflicto entre rotaciones.
    // rotation X inicial = bias permanente, evita "salto" al activar tilt
    // post-entry (durante entry el grupo ya está en la posición final).
    <group ref={tiltGroupRef} rotation={[TILT_REST_BIAS_Y * TILT_MAX_X, 0, 0]}>
      <group
        ref={groupRef}
        scale={[1, -1, 1]} // SVGLoader usa Y invertida
        onPointerMove={handlePointerMove}
        onPointerOut={handlePointerOut}
        onPointerDown={() => { mouseDownRef.current = true }}
        onPointerUp={() => { mouseDownRef.current = false }}
      >
        {geometries.map((g, i) => (
          <mesh key={i} geometry={g} material={material} />
        ))}
      </group>
    </group>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Camera rig: entry animation desde 60° lateral hasta frontal
// ──────────────────────────────────────────────────────────────────────────────
interface CameraEntryProps {
  enabled: boolean
  restDistance: number
  doneRef: React.MutableRefObject<boolean>
}

function CameraEntry({ enabled, restDistance, doneRef }: CameraEntryProps) {
  const { camera } = useThree()
  const startRef = useRef<number | null>(null)

  const restPos  = useMemo(() => new THREE.Vector3(0, 0, restDistance), [restDistance])
  const entryPos = useMemo(
    () => new THREE.Vector3().copy(restPos).add(ENTRY_OFFSET),
    [restPos]
  )

  useEffect(() => {
    if (!enabled) {
      camera.position.copy(restPos)
      camera.lookAt(0, 0, 0)
      doneRef.current = true
      return
    }
    camera.position.copy(entryPos)
    camera.lookAt(0, 0, 0)
    doneRef.current = false
    startRef.current = null
  }, [enabled, camera, restPos, entryPos, doneRef])

  useFrame((state) => {
    if (doneRef.current || !enabled) return
    if (startRef.current === null) startRef.current = state.clock.elapsedTime
    const t = (state.clock.elapsedTime - startRef.current) / ENTRY_DUR
    const k = Math.min(1, t)
    const e = easeOutQuint(k)
    camera.position.lerpVectors(entryPos, restPos, e)
    camera.lookAt(0, 0, 0)
    if (k >= 1) doneRef.current = true
  })

  return null
}

// ──────────────────────────────────────────────────────────────────────────────
// Zoom con rueda del mouse (solo se activa después de la entrada)
// ──────────────────────────────────────────────────────────────────────────────
interface WheelZoomProps {
  enabled: boolean
  minZ: number
  maxZ: number
  doneRef: React.MutableRefObject<boolean>
}

function WheelZoom({ enabled, minZ, maxZ, doneRef }: WheelZoomProps) {
  const { camera, gl } = useThree()
  const targetZ = useRef(camera.position.z)

  // Sincronizar target inicial con la posición actual (post-entry)
  useEffect(() => {
    targetZ.current = camera.position.z
  }, [camera])

  // Wheel listener sobre el canvas. preventDefault evita scroll de página.
  useEffect(() => {
    if (!enabled) return
    const dom = gl.domElement
    const onWheel = (e: WheelEvent) => {
      if (!doneRef.current) return // ignorar durante entry
      e.preventDefault()
      const next = THREE.MathUtils.clamp(
        targetZ.current + e.deltaY * 1.5,
        minZ,
        maxZ
      )
      targetZ.current = next
    }
    dom.addEventListener('wheel', onWheel, { passive: false })
    return () => dom.removeEventListener('wheel', onWheel)
  }, [enabled, gl, minZ, maxZ, doneRef])

  // Lerp suave de la posición Z hacia el target
  useFrame(() => {
    if (!enabled || !doneRef.current) return
    const cur = camera.position.z
    const next = cur + (targetZ.current - cur) * ZOOM_LERP
    camera.position.z = next
  })

  return null
}

// ──────────────────────────────────────────────────────────────────────────────
// Fallback estático
// ──────────────────────────────────────────────────────────────────────────────
function StaticFallback({
  svgUrl,
  height,
  background,
  className,
  style,
}: {
  svgUrl: string
  height: string | number
  background: number
  className?: string
  style?: CSSProperties
}) {
  const bgHex = '#' + background.toString(16).padStart(6, '0')
  return (
    <div
      className={className}
      style={{
        width: '100%',
        height,
        background: bgHex,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      <img
        src={svgUrl}
        alt="GON"
        style={{
          width: 'min(360px, 60vw)',
          aspectRatio: '1 / 1',
          color: 'oklch(96% 0.008 80)',
        }}
      />
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Componente principal
// ──────────────────────────────────────────────────────────────────────────────
export function MateriaLogo({
  height         = '100vh',
  svgUrl         = '/logo-gon-mark.svg',
  baseColor      = 0x1A1814,
  background     = 0x14120E,
  amplitude      = 8,
  entryAnimation = true,
  cameraDistance = 1500,
  cursorTilt     = true,
  enableZoom     = true,
  minZoom        = 600,
  maxZoom        = 3000,
  className,
  style,
}: MateriaLogoProps) {
  const [supported, setSupported] = useState<boolean | null>(null)
  // Compartido entre CameraEntry, WheelZoom y MateriaMesh (para gating del tilt)
  const entryDoneRef = useRef(false)

  // Detectar WebGL2 una sola vez del lado cliente
  useEffect(() => {
    setSupported(detectWebGL2())
  }, [])

  if (supported === null) {
    // SSR / pre-detect: render placeholder de mismo tamaño para evitar layout shift
    return (
      <div
        className={className}
        style={{
          width: '100%',
          height,
          background: '#' + background.toString(16).padStart(6, '0'),
          ...style,
        }}
      />
    )
  }

  if (!supported) {
    return (
      <StaticFallback
        svgUrl={svgUrl}
        height={height}
        background={background}
        className={className}
        style={style}
      />
    )
  }

  return (
    <div className={className} style={{ width: '100%', height, ...style }}>
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.55,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{ position: [0, 0, 1100], fov: 35, near: 0.1, far: 5000 }}
      >
        <color attach="background" args={[background]} />

        {/* Iluminación: brillante por defecto, top-lighting natural.
            El "shadow" lo aporta el cursor (modulación en fragment shader).
            - Ambient alto: ningún punto queda apagado en reposo
            - Key (cálida fuerte) desde arriba-izq
            - Fill (fría) desde la derecha
            - Rim naranja sutil detrás (acento cálido en los bordes, no protagonista) */}
        <ambientLight intensity={0.85} color={0x3a342a} />
        <directionalLight position={[-300, 400, 600]} intensity={2.6} color={0xfff5e8} />
        <directionalLight position={[500, -100, 200]} intensity={0.9} color={0xc8d0e0} />
        <directionalLight position={[0, 100, -500]}   intensity={1.4} color={0xff8a3d} />
        <directionalLight position={[-400, 200, -200]} intensity={0.5} color={0xff8a3d} />

        {/* Environment para reflejos PBR — full intensity */}
        <Environment preset="studio" environmentIntensity={1.0} />

        <CameraEntry
          enabled={entryAnimation}
          restDistance={cameraDistance}
          doneRef={entryDoneRef}
        />
        <WheelZoom
          enabled={enableZoom}
          minZ={minZoom}
          maxZ={maxZoom}
          doneRef={entryDoneRef}
        />

        <Suspense fallback={null}>
          <MateriaMesh
            svgUrl={svgUrl}
            baseColor={baseColor}
            amplitude={amplitude}
            cursorTilt={cursorTilt}
            entryDoneRef={entryDoneRef}
          />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default MateriaLogo
