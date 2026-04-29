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
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import * as THREE from 'three'
import { SVGLoader, type SVGResult } from 'three/examples/jsm/loaders/SVGLoader.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

function CustomRoomEnvironment({ intensity = 1.0 }: { intensity?: number }) {
  const { gl, scene } = useThree()

  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    pmrem.compileEquirectangularShader()
    const envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    scene.environment = envMap
    scene.environmentIntensity = intensity

    return () => {
      scene.environment = null
      envMap.dispose()
      pmrem.dispose()
    }
  }, [gl, scene, intensity])

  return null
}

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
  /** Auto-rotación cuando no hay input por unos segundos. Default true */
  autoRotateIdle?: boolean
  /** Segundos de inactividad antes de empezar auto-rotación. Default 3 */
  idleDelay?: number
  /** Permitir tilt por giroscopio del dispositivo (mobile). Default true */
  gyroscope?: boolean
  /** PBR del material. Override individual sobre el preset. */
  material?: Partial<MaterialConfig>
  /** Color del tint en peaks (RGB 0-1). Default brasa apagada. */
  heatColor?: [number, number, number]
  /** Color del emissive boost en peaks (RGB 0-1). */
  heatEmissive?: [number, number, number]
  /** Multiplicador del emissive en peaks. Default 1.6. */
  heatEmissiveStrength?: number
  /** Configuración de luces. Si se pasa, reemplaza el setup default. */
  lights?: LightConfig[]
  /** Exposición del tone mapping. Default 1.55. */
  toneMappingExposure?: number
  /** Intensidad del environment map para reflejos PBR. Default 1.0. */
  environmentIntensity?: number
  /** Aplica un preset completo. Las props individuales lo sobrescriben. */
  preset?: PresetName
  /** Habilitar bloom postprocessing (halo difuso alrededor del glow). Default true. */
  bloom?: boolean
  /** Intensidad del bloom. Default 0.7. */
  bloomIntensity?: number
  /** Class CSS opcional para el wrapper */
  className?: string
  /** Estilo CSS opcional para el wrapper */
  style?: CSSProperties
}

export interface MaterialConfig {
  roughness: number
  metalness: number
  clearcoat: number
  clearcoatRoughness: number
  reflectivity: number
}

export interface LightConfig {
  type: 'ambient' | 'directional'
  color: number
  intensity: number
  position?: [number, number, number]
}

export type PresetName = 'brasa' | 'plata' | 'cobre' | 'obsidiana' | 'magma' | 'hielo'

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

// ──────────────────────────────────────────────────────────────────────────────
// Presets — bundles de material + luces + heat para distintas atmósferas
// ──────────────────────────────────────────────────────────────────────────────
interface PresetConfig {
  baseColor: number
  background: number
  material: MaterialConfig
  lights: LightConfig[]
  heatColor: [number, number, number]
  heatEmissive: [number, number, number]
  heatEmissiveStrength: number
  toneMappingExposure: number
  environmentIntensity: number
}

export const PRESETS: Record<PresetName, PresetConfig> = {
  // Brasa — naranja quemado glowing (el actual default)
  brasa: {
    baseColor: 0x1A1814,
    background: 0x14120E,
    material: { roughness: 0.18, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.08, reflectivity: 0.4 },
    lights: [
      { type: 'ambient',     color: 0x3a342a, intensity: 0.85 },
      { type: 'directional', color: 0xfff5e8, intensity: 2.6, position: [-300, 400, 600] },
      { type: 'directional', color: 0xc8d0e0, intensity: 0.9, position: [500, -100, 200] },
      { type: 'directional', color: 0xff8a3d, intensity: 1.4, position: [0, 100, -500] },
      { type: 'directional', color: 0xff8a3d, intensity: 0.5, position: [-400, 200, -200] },
    ],
    heatColor: [0.42, 0.12, 0.02],
    heatEmissive: [1.0, 0.45, 0.08],
    heatEmissiveStrength: 3.0,
    toneMappingExposure: 1.55,
    environmentIntensity: 1.0,
  },
  // Plata — chrome/silver, frío y técnico
  plata: {
    baseColor: 0xC8D0DA,
    background: 0x14161A,
    material: { roughness: 0.05, metalness: 1.0, clearcoat: 0.5, clearcoatRoughness: 0.10, reflectivity: 1.0 },
    lights: [
      { type: 'ambient',     color: 0x202428, intensity: 0.5 },
      { type: 'directional', color: 0xffffff, intensity: 2.2, position: [-300, 400, 600] },
      { type: 'directional', color: 0xa0b0c8, intensity: 1.2, position: [500, -100, 200] },
      { type: 'directional', color: 0xddddff, intensity: 1.2, position: [0, 100, -500] },
      { type: 'directional', color: 0x88aaff, intensity: 0.5, position: [-400, 200, -200] },
    ],
    heatColor: [0.85, 0.95, 1.0],
    heatEmissive: [1.0, 1.0, 1.0],
    heatEmissiveStrength: 1.4,
    toneMappingExposure: 1.4,
    environmentIntensity: 1.4,
  },
  // Cobre — metal cálido clásico
  cobre: {
    baseColor: 0xB87333,
    background: 0x18120A,
    material: { roughness: 0.25, metalness: 1.0, clearcoat: 0.6, clearcoatRoughness: 0.15, reflectivity: 0.8 },
    lights: [
      { type: 'ambient',     color: 0x281e10, intensity: 0.7 },
      { type: 'directional', color: 0xfff0d8, intensity: 2.4, position: [-300, 400, 600] },
      { type: 'directional', color: 0xffd0a0, intensity: 1.0, position: [500, -100, 200] },
      { type: 'directional', color: 0xffaa55, intensity: 1.2, position: [0, 100, -500] },
      { type: 'directional', color: 0xffc878, intensity: 0.5, position: [-400, 200, -200] },
    ],
    heatColor: [0.95, 0.55, 0.10],
    heatEmissive: [1.0, 0.6, 0.15],
    heatEmissiveStrength: 1.5,
    toneMappingExposure: 1.5,
    environmentIntensity: 1.0,
  },
  // Obsidiana — negro profundo con rim azul eléctrico
  obsidiana: {
    baseColor: 0x080810,
    background: 0x06060C,
    material: { roughness: 0.10, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.03, reflectivity: 0.5 },
    lights: [
      { type: 'ambient',     color: 0x101820, intensity: 0.4 },
      { type: 'directional', color: 0xeef0ff, intensity: 2.0, position: [-300, 400, 600] },
      { type: 'directional', color: 0x8090a8, intensity: 0.7, position: [500, -100, 200] },
      { type: 'directional', color: 0x4080ff, intensity: 1.8, position: [0, 100, -500] },
      { type: 'directional', color: 0x60a0ff, intensity: 0.6, position: [-400, 200, -200] },
    ],
    heatColor: [0.30, 0.50, 0.90],
    heatEmissive: [0.40, 0.70, 1.0],
    heatEmissiveStrength: 2.0,
    toneMappingExposure: 1.5,
    environmentIntensity: 0.7,
  },
  // Magma — lava agresiva, casi negro con núcleo rojo intenso
  magma: {
    baseColor: 0x100808,
    background: 0x0A0606,
    material: { roughness: 0.30, metalness: 0.0, clearcoat: 0.7, clearcoatRoughness: 0.20, reflectivity: 0.3 },
    lights: [
      { type: 'ambient',     color: 0x180806, intensity: 0.3 },
      { type: 'directional', color: 0xffd0b0, intensity: 1.6, position: [-300, 400, 600] },
      { type: 'directional', color: 0xff8050, intensity: 1.2, position: [500, -100, 200] },
      { type: 'directional', color: 0xff4020, intensity: 2.4, position: [0, 100, -500] },
      { type: 'directional', color: 0xff6030, intensity: 1.0, position: [-400, 200, -200] },
    ],
    heatColor: [0.85, 0.20, 0.00],
    heatEmissive: [1.0, 0.50, 0.0],
    heatEmissiveStrength: 3.0,
    toneMappingExposure: 1.6,
    environmentIntensity: 0.8,
  },
  // Hielo — frosted azul-blanco
  hielo: {
    baseColor: 0xC8E0E8,
    background: 0x101820,
    material: { roughness: 0.40, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.5, reflectivity: 0.8 },
    lights: [
      { type: 'ambient',     color: 0x182838, intensity: 0.7 },
      { type: 'directional', color: 0xffffff, intensity: 2.4, position: [-300, 400, 600] },
      { type: 'directional', color: 0xb0c8e0, intensity: 1.4, position: [500, -100, 200] },
      { type: 'directional', color: 0xddeeff, intensity: 1.0, position: [0, 100, -500] },
      { type: 'directional', color: 0xa0c0e0, intensity: 0.5, position: [-400, 200, -200] },
    ],
    heatColor: [1.0, 1.0, 1.0],
    heatEmissive: [0.7, 0.85, 1.0],
    heatEmissiveStrength: 1.8,
    toneMappingExposure: 1.4,
    environmentIntensity: 1.2,
  },
}
// Auto-idle: después de N segundos sin input, blendea hacia rotación automática
// suave (necesario en mobile donde no existe hover y la página queda "muerta").
const IDLE_RAMP_DUR = 2.0     // segundos para entrar full en auto-rotation
const AUTO_ROT_AMP_Y = THREE.MathUtils.degToRad(8) // ±8° auto-rotación horizontal
const AUTO_ROT_AMP_X = THREE.MathUtils.degToRad(2.5) // ±2.5° auto-rotación vertical
const AUTO_ROT_FREQ_Y = 0.30  // Hz
const AUTO_ROT_FREQ_X = 0.20  // Hz
const MOBILE_IDLE_HEAT = 0.36
const MOBILE_IDLE_ORBIT_X = 0.085
const MOBILE_IDLE_ORBIT_Y = 0.065
const MOBILE_IDLE_ORBIT_FREQ_X = 0.22
const MOBILE_IDLE_ORBIT_FREQ_Y = 0.16

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
  autoRotateIdle: boolean
  idleDelay: number
  gyroscope: boolean
  material: MaterialConfig
  heatColor: [number, number, number]
  heatEmissive: [number, number, number]
  heatEmissiveStrength: number
  entryDoneRef: React.MutableRefObject<boolean>
}

function MateriaMesh({
  svgUrl,
  baseColor,
  amplitude,
  cursorTilt,
  autoRotateIdle,
  idleDelay,
  gyroscope,
  material: matCfg,
  heatColor,
  heatEmissive,
  heatEmissiveStrength,
  entryDoneRef,
}: MateriaMeshProps) {
  const tiltGroupRef  = useRef<THREE.Group>(null)
  const groupRef      = useRef<THREE.Group>(null)
  const tiltTarget    = useRef(new THREE.Vector2(0, 0))
  const tiltCurrent   = useRef(new THREE.Vector2(0, 0))
  const lastInputRef  = useRef<number>(0)  // último tiempo (clock.elapsedTime) con input
  const supportsHoverRef = useRef(true)

  // Uniforms compartidos entre material y useFrame
  const uniformsRef = useRef({
    uTime:                 { value: 0 },
    uMouse:                { value: new THREE.Vector2(0.5, 0.5) },
    uMouseStrength:        { value: 0 },
    uCalm:                 { value: 0 },
    uAmp:                  { value: amplitude },
    uHeatColor:            { value: new THREE.Vector3(...heatColor) },
    uHeatEmissive:         { value: new THREE.Vector3(...heatEmissive) },
    uHeatEmissiveStrength: { value: heatEmissiveStrength },
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

  // Material: PBR config-driven con noise injection + heat tint via uniforms
  const material = useMemo(() => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness:           matCfg.roughness,
      metalness:           matCfg.metalness,
      clearcoat:           matCfg.clearcoat,
      clearcoatRoughness:  matCfg.clearcoatRoughness,
      reflectivity:        matCfg.reflectivity,
    })

    mat.onBeforeCompile = (shader) => {
      const u = uniformsRef.current
      shader.uniforms.uTime                 = u.uTime
      shader.uniforms.uMouse                = u.uMouse
      shader.uniforms.uMouseStrength        = u.uMouseStrength
      shader.uniforms.uCalm                 = u.uCalm
      shader.uniforms.uAmp                  = u.uAmp
      shader.uniforms.uHeatColor            = u.uHeatColor
      shader.uniforms.uHeatEmissive         = u.uHeatEmissive
      shader.uniforms.uHeatEmissiveStrength = u.uHeatEmissiveStrength

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
          vGonHeat = mouseAmp * frontFactor;

          float aliveAmp = mix(uAmp, 0.0, uCalm);

          // Same feel as the standalone HTML reference, with color handled in fragment.
          transformed += normal * (n * aliveAmp + mouseAmp * 60.0) * frontFactor;
          `
        )

      // Fragment shader: cursor-shadow + heat tint + emissive glow en peaks.
      // Colores del heat vienen via uniforms → swappable por preset sin recompilar.
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
           uniform vec2  uMouse;
           uniform float uMouseStrength;
           uniform vec3  uHeatColor;
           uniform vec3  uHeatEmissive;
           uniform float uHeatEmissiveStrength;
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
           // 2) Tint del heat color en peaks
           diffuseColor.rgb = mix(diffuseColor.rgb, uHeatColor, vGonHeat);`
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
           // 3) Emissive glow en peaks: el área desplazada EMITE luz propia
           totalEmissiveRadiance += uHeatEmissive * vGonHeat * uHeatEmissiveStrength;`
        )
    }

    return mat
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseColor, matCfg.roughness, matCfg.metalness, matCfg.clearcoat, matCfg.clearcoatRoughness, matCfg.reflectivity])

  // Centrar el grupo después de cargar
  useEffect(() => {
    if (!groupRef.current) return
    const bbox = new THREE.Box3().setFromObject(groupRef.current)
    const center = bbox.getCenter(new THREE.Vector3())
    groupRef.current.position.sub(center)
  }, [geometries])

  // Mantener uniforms sincronizados si cambian las props (sin recompilar shader)
  useEffect(() => {
    uniformsRef.current.uAmp.value = amplitude
  }, [amplitude])
  useEffect(() => {
    uniformsRef.current.uHeatColor.value.set(...heatColor)
  }, [heatColor])
  useEffect(() => {
    uniformsRef.current.uHeatEmissive.value.set(...heatEmissive)
  }, [heatEmissive])
  useEffect(() => {
    uniformsRef.current.uHeatEmissiveStrength.value = heatEmissiveStrength
  }, [heatEmissiveStrength])

  // Inicializar el "último input" al mount para que el auto-rotate arranque
  // tras idleDelay segundos desde la carga (no inmediatamente).
  useEffect(() => {
    lastInputRef.current = performance.now() / 1000
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const media = window.matchMedia('(hover: hover) and (pointer: fine)')
    const update = () => {
      supportsHoverRef.current = media.matches
    }

    update()
    if (typeof media.addEventListener === 'function') {
      media.addEventListener('change', update)
      return () => media.removeEventListener('change', update)
    }

    media.addListener(update)
    return () => media.removeListener(update)
  }, [])

  // Tracking del cursor a nivel ventana (no solo sobre el mesh) para tilt.
  // Coords normalizadas -1..1 en ambos ejes. NDC standard.
  useEffect(() => {
    if (!cursorTilt) return
    const onMove = (e: PointerEvent) => {
      tiltTarget.current.set(
        (e.clientX / window.innerWidth)  * 2 - 1,
        -((e.clientY / window.innerHeight) * 2 - 1)
      )
      // Marcar como input reciente — corta el auto-rotate
      lastInputRef.current = performance.now() / 1000
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [cursorTilt])

  // Gyroscope (mobile): tilt por orientación del dispositivo. iOS ≥13 requiere
  // permiso explícito en respuesta a un gesto del usuario.
  useEffect(() => {
    if (!gyroscope || typeof window === 'undefined') return

    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return
      // gamma: -90..90 (left-right tilt) → mapeo a x ±1
      // beta: -180..180 (front-back tilt) → asumimos posición de uso ~30° → mapeo a y ±1
      const x = THREE.MathUtils.clamp(e.gamma / 30, -1, 1)
      const y = THREE.MathUtils.clamp((e.beta - 30) / 30, -1, 1)
      tiltTarget.current.set(x, -y) // negate Y para que match con la convención NDC
      lastInputRef.current = performance.now() / 1000
    }

    type OrientationCtor = typeof DeviceOrientationEvent & {
      requestPermission?: () => Promise<'granted' | 'denied'>
    }
    const Ctor = (typeof DeviceOrientationEvent !== 'undefined'
      ? DeviceOrientationEvent
      : null) as OrientationCtor | null

    let attached = false
    const attach = () => {
      if (attached || !Ctor) return
      window.addEventListener('deviceorientation', onOrientation)
      attached = true
    }

    // iOS 13+ requiere permiso vía gesto del usuario
    const requestPermission = () => {
      if (Ctor?.requestPermission) {
        Ctor.requestPermission().then((res) => {
          if (res === 'granted') attach()
        }).catch(() => {})
      } else {
        // Android/desktop browsers: no requiere permiso
        attach()
      }
    }

    // Pedir permiso en el primer touch (iOS lo exige)
    const onFirstTouch = () => {
      requestPermission()
      window.removeEventListener('touchstart', onFirstTouch)
      window.removeEventListener('pointerdown', onFirstTouch)
    }
    window.addEventListener('touchstart', onFirstTouch, { once: true, passive: true })
    window.addEventListener('pointerdown', onFirstTouch, { once: true, passive: true })

    // Si no es iOS (no hay requestPermission), intenta attach directamente
    if (Ctor && !Ctor.requestPermission) attach()

    return () => {
      window.removeEventListener('deviceorientation', onOrientation)
      window.removeEventListener('touchstart', onFirstTouch)
      window.removeEventListener('pointerdown', onFirstTouch)
    }
  }, [gyroscope])

  // Loop por frame
  useFrame((state) => {
    const u = uniformsRef.current
    u.uTime.value = state.clock.elapsedTime

    if (!supportsHoverRef.current && !hovering) {
      targetMouse.current.set(
        0.5 + Math.cos(state.clock.elapsedTime * MOBILE_IDLE_ORBIT_FREQ_X * Math.PI * 2) * MOBILE_IDLE_ORBIT_X,
        0.52 + Math.sin(state.clock.elapsedTime * MOBILE_IDLE_ORBIT_FREQ_Y * Math.PI * 2 + 0.8) * MOBILE_IDLE_ORBIT_Y
      )
    }

    // Smooth lerp de mouse uv y strength
    currentMouse.current.lerp(targetMouse.current, 0.12)
    u.uMouse.value.copy(currentMouse.current)

    const targetStrength = hovering ? 1 : (supportsHoverRef.current ? 0 : MOBILE_IDLE_HEAT)
    u.uMouseStrength.value += (targetStrength - u.uMouseStrength.value) * 0.08

    const targetCalm = mouseDownRef.current ? 1 : 0
    u.uCalm.value += (targetCalm - u.uCalm.value) * 0.02

    // Cursor tilt + auto-idle blend
    if (cursorTilt && entryDoneRef.current && tiltGroupRef.current) {
      tiltCurrent.current.lerp(tiltTarget.current, TILT_LERP)

      // Manual rotation desde el cursor/gyroscope
      let rotY = -tiltCurrent.current.x * TILT_MAX_Y
      let rotX = (tiltCurrent.current.y + TILT_REST_BIAS_Y) * TILT_MAX_X

      // Si no hubo input por idleDelay segundos, blendear hacia auto-rotation.
      // En mobile (sin hover) es lo que evita que la página se sienta muerta.
      if (autoRotateIdle) {
        const now = performance.now() / 1000
        const idleTime = now - lastInputRef.current
        if (idleTime > idleDelay) {
          const t = state.clock.elapsedTime
          const idleFactor = Math.min((idleTime - idleDelay) / IDLE_RAMP_DUR, 1)
          const autoY = Math.sin(t * AUTO_ROT_FREQ_Y * Math.PI * 2) * AUTO_ROT_AMP_Y
          const autoX = Math.sin(t * AUTO_ROT_FREQ_X * Math.PI * 2 + 1.5) * AUTO_ROT_AMP_X
                      + TILT_REST_BIAS_Y * TILT_MAX_X
          rotY = THREE.MathUtils.lerp(rotY, autoY, idleFactor)
          rotX = THREE.MathUtils.lerp(rotX, autoX, idleFactor)
        }
      }

      tiltGroupRef.current.rotation.y = rotY
      tiltGroupRef.current.rotation.x = rotX
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
  const { camera, size } = useThree()
  const startRef = useRef<number | null>(null)

  // Distancia responsive: en mobile (aspect < 1) calculamos la distancia mínima
  // para que el logo entero entre en el viewport. El prop restDistance actúa
  // como mínimo (no nos acercamos más que eso aunque haya espacio).
  const restPos = useMemo(() => {
    const aspect = size.width / size.height
    const persp = camera as THREE.PerspectiveCamera
    const fovRad = ((persp.fov ?? 35) * Math.PI) / 180
    const targetExtent = 1200 // bbox del logo (~1000) + padding 20%
    // En portrait el ancho es lo que limita: vertExtent = aspect-fov-extent,
    // horExtent = aspect * vertExtent. Para que horExtent >= targetExtent:
    const minDist = aspect >= 1
      ? restDistance
      : targetExtent / (aspect * 2 * Math.tan(fovRad / 2))
    return new THREE.Vector3(0, 0, Math.max(restDistance, minDist))
  }, [restDistance, size.width, size.height, camera])

  // Si el viewport cambia después del entry (rotación de pantalla en mobile),
  // recolocamos la cámara suavemente (snap, en este caso).
  useEffect(() => {
    if (doneRef.current) {
      camera.position.copy(restPos)
      camera.lookAt(0, 0, 0)
    }
  }, [restPos, camera, doneRef])

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
// Zoom — rueda del mouse (desktop) + pinch (mobile, 2 dedos)
// ──────────────────────────────────────────────────────────────────────────────
interface ZoomControlProps {
  enabled: boolean
  minZ: number
  maxZ: number
  doneRef: React.MutableRefObject<boolean>
}

function ZoomControl({ enabled, minZ, maxZ, doneRef }: ZoomControlProps) {
  const { camera, gl } = useThree()
  const targetZ = useRef(camera.position.z)
  const lastPinchDist = useRef(0)
  const syncedAfterEntryRef = useRef(false)
  const userZoomedRef = useRef(false)

  // Sincronizar target inicial con la posición actual de la cámara.
  useEffect(() => {
    targetZ.current = camera.position.z
    syncedAfterEntryRef.current = false
    userZoomedRef.current = false
  }, [camera])

  // Listeners de wheel (desktop) y touch pinch (mobile)
  useEffect(() => {
    if (!enabled) return
    const dom = gl.domElement

    const onWheel = (e: WheelEvent) => {
      if (!doneRef.current) return
      e.preventDefault()
      userZoomedRef.current = true
      targetZ.current = THREE.MathUtils.clamp(
        targetZ.current + e.deltaY * 1.5,
        minZ,
        maxZ
      )
    }

    // Pinch: medimos distancia entre 2 dedos. Diferencia = delta de zoom.
    const distance = (t: TouchList) =>
      Math.hypot(
        t[1].clientX - t[0].clientX,
        t[1].clientY - t[0].clientY
      )

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        lastPinchDist.current = distance(e.touches)
      }
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!doneRef.current || e.touches.length !== 2) return
      e.preventDefault()
      const dist = distance(e.touches)
      const delta = lastPinchDist.current - dist // pinch in (acercar dedos) = alejar cámara
      userZoomedRef.current = true
      targetZ.current = THREE.MathUtils.clamp(
        targetZ.current + delta * 4,
        minZ,
        maxZ
      )
      lastPinchDist.current = dist
    }

    dom.addEventListener('wheel', onWheel, { passive: false })
    dom.addEventListener('touchstart', onTouchStart, { passive: true })
    dom.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => {
      dom.removeEventListener('wheel', onWheel)
      dom.removeEventListener('touchstart', onTouchStart)
      dom.removeEventListener('touchmove', onTouchMove)
    }
  }, [enabled, gl, minZ, maxZ, doneRef])

  // Lerp suave de la posición Z hacia el target
  useFrame(() => {
    if (!enabled) return

    if (!doneRef.current) {
      syncedAfterEntryRef.current = false
      return
    }

    if (!syncedAfterEntryRef.current) {
      targetZ.current = camera.position.z
      syncedAfterEntryRef.current = true
    } else if (!userZoomedRef.current && Math.abs(targetZ.current - camera.position.z) > 24) {
      targetZ.current = camera.position.z
    }

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
  amplitude      = 8,
  entryAnimation = true,
  cameraDistance = 1500,
  cursorTilt     = true,
  enableZoom     = true,
  minZoom        = 600,
  maxZoom        = 3000,
  autoRotateIdle = true,
  idleDelay      = 3,
  gyroscope      = true,
  preset         = 'brasa',
  bloom          = false,
  bloomIntensity = 0.45,
  // Las siguientes props sobrescriben el preset cuando se proveen
  baseColor:           baseColorProp,
  background:          backgroundProp,
  material:            materialProp,
  heatColor:           heatColorProp,
  heatEmissive:        heatEmissiveProp,
  heatEmissiveStrength: heatEmissiveStrengthProp,
  lights:              lightsProp,
  toneMappingExposure: toneMappingExposureProp,
  environmentIntensity: environmentIntensityProp,
  className,
  style,
}: MateriaLogoProps) {
  // Resolver config: preset como base, props individuales como override
  const cfg = PRESETS[preset]
  const baseColor            = baseColorProp            ?? cfg.baseColor
  const background           = backgroundProp           ?? cfg.background
  const material             = { ...cfg.material, ...(materialProp ?? {}) }
  const heatColor            = heatColorProp            ?? cfg.heatColor
  const heatEmissive         = heatEmissiveProp         ?? cfg.heatEmissive
  const heatEmissiveStrength = heatEmissiveStrengthProp ?? cfg.heatEmissiveStrength
  const lights               = lightsProp               ?? cfg.lights
  const toneMappingExposure  = toneMappingExposureProp  ?? cfg.toneMappingExposure
  const environmentIntensity = environmentIntensityProp ?? cfg.environmentIntensity

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
          toneMappingExposure,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{ position: [0, 0, 1100], fov: 35, near: 0.1, far: 5000 }}
      >
        <color attach="background" args={[background]} />

        {/* Iluminación dinámica desde el preset / prop lights */}
        {lights.map((l, i) =>
          l.type === 'ambient' ? (
            <ambientLight key={i} color={l.color} intensity={l.intensity} />
          ) : (
            <directionalLight
              key={i}
              color={l.color}
              intensity={l.intensity}
              position={l.position ?? [0, 0, 0]}
            />
          )
        )}

        <CustomRoomEnvironment intensity={environmentIntensity} />

        <CameraEntry
          enabled={entryAnimation}
          restDistance={cameraDistance}
          doneRef={entryDoneRef}
        />
        <ZoomControl
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
            autoRotateIdle={autoRotateIdle}
            idleDelay={idleDelay}
            gyroscope={gyroscope}
            material={material}
            heatColor={heatColor}
            heatEmissive={heatEmissive}
            heatEmissiveStrength={heatEmissiveStrength}
            entryDoneRef={entryDoneRef}
          />
        </Suspense>

        {/* Bloom: halo difuso alrededor de las zonas con emissive alto.
            luminanceThreshold alto → solo los peaks brillantes (ya emisivos)
            generan halo. El resto del logo (base PBR) no se ve afectado. */}
        {bloom && (
          <EffectComposer>
            <Bloom
              intensity={bloomIntensity}
              luminanceThreshold={0.95}
              luminanceSmoothing={0.25}
              mipmapBlur
            />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  )
}

export default MateriaLogo
