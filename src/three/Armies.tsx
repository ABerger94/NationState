import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import type { GameState, UnitKey } from '../engine/types'
import { armySize } from '../engine/helpers'
import { GEO, mat } from './materials'
import { tilePosition } from './hexmath'

const UNIT_HEIGHT: Record<UnitKey, number> = { militia: 0.1, infantry: 0.14, archers: 0.13, cavalry: 0.17, siege: 0.15 }

function Banner({ color, y, spent }: { color: string; y: number; spent: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.rotation.y = Math.sin(clock.getElapsedTime() * 1.6) * 0.25
  })
  return (
    <group position={[0, y, 0]}>
      <mesh geometry={GEO.cyl} material={mat('#2b2b2b')} scale={[0.022, 0.42, 0.022]} position={[0, 0.21, 0]} />
      <mesh ref={ref} geometry={GEO.box} material={mat(color, spent ? { opacity: 0.55, transparent: true } : { emissive: color, emissiveIntensity: 0.3 })} scale={[0.2, 0.12, 0.014]} position={[0.1, 0.36, 0]} />
    </group>
  )
}

interface Props {
  state: GameState
  heights: number[]
  selectedArmy: number | null
  onSelectArmy: (id: number) => void
  interactive: boolean
}

/** Field armies drawn as banner-led companies standing on their province. */
export function Armies({ state, heights, selectedArmy, onSelectArmy, interactive }: Props) {
  const groups = useMemo(() => {
    const byTile = new Map<number, typeof state.armies>()
    for (const a of state.armies) {
      const list = byTile.get(a.provinceId) ?? []
      list.push(a)
      byTile.set(a.provinceId, list)
    }
    return [...byTile.entries()]
  }, [state.armies])

  return (
    <group>
      {groups.map(([provinceId, armies]) => {
        const [cx, cz] = tilePosition(state.provinces[provinceId].col, state.provinces[provinceId].row)
        const top = heights[provinceId]
        return armies.map((a, idx) => {
          const owner = state.nations[a.ownerId]
          const spread = armies.length > 1 ? (idx - (armies.length - 1) / 2) * 0.34 : 0
          const x = cx + spread
          const z = cz + 0.5
          const figures = Math.min(8, Math.max(2, Math.ceil(armySize(a.units) / 3)))
          const kinds = (Object.keys(a.units) as UnitKey[]).filter((k) => a.units[k] > 0)
          const spent = a.movement <= 0
          const selected = selectedArmy === a.id
          return (
            <group
              key={a.id}
              position={[x, top, z]}
              onClick={interactive ? (e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelectArmy(a.id) } : undefined}
              onPointerOver={interactive ? (e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer' } : undefined}
              onPointerOut={interactive ? () => { document.body.style.cursor = '' } : undefined}
            >
              <mesh geometry={GEO.cyl} material={mat('#000000', { opacity: 0.001, transparent: true })} scale={[0.44, 0.5, 0.44]} position={[0, 0.25, 0]} />
              {selected && (
                <mesh geometry={GEO.ringWide} scale={[0.42, 1, 0.42]} position={[0, 0.02, 0]} renderOrder={2}>
                  <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} toneMapped={false} />
                </mesh>
              )}
              {Array.from({ length: figures }, (_, i) => {
                const col = i % 3
                const row = Math.floor(i / 3)
                const fx = (col - 1) * 0.11
                const fz = row * 0.12
                const kind = kinds[i % Math.max(1, kinds.length)] ?? 'militia'
                const h = UNIT_HEIGHT[kind]
                return (
                  <group key={i} position={[fx, 0, fz]}>
                    <mesh geometry={GEO.cyl} material={mat(owner.color, spent ? { opacity: 0.6, transparent: true } : {})} scale={[0.075, h, 0.075]} position={[0, h / 2, 0]} castShadow />
                    <mesh geometry={GEO.sphere} material={mat('#e8c9a0')} scale={[0.062, 0.062, 0.062]} position={[0, h + 0.03, 0]} />
                    {kind === 'cavalry' && <mesh geometry={GEO.box} material={mat('#6b4a2f')} scale={[0.07, 0.06, 0.17]} position={[0, 0.04, 0.02]} />}
                    {kind === 'siege' && <mesh geometry={GEO.box} material={mat('#7a5a3a')} scale={[0.13, 0.06, 0.17]} position={[0, 0.03, 0]} />}
                  </group>
                )
              })}
              <Banner color={owner.color} y={0} spent={spent} />
            </group>
          )
        })
      })}
    </group>
  )
}
