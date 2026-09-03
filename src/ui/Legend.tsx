import type { GameState } from '../engine/types'
import { ownedProvinces } from '../engine/helpers'

export function Legend({ state, onFocusNation, inline = false }: { state: GameState; onFocusNation: (id: number) => void; inline?: boolean }) {
  const player = state.nations.find((n) => n.isPlayer)!
  const rows = [player, ...state.nations.filter((n) => n.alive && !n.isPlayer)]
  return (
    <div className={"legend-3d" + (inline ? " inline" : "")}>
      {rows.map((n) => {
        const war = player.wars.includes(n.id)
        const ally = player.allies.includes(n.id)
        return (
          <button key={n.id} className={'legend-row' + (n.isPlayer ? ' me' : '')} onClick={() => onFocusNation(n.id)} title={n.isPlayer ? 'Go to your capital (H)' : `Go to the capital of ${n.name}`}>
            <span className="swatch" style={{ background: n.color }} />
            <span className="legend-name">{n.name}</span>
            {n.isPlayer && <span className="tag you">you</span>}
            <span className="legend-count">{ownedProvinces(state, n.id).length}</span>
            {war && <span className="tag bad">war</span>}
            {ally && <span className="tag ok">ally</span>}
          </button>
        )
      })}
      <div className="legend-row static">
        <span className="swatch" style={{ background: '#6b6b6b' }} />
        <span className="legend-name">Independent</span>
        <span className="legend-count">{state.provinces.filter((p) => p.ownerId === null).length}</span>
      </div>
    </div>
  )
}
