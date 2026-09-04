import type { GameState } from '../engine/types'
import { TERRAINS } from '../engine/data'
import { armySize, describeArmy, ownerName, playerNation } from '../engine/helpers'
import { armiesAt, armiesOf, besiegersOf, canBesiege } from '../engine/armies'
import { canArmyAttack } from '../engine/military'
import { atWar } from '../engine/diplomacy'
import { Locate, Shield, Swords } from './icons'

interface Props {
  state: GameState
  selected: number | null
  onSection: (section: 'build' | 'recruit' | 'armies' | 'raise') => void
  onDiplomacy: () => void
  onFocus: (id: number) => void
  onSelectArmy: (id: number) => void
  onPlanAttack: (armyId: number, toId: number) => void
}

/** Armies of the player that stand next to a province and could still strike it. */
export function attackersFor(state: GameState, provinceId: number) {
  const player = playerNation(state)
  return armiesOf(state, player.id).filter((a) =>
    state.provinces[a.provinceId].neighbors.includes(provinceId) && canArmyAttack(state, a, provinceId).ok,
  )
}

export function QuickBar({ state, selected, onSection, onDiplomacy, onFocus, onSelectArmy, onPlanAttack }: Props) {
  const player = playerNation(state)
  const p = selected !== null ? state.provinces[selected] : null
  if (!p) return null

  const mine = p.ownerId === player.id
  const owner = p.ownerId === null ? null : state.nations[p.ownerId]
  const stationed = armiesAt(state, p.id).filter((a) => a.ownerId === player.id)
  const attackers = mine ? [] : attackersFor(state, p.id)

  return (
    <div className="quickbar">
      <div className="qb-title">
        <span className="swatch" style={{ background: owner?.color ?? '#6b6b6b' }} />
        <span><b>{p.isCapital ? '★ ' : ''}{p.name}</b> <span className="muted">· {mine ? 'Your province' : ownerName(state, p.ownerId)} · {TERRAINS[p.terrain].name}</span></span>
        <span className="qb-garrison" title={`Garrison: ${describeArmy(p.garrison)}`}><Shield /> {armySize(p.garrison)}</span>
      </div>
      <div className="qb-actions">
        {mine ? (
          <>
            <button className="btn" onClick={() => onSection('build')}>Build</button>
            <button className="btn" onClick={() => onSection('recruit')}>Recruit</button>
            {stationed.length > 0
              ? stationed.map((a) => (
                <button key={a.id} className="btn" onClick={() => onSelectArmy(a.id)}>
                  {a.name} <span className="muted">{armySize(a.units)}</span>
                </button>
              ))
              : <button className="btn" disabled={armySize(p.garrison) === 0} title={armySize(p.garrison) === 0 ? 'No troops to muster' : 'Turn part of this garrison into a marching army'} onClick={() => onSection('raise')}>Raise army</button>}
          </>
        ) : (
          <>
            {attackers.map((a) => (
              <button key={a.id} className="btn danger" onClick={() => onPlanAttack(a.id, p.id)}>
                <Swords /> {canBesiege(state, a, p.id).ok ? 'Storm or besiege with' : 'Attack with'} {a.name}
              </button>
            ))}
            {besiegersOf(state, p.id).length > 0 && (
              <span className="warn small">Under siege by {besiegersOf(state, p.id).map((a) => a.name).join(', ')}</span>
            )}
            {owner && <button className="btn" onClick={onDiplomacy}>Diplomacy with {owner.name}</button>}
            {!attackers.length && !owner && <span className="muted small">Independent tribes. March an army next to it to attack.</span>}
            {!attackers.length && owner && !atWar(player, owner) && <span className="muted small">At peace. Declare war before attacking.</span>}
            {!attackers.length && owner && atWar(player, owner) && <span className="muted small">No army of yours is next to it with movement left.</span>}
          </>
        )}
        <button className="icon-btn" title="Centre camera" onClick={() => onFocus(p.id)}><Locate /></button>
      </div>
    </div>
  )
}
