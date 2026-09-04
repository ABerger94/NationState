import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import type { GameState } from '../engine/types'
import { armySize } from '../engine/helpers'
import { tilePosition } from './hexmath'

interface Props { state: GameState; heights: number[]; playerId: number; modeLabels?: string[] | null; modeColor?: string | null }

export function Labels({ state, heights, playerId, modeLabels = null, modeColor = null }: Props) {
  return (
    <group>
      {state.provinces.map((p) => {
        const [x, z] = tilePosition(p.col, p.row, state.cols, state.rows)
        const owner = p.ownerId === null ? null : state.nations[p.ownerId]
        const units = armySize(p.garrison)
        const cls = 'badge' + (p.ownerId === playerId ? ' mine' : owner ? '' : ' free') + (modeColor ? ' mode mode-' + modeColor : '')
        return (
          <Html key={p.id} transform sprite position={[x, heights[p.id] + 0.95, z]} scale={0.34} wrapperClass="label-wrap" zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
            <div className="label">
              <div className={cls} style={p.ownerId === playerId ? { borderColor: '#ffffff', background: owner!.color } : { borderColor: owner?.color ?? '#6b6b6b' }}>
                {p.isCapital && <span className="star">★</span>}
                <span className="units">{modeLabels ? (modeLabels[p.id] || '·') : units}</span>
              </div>
              <div className="badge-name">{p.name}</div>
            </div>
          </Html>
        )
      })}
    </group>
  )
}

/** Toggles a CSS class on the scene root when zoomed out so names fade away. */
export function LabelLOD() {
  const { camera, controls } = useThree()
  useFrame(() => {
    const target = (controls as unknown as { target?: { x: number; y: number; z: number } } | null)?.target
    const d = target ? camera.position.distanceTo({ x: target.x, y: target.y, z: target.z } as never) : camera.position.length()
    const root = document.querySelector('.scene')
    if (!root) return
    root.classList.toggle('far', d > 21)
    root.classList.toggle('near', d < 10)
  })
  return null
}
