import type { GameState } from '../engine/types'
import { UNITS, UNIT_ORDER } from '../engine/data'
import { armyPower, armySize, describeArmy, fmt, nationArmy, ownedProvinces, playerNation } from '../engine/helpers'
import { nationBudget } from '../engine/economy'

interface Props { state: GameState; onSelect: (id: number) => void; onShowBattle: (id: number) => void }

export function MilitaryPanel({ state, onSelect, onShowBattle }: Props) {
  const player = playerNation(state)
  const army = nationArmy(state, player.id)
  const budget = nationBudget(state, player)
  const provs = ownedProvinces(state, player.id)
  const battles = state.battles.slice().reverse()
  return (
    <div>
      <h3>Armed forces</h3>
      <table className="tbl">
        <thead><tr><th>Unit</th><th className="num">Count</th><th className="num">Atk/Def</th><th className="num">Upkeep</th></tr></thead>
        <tbody>
          {UNIT_ORDER.map((k) => (
            <tr key={k}><td>{UNITS[k].name}</td><td className="num">{army[k]}</td><td className="num">{UNITS[k].attack}/{UNITS[k].defense}</td><td className="num">{UNITS[k].upkeepGold}g</td></tr>
          ))}
          <tr><td><b>Total</b></td><td className="num"><b>{armySize(army)}</b></td><td className="num" colSpan={2}>strength {Math.round(armyPower(army))} · {fmt(budget.unitGold)} gold/turn</td></tr>
        </tbody>
      </table>

      <h3>Garrisons</h3>
      <table className="tbl">
        <tbody>
          {provs.map((p) => {
            const threatened = p.neighbors.some((i) => {
              const q = state.provinces[i]
              return q.ownerId !== null && q.ownerId !== player.id && player.wars.includes(q.ownerId)
            })
            return (
              <tr key={p.id} className="clickable" onClick={() => onSelect(p.id)}>
                <td>{p.isCapital ? '★ ' : ''}{p.name}{threatened && <span className="bad small"> · front line</span>}{p.buildings.walls > 0 && <span className="muted small"> · walls {p.buildings.walls}</span>}</td>
                <td className="small">{describeArmy(p.garrison)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h3>Battle reports</h3>
      {battles.length === 0 ? <p className="muted small">No battles yet.</p> : (
        <table className="tbl">
          <tbody>
            {battles.map((b) => (
              <tr key={b.id} className="clickable" onClick={() => onShowBattle(b.id)} style={{ opacity: b.involvesPlayer ? 1 : 0.7 }}>
                <td className="muted small" style={{ whiteSpace: 'nowrap' }}>T{b.turn}</td>
                <td className="small">
                  <b>{b.provinceName}</b>: {b.attackerName} vs {b.defenderName}
                  <div className="muted">{b.winner === 'attacker' ? (b.kind === 'rebellion' ? 'rebels won' : 'attacker won') : (b.kind === 'rebellion' ? 'rebels crushed' : 'defender held')}{b.conquered && b.kind === 'battle' ? ' · conquered' : ''}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
