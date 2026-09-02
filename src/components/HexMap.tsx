import type { GameState } from '../engine/types'
import { TERRAINS } from '../engine/data'
import { armySize, fmt, ownedProvinces, ownerName } from '../engine/helpers'

const R = 36
const W = Math.sqrt(3) * R

function hexPoints(cx: number, cy: number, r: number): string {
  const pts: string[] = []
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30)
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`)
  }
  return pts.join(' ')
}

interface Props {
  state: GameState
  selected: number | null
  onSelect: (id: number) => void
  targets: number[]
  highlight: number[]
}

export function HexMap({ state, selected, onSelect, targets, highlight }: Props) {
  const width = W * (state.cols + 0.5) + 20
  const height = 1.5 * R * (state.rows - 1) + 2 * R + 20
  return (
    <svg className="map" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="World map">
      {state.provinces.map((p) => {
        const cx = 10 + W * (p.col + 0.5 * (p.row & 1)) + W / 2
        const cy = 10 + R + 1.5 * R * p.row
        const owner = p.ownerId === null ? null : state.nations[p.ownerId]
        const fill = owner ? owner.color : '#3a3f4a'
        const isSel = selected === p.id
        const isTarget = targets.includes(p.id)
        const isHi = highlight.includes(p.id)
        const stroke = isSel ? '#ffffff' : isTarget ? '#ff5252' : isHi ? '#7fd1ff' : '#0b0e13'
        const strokeWidth = isSel ? 3 : isTarget || isHi ? 2.5 : 1.5
        const units = armySize(p.garrison)
        const tip = `${p.name} (${TERRAINS[p.terrain].name})\nOwner: ${ownerName(state, p.ownerId)}\nPopulation: ${fmt(p.population)}\nGarrison: ${units} units\nUnrest: ${Math.round(p.unrest)}${p.buildings.walls ? `\nWalls: ${p.buildings.walls}` : ''}`
        return (
          <g key={p.id} className="hex" onClick={() => onSelect(p.id)}>
            <polygon points={hexPoints(cx, cy, R - 1)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} strokeDasharray={isTarget && !isSel ? '5 3' : undefined} />
            <polygon points={hexPoints(cx, cy, R * 0.6)} fill={TERRAINS[p.terrain].color} opacity={0.92} />
            {p.isCapital && (
              <text x={cx} y={cy - R * 0.22} fontSize={12} textAnchor="middle" fill="#fff" stroke="#000" strokeWidth={2} paintOrder="stroke">★</text>
            )}
            <text x={cx} y={cy + 5} fontSize={12} fontWeight={700} textAnchor="middle" fill="#fff" stroke="#000" strokeWidth={2.5} paintOrder="stroke">
              {units}
            </text>
            <text x={cx} y={cy + R * 0.78} fontSize={7.5} textAnchor="middle" fill="#fff" stroke="#000" strokeWidth={1.5} paintOrder="stroke" opacity={0.95}>
              {p.name}
            </text>
            <title>{tip}</title>
          </g>
        )
      })}
    </svg>
  )
}

export function MapLegend({ state }: { state: GameState }) {
  return (
    <div className="legend">
      {state.nations.filter((n) => n.alive).map((n) => (
        <span key={n.id} className="item">
          <span className="swatch" style={{ background: n.color }} />
          {n.name} <span className="muted">({ownedProvinces(state, n.id).length})</span>
        </span>
      ))}
      <span className="item"><span className="swatch" style={{ background: '#3a3f4a' }} />Independent <span className="muted">({state.provinces.filter((p) => p.ownerId === null).length})</span></span>
      <span className="item muted">|</span>
      {(Object.keys(TERRAINS) as Array<keyof typeof TERRAINS>).map((t) => (
        <span key={t} className="item"><span className="swatch" style={{ background: TERRAINS[t].color, borderRadius: '50%' }} />{TERRAINS[t].name}</span>
      ))}
    </div>
  )
}
