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
  armed?: boolean
  besieged?: boolean
  modeColor?: string | null
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

export function Tile({ p, state, height, selected, hovered, target, highlight, armed = false, besieged = false, modeColor = null, interactive, onSelect, onHover }: TileProps) {
  const [x, z] = tilePosition(p.col, p.row)
  const owner = p.ownerId === null ? null : state.nations[p.ownerId]
  const ownerColor = owner?.color ?? null
  const isMine = !!owner?.isPlayer
  const topHex = useMemo(() => {
    if (modeColor) return modeColor
    let c = TERRAIN_TOP[p.terrain]
    if (ownerColor) c = mixHex(c, ownerColor, isMine ? 0.58 : 0.42)
    if (p.devastation > 0.02) c = mixHex(c, '#3a2a20', Math.min(0.6, p.devastation * 0.7))
    return c
  }, [p.terrain, ownerColor, p.devastation, isMine, modeColor])
  const targetColor = useMemo(() => new THREE.Color(topHex), [topHex])
  const topMat = useRef<THREE.MeshStandardMaterial>(null)
  const first = useRef(true)

  useFrame((_, dt) => {
    const m = topMat.current
    if (!m) return
    if (first.current) { m.color.copy(targetColor); first.current = false }
    else m.color.lerp(targetColor, Math.min(1, dt * 3.5))
    const want = armed ? 0.5 : hovered ? 0.28 : 0
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
      {armed && <Ring y={height + 0.04} color="#ff2d2d" speed={9} wide />}
      {besieged && !armed && <Ring y={height + 0.035} color="#f5a524" speed={2} wide />}
      {target && !selected && !armed && <Ring y={height + 0.03} color="#ff4d4d" speed={5} />}
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
    const out: Array<{ x: number; y: number; z: number; rot: number; color: string; mine: boolean }> = []
    const positions = state.provinces.map((p) => tilePosition(p.col, p.row))
    for (const p of state.provinces) {
      if (p.ownerId === null) continue
      const color = state.nations[p.ownerId].color
      const mine = state.nations[p.ownerId].isPlayer
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
        out.push({ x: cx + mx, y: heights[p.id] + 0.025, z: cz + mz, rot: -Math.atan2(bz - az, bx - ax), color, mine })
      }
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, heights])

  const others = useMemo(() => segments.filter((s) => !s.mine), [segments])
  const mine = useMemo(() => segments.filter((s) => s.mine), [segments])
  const mineRef = useRef<THREE.InstancedMesh>(null)
  const mineMat = useRef<THREE.MeshStandardMaterial>(null)

  const fill = (mesh: THREE.InstancedMesh | null, list: typeof segments, sy: number, sz: number) => {
    if (!mesh) return
    list.forEach((s, i) => {
      tmpObj.position.set(s.x, s.y + (sy - 0.05) / 2, s.z)
      tmpObj.rotation.set(0, s.rot, 0)
      tmpObj.scale.set(0.9, sy, sz)
      tmpObj.updateMatrix()
      mesh.setMatrixAt(i, tmpObj.matrix)
      mesh.setColorAt(i, tmpColor.set(s.color))
    })
    mesh.count = list.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }
  useLayoutEffect(() => { fill(ref.current, others, 0.05, 0.1) }, [others])
  useLayoutEffect(() => { fill(mineRef.current, mine, 0.1, 0.16) }, [mine])
  useFrame(({ clock }) => {
    if (mineMat.current) mineMat.current.emissiveIntensity = 0.45 + 0.35 * Math.sin(clock.getElapsedTime() * 2.2)
  })

  return (
    <group>
      <instancedMesh ref={ref} args={[GEO.box, undefined, max]} count={others.length} frustumCulled={false}>
        <meshStandardMaterial roughness={0.5} emissive="#ffffff" emissiveIntensity={0.12} />
      </instancedMesh>
      <instancedMesh ref={mineRef} args={[GEO.box, undefined, max]} count={mine.length} frustumCulled={false}>
        <meshStandardMaterial ref={mineMat} roughness={0.35} emissive="#ffffff" emissiveIntensity={0.5} />
      </instancedMesh>
    </group>
  )
}
