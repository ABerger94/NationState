import { useState } from 'react'
import type { Army, GameState } from '../engine/types'
import type { Action } from '../engine/actions'
import { armyAttackTargets } from '../engine/actions'
import { TERRAINS } from '../engine/data'
import { armySize, describeArmy, emptyArmy, ownerName, playerNation } from '../engine/helpers'
import { armiesAt, armyById, defendersAt, describeFieldArmy } from '../engine/armies'
import { attackPower, defensePower } from '../engine/military'
import { ArmyPicker } from '../components/common'
import { Locate, Shield, Swords } from './icons'

interface Props {
  state: GameState
  armyId: number
  attackTarget: number | null
  dispatch: (a: Action) => void
  onAttack: (armyId: number, toId: number) => void
  onCancelAttack: () => void
  onDeselect: () => void
  onFocus: (id: number) => void
}

export function ArmyBar({ state, armyId, attackTarget, dispatch, onAttack, onCancelAttack, onDeselect, onFocus }: Props) {
  const [splitting, setSplitting] = useState(false)
  const [split, setSplit] = useState<Army>(emptyArmy())
  const army = armyById(state, armyId)
  const player = playerNation(state)
  if (!army) return null
  const here = state.provinces[army.provinceId]
  const mine = army.ownerId === player.id
  const others = armiesAt(state, army.provinceId).filter((a) => a.id !== army.id && a.ownerId === army.ownerId)
  const targets = armyAttackTargets(state, army.id)
  const target = attackTarget !== null ? state.provinces[attackTarget] : null

  if (target && mine) {
    const owner = target.ownerId === null ? null : state.nations[target.ownerId]
    const def = defendersAt(state, target.id)
    const mineP = attackPower(army.units, player, target.terrain, 2, state)
    const theirs = defensePower(def.units, owner, target, army.units.siege)
    const ratio = theirs > 0 ? mineP / theirs : 99
    const label = ratio >= 1.8 ? ['Overwhelming', 'ok'] : ratio >= 1.25 ? ['Favourable', 'ok'] : ratio >= 0.9 ? ['Even', 'warn'] : ['Poor', 'bad']
    return (
      <div className="quickbar attack-mode">
        <div className="qb-title">
          <Swords />
          <span><b>{army.name}</b> → <b>{target.name}</b> <span className="muted">({ownerName(state, target.ownerId)} · {TERRAINS[target.terrain].name}{target.buildings.walls ? ` · walls ${target.buildings.walls}` : ''})</span></span>
        </div>
        <div className="qb-odds">
          <span>Our {Math.round(mineP)} vs their {Math.round(theirs)}</span>
          <span className={label[1]}><b>{label[0]}</b></span>
          <span className="muted small">{describeArmy(def.units)} defending</span>
        </div>
        <div className="qb-actions">
          <button className="btn danger" onClick={() => onAttack(army.id, target.id)}>Attack with {armySize(army.units)} units</button>
          <button className="btn" onClick={onCancelAttack}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="quickbar army-mode">
      <div className="qb-title">
        <span className="swatch" style={{ background: state.nations[army.ownerId].color }} />
        <span><b>{army.name}</b> <span className="muted">· {describeFieldArmy(army)} · in {here.name}</span></span>
        <span className="qb-garrison"><Shield /> {armySize(army.units)}</span>
      </div>
      <div className="qb-odds">
        <span className={army.movement > 0 ? 'ok' : 'muted'}>Movement <b>{army.movement}</b> / {army.maxMovement}</span>
        <span className="muted">Morale <b>{Math.round(army.morale)}</b></span>
        {mine && army.movement > 0 && <span className="muted small">Click a blue tile to march, a red one to attack</span>}
        {mine && army.movement <= 0 && <span className="muted small">This army has finished moving this turn</span>}
        {targets.length > 0 && <span className="bad small">{targets.length} target{targets.length === 1 ? '' : 's'} in reach</span>}
      </div>
      {mine && (
        splitting ? (
          <div className="stack">
            <ArmyPicker max={army.units} value={split} onChange={setSplit} />
            <div className="qb-actions">
              <button className="btn primary" disabled={armySize(split) === 0 || armySize(split) === armySize(army.units)} onClick={() => { dispatch({ type: 'SPLIT_ARMY', armyId: army.id, units: split }); setSplitting(false); setSplit(emptyArmy()) }}>Split off {armySize(split)} units</button>
              <button className="btn" onClick={() => { setSplitting(false); setSplit(emptyArmy()) }}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="qb-actions">
            <button className="btn" disabled={armySize(army.units) < 2} onClick={() => setSplitting(true)}>Split</button>
            {others.map((o) => (
              <button key={o.id} className="btn" onClick={() => dispatch({ type: 'MERGE_ARMIES', intoId: army.id, fromId: o.id })}>Merge {o.name}</button>
            ))}
            <button className="btn" disabled={here.ownerId !== player.id} title={here.ownerId === player.id ? 'Fold this army back into the local garrison' : 'Only in your own province'} onClick={() => { dispatch({ type: 'DISBAND_ARMY', armyId: army.id }); onDeselect() }}>Stand down</button>
            <button className="btn" onClick={onDeselect}>Done</button>
            <button className="icon-btn" title="Centre camera" onClick={() => onFocus(army.provinceId)}><Locate /></button>
          </div>
        )
      )}
    </div>
  )
}
