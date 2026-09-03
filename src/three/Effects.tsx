import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import { GEO, mat } from './materials'
import { makeRand } from './hexmath'

export type Fx =
  | { id: number; kind: 'march'; from: number; to: number; color: string; start: number; duration: number }
  | { id: number; kind: 'clash'; at: number; color: string; start: number; duration: number }

interface Props { fx: Fx[]; positions: Array<[number, number, number]>; onDone: (id: number) => void }

function March({ f, positions, onDone }: { f: Extract<Fx, { kind: 'march' }>; positions: Props['positions']; onDone: (id: number) => void }) {
  const group = useRef<THREE.Group>(null)
  const done = useRef(false)
  const a = positions[f.from]
  const b = positions[f.to]
  const body = mat(f.color)
  const head = mat('#e8c9a0')
  useFrame(() => {
    if (!group.current) return
    const t = Math.min(1, (performance.now() - f.start) / f.duration)
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    const x = a[0] + (b[0] - a[0]) * e
    const z = a[2] + (b[2] - a[2]) * e
    const y = a[1] + (b[1] - a[1]) * e + Math.sin(t * Math.PI) * 0.5
    group.current.position.set(x, y, z)
    group.current.rotation.y = -Math.atan2(b[2] - a[2], b[0] - a[0])
    group.current.children.forEach((c, i) => { c.position.y = 0.04 + Math.abs(Math.sin(t * 40 + i)) * 0.03 })
    if (t >= 1 && !done.current) { done.current = true; onDone(f.id) }
  })
  const offsets = useMemo(() => [[-0.12, 0], [0, 0], [0.12, 0], [-0.06, 0.12], [0.06, 0.12], [0, -0.12]], [])
  return (
    <group ref={group}>
      {offsets.map(([ox, oz], i) => (
        <group key={i} position={[ox, 0, oz]}>
          <mesh geometry={GEO.cyl} material={body} scale={[0.07, 0.14, 0.07]} position={[0, 0.07, 0]} castShadow />
          <mesh geometry={GEO.sphere} material={head} scale={[0.06, 0.06, 0.06]} position={[0, 0.17, 0]} />
        </group>
      ))}
    </group>
  )
}

function Clash({ f, positions, onDone }: { f: Extract<Fx, { kind: 'clash' }>; positions: Props['positions']; onDone: (id: number) => void }) {
  const ring = useRef<THREE.Mesh>(null)
  const ringMat = useRef<THREE.MeshBasicMaterial>(null)
  const light = useRef<THREE.PointLight>(null)
  const sparks = useRef<THREE.Group>(null)
  const done = useRef(false)
  const p = positions[f.at]
  const vel = useMemo(() => {
    const rnd = makeRand(f.id * 7919)
    return Array.from({ length: 14 }, () => {
      const a = rnd() * Math.PI * 2
      const s = 0.8 + rnd() * 1.4
      return [Math.cos(a) * s, 1.6 + rnd() * 1.8, Math.sin(a) * s] as [number, number, number]
    })
  }, [f.id])
  useFrame(() => {
    const t = Math.min(1, (performance.now() - f.start) / f.duration)
    const secs = (t * f.duration) / 1000
    if (ring.current) { const s = 0.3 + t * 1.8; ring.current.scale.set(s, 1, s) }
    if (ringMat.current) ringMat.current.opacity = (1 - t) * 0.95
    if (light.current) light.current.intensity = Math.max(0, 1 - t * 1.4) * 8
    if (sparks.current) {
      sparks.current.children.forEach((c, i) => {
        const v = vel[i]
        c.position.set(v[0] * secs, v[1] * secs - 4.5 * secs * secs, v[2] * secs)
        c.scale.setScalar(Math.max(0.001, 1 - t))
      })
    }
    if (t >= 1 && !done.current) { done.current = true; onDone(f.id) }
  })
  const sparkMat = mat('#ffd27a', { emissive: '#ffb347', emissiveIntensity: 1.5 })
  return (
    <group position={[p[0], p[1] + 0.05, p[2]]}>
      <mesh ref={ring} geometry={GEO.ringWide} renderOrder={3}>
        <meshBasicMaterial ref={ringMat} color={f.color} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
      </mesh>
      <pointLight ref={light} color="#ffb347" intensity={8} distance={5} decay={2} position={[0, 0.5, 0]} />
      <group ref={sparks}>
        {vel.map((_, i) => <mesh key={i} geometry={GEO.box} material={sparkMat} scale={[0.06, 0.06, 0.06]} />)}
      </group>
    </group>
  )
}

export function Effects({ fx, positions, onDone }: Props) {
  return (
    <group>
      {fx.map((f) => f.kind === 'march'
        ? <March key={f.id} f={f} positions={positions} onDone={onDone} />
        : <Clash key={f.id} f={f} positions={positions} onDone={onDone} />)}
    </group>
  )
}
