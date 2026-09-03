import { useMemo } from 'react'
import type { Army, GameState } from '../engine/types'
import { attackTargets } from '../engine/actions'
import { TERRAINS } from '../engine/data'
import { armySize, describeArmy, ownerName, playerNation } from '../engine/helpers'
import { attackPower, defensePower } from '../engine/military'
import { atWar } from '../engine/diplomacy'
import { Locate, Shield, Swords } from './icons'

interface Props {
  state: GameState
  selected: number | null
  attackTarget: number | null
  onAttack: (from: number, to: number, army: Army) => void
  onCancelAttack: () => void
  onCustomise: (target: number) => void
  onSection: (section: 'build' | 'recruit' | 'attack' | 'move') => void
  onDiplomacy: () => void
  onFocus: (id: number) => void
  onPickSource: (target: number) => void
}

/** Default strike force: everything except militia, or everything if only militia is present. */
export function defaultStrikeForce(garrison: Army): Army {
  const force = { ...garrison, militia: 0 }
  return armySize(force) > 0 ? force : { ...garrison }
}

export function bestSourceFor(state: GameState, target: number): number | null {
  const player = playerNation(state)
  const t = state.provinces[target]
  let best: { id: number; power: number } | null = null
  for (const i of t.neighbors) {
    const p = state.provinces[i]
    if (p.ownerId !== player.id || p.lockedTurn === state.turn || armySize(p.garrison) === 0) continue
    if (!attackTargets(state, p.id).includes(target)) continue
    const power = attackPower(defaultStrikeForce(p.garrison), player, t.terrain, 2, state)
    if (!best || power > best.power) best = { id: p.id, power }
  }
  return best?.id ?? null
}

export function QuickBar({ state, selected, attackTarget, onAttack, onCancelAttack, onCustomise, onSection, onDiplomacy, onFocus, onPickSource }: Props) {
  const player = playerNation(state)
  const p = selected !== null ? state.provinces[selected] : null
  const target = attackTarget !== null ? state.provinces[attackTarget] : null
  const targets = useMemo(() => (p ? attackTargets(state, p.id) : []), [state, p])

  const odds = useMemo(() => {
    if (!p || !target) return null
    const force = defaultStrikeForce(p.garrison)
    const owner = target.ownerId === null ? null : state.nations[target.ownerId]
    const mine = attackPower(force, player, target.terrain, 2, state)
    const theirs = defensePower(target.garrison, owner, target, force.siege)
    const ratio = theirs > 0 ? mine / theirs : 99
    const label = ratio >= 1.8 ? ['Overwhelming', 'ok'] : ratio >= 1.25 ? ['Favourable', 'ok'] : ratio >= 0.9 ? ['Even', 'warn'] : ['Poor', 'bad']
    return { force, mine, theirs, label }
  }, [state, p, target, player])

  if (!p) return null

  if (target && odds) {
    return (
      <div className="quickbar attack-mode">
        <div className="qb-title">
          <Swords />
          <span><b>{p.name}</b> → <b>{target.name}</b> <span className="muted">({ownerName(state, target.ownerId)} · {TERRAINS[target.terrain].name}{target.buildings.walls ? ` · walls ${target.buildings.walls}` : ''})</span></span>
        </div>
        <div className="qb-odds">
          <span>Our {Math.round(odds.mine)} vs their {Math.round(odds.theirs)}</span>
          <span className={odds.label[1]}><b>{odds.label[0]}</b></span>
          <span className="muted small">{describeArmy(odds.force)} vs {describeArmy(target.garrison)}</span>
        </div>
        <div className="qb-actions">
          <button className="btn danger" disabled={armySize(odds.force) === 0} onClick={() => onAttack(p.id, target.id, odds.force)}>Attack with {armySize(odds.force)} units</button>
          <button className="btn" onClick={() => onCustomise(target.id)}>Choose troops…</button>
          <button className="btn" onClick={onCancelAttack}>Cancel</button>
        </div>
      </div>
    )
  }

  const mine = p.ownerId === player.id
  const owner = p.ownerId === null ? null : state.nations[p.ownerId]
  const locked = p.lockedTurn === state.turn
  const canBeAttacked = !mine && (owner === null || atWar(player, owner)) && bestSourceFor(state, p.id) !== null

  return (
    <div className="quickbar">
      <div className="qb-title">
        <span className="swatch" style={{ background: owner?.color ?? '#6b6b6b' }} />
        <span><b>{p.isCapital ? '★ ' : ''}{p.name}</b> <span className="muted">· {mine ? 'Your province' : ownerName(state, p.ownerId)} · {TERRAINS[p.terrain].name}</span></span>
        <span className="qb-garrison" title={describeArmy(p.garrison)}><Shield /> {armySize(p.garrison)}</span>
      </div>
      <div className="qb-actions">
        {mine ? (
          <>
            <button className="btn" onClick={() => onSection('build')}>Build</button>
            <button className="btn" onClick={() => onSection('recruit')}>Recruit</button>
            <button className="btn" disabled={targets.length === 0 || locked} title={locked ? 'Already acted this turn' : targets.length ? 'Click a red-ringed neighbour on the map, or open the list' : 'No adjacent enemy or independent land'} onClick={() => onSection('attack')}>
              <Swords /> Attack{targets.length ? ` (${targets.length})` : ''}
            </button>
            <button className="btn" disabled={locked || armySize(p.garrison) === 0} onClick={() => onSection('move')}>Move troops</button>
            {targets.length > 0 && !locked && <span className="qb-hint">Click a red-ringed neighbour to attack it</span>}
            {locked && <span className="qb-hint">This garrison has acted this turn</span>}
          </>
        ) : (
          <>
            {canBeAttacked && <button className="btn danger" onClick={() => onPickSource(p.id)}><Swords /> Attack from nearest army</button>}
            {owner && <button className="btn" onClick={onDiplomacy}>Diplomacy with {owner.name}</button>}
            {!owner && <span className="muted small">Independent tribes. No declaration of war needed.</span>}
            {owner && !atWar(player, owner) && <span className="muted small">At peace. Declare war in Diplomacy before attacking.</span>}
          </>
        )}
        <button className="icon-btn" title="Centre camera" onClick={() => onFocus(p.id)}><Locate /></button>
      </div>
    </div>
  )
}
