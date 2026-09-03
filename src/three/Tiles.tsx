import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import type { GameState, Province } from '../engine/types'
import { GEO } from './materials'
import { TERRAIN_SIDE, TERRAIN_TOP, hexCorner, mixHex, tilePosition } from './hexmath'

interface TileProps {
  p: Province
  state: GameState
  height: number
  selected: boolean
  hovered: boolean
  target: boolean
  highlight: boolean
  interactive: boolean
  onSelect: (id: number) => void
  onHover: (id: number | null) => void
}

function Ring({ y, color, speed = 3, wide = false }: { y: number; color: string; speed?: number; wide?: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  const matRef = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    const s = 1 + 0.05 * Math.sin(t * speed)
    if (ref.current) ref.current.scale.set(s, 1, s)
    if (matRef.current) matRef.current.opacity = 0.75 + 0.25 * Math.sin(t * speed)
  })
  return (
    <mesh ref={ref} geometry={wide ? GEO.ringWide : GEO.ring} position={[0, y, 0]} renderOrder={2}>
      <meshBasicMaterial ref={matRef} color={color} transparent opacity={0.9} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

export function Tile({ p, state, height, selected, hovered, target, highlight, interactive, onSelect, onHover }: TileProps) {
  const [x, z] = tilePosition(p.col, p.row)
  const owner = p.ownerId === null ? null : state.nations[p.ownerId]
  const ownerColor = owner?.color ?? null
  const topHex = useMemo(() => {
    let c = TERRAIN_TOP[p.terrain]
    if (ownerColor) c = mixHex(c, ownerColor, 0.45)
    if (p.devastation > 0.02) c = mixHex(c, '#3a2a20', Math.min(0.6, p.devastation * 0.7))
    return c
  }, [p.terrain, ownerColor, p.devastation])
  const targetColor = useMemo(() => new THREE.Color(topHex), [topHex])
  const topMat = useRef<THREE.MeshStandardMaterial>(null)
  const first = useRef(true)

  useFrame((_, dt) => {
    const m = topMat.current
    if (!m) return
    if (first.current) { m.color.copy(targetColor); first.current = false }
    else m.color.lerp(targetColor, Math.min(1, dt * 3.5))
    const want = hovered ? 0.28 : 0
    m.emissiveIntensity = THREE.MathUtils.lerp(m.emissiveIntensity, want, Math.min(1, dt * 12))
  })

  const side = TERRAIN_SIDE[p.terrain]
  return (
    <group position={[x, 0, z]}>
      <mesh
        geometry={GEO.hex}
        scale={[1, height, 1]}
        position={[0, height / 2, 0]}
        castShadow
        receiveShadow
        onClick={interactive ? (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(p.id) } : undefined}
        onPointerOver={interactive ? (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(p.id); document.body.style.cursor = 'pointer' } : undefined}
        onPointerOut={interactive ? () => { onHover(null); document.body.style.cursor = '' } : undefined}
      >
        <meshStandardMaterial attach="material-0" color={side} roughness={0.95} flatShading />
        <meshStandardMaterial attach="material-1" ref={topMat} color={topHex} emissive="#ffffff" emissiveIntensity={0} roughness={0.9} flatShading />
        <meshStandardMaterial attach="material-2" color={side} />
      </mesh>
      {selected && <Ring y={height + 0.03} color="#ffffff" />}
      {target && !selected && <Ring y={height + 0.03} color="#ff4d4d" speed={5} />}
      {highlight && !selected && <Ring y={height + 0.03} color="#5ad1ff" speed={4} />}
    </group>
  )
}

const tmpObj = new THREE.Object3D()
const tmpColor = new THREE.Color()

/** National borders: one instanced mesh of short bars along every edge whose two sides have different owners. */
export function Borders({ state, heights }: { state: GameState; heights: number[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const max = state.provinces.length * 6
  const signature = state.provinces.map((p) => p.ownerId ?? '-').join(',') + '|' + state.nations.map((n) => n.color).join(',')

  const segments = useMemo(() => {
    const out: Array<{ x: number; y: number; z: number; rot: number; color: string }> = []
    const positions = state.provinces.map((p) => tilePosition(p.col, p.row))
    for (const p of state.provinces) {
      if (p.ownerId === null) continue
      const color = state.nations[p.ownerId].color
      const [cx, cz] = positions[p.id]
      for (let k = 0; k < 6; k++) {
        const a = Math.PI / 2 + (k * Math.PI) / 3 + Math.PI / 6
        const nx = cx + Math.sqrt(3) * Math.cos(a)
        const nz = cz + Math.sqrt(3) * Math.sin(a)
        const neighbour = p.neighbors.find((i) => Math.hypot(positions[i][0] - nx, positions[i][1] - nz) < 0.2)
        if (neighbour !== undefined && state.provinces[neighbour].ownerId === p.ownerId) continue
        const [ax, az] = hexCorner(k)
        const [bx, bz] = hexCorner(k + 1)
        let mx = (ax + bx) / 2
        let mz = (az + bz) / 2
        mx *= 0.93
        mz *= 0.93
        out.push({ x: cx + mx, y: heights[p.id] + 0.025, z: cz + mz, rot: -Math.atan2(bz - az, bx - ax), color })
      }
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, heights])

  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    segments.forEach((s, i) => {
      tmpObj.position.set(s.x, s.y, s.z)
      tmpObj.rotation.set(0, s.rot, 0)
      tmpObj.scale.set(0.9, 0.05, 0.1)
      tmpObj.updateMatrix()
      mesh.setMatrixAt(i, tmpObj.matrix)
      mesh.setColorAt(i, tmpColor.set(s.color))
    })
    mesh.count = segments.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [segments])

  return (
    <instancedMesh ref={ref} args={[GEO.box, undefined, max]} count={segments.length} frustumCulled={false}>
      <meshStandardMaterial roughness={0.5} emissive="#ffffff" emissiveIntensity={0.12} />
    </instancedMesh>
  )
}
