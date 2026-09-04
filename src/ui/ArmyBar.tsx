import { useState } from 'react'
import type { Army, GameState } from '../engine/types'
import type { Action } from '../engine/actions'
import { armyAttackTargets } from '../engine/actions'
import { TERRAINS } from '../engine/data'
import { armySize, describeArmy, emptyArmy, ownerName, playerNation } from '../engine/helpers'
import { armiesAt, armyById, canBesiege, defendersAt, describeFieldArmy, siegeRequired, supplyLimit, unitsQuartered, wallsBreached } from '../engine/armies'
import { attackPower, defensePower } from '../engine/military'
import { ArmyPicker } from '../components/common'
import { Locate, Shield, Swords } from './icons'

interface Props {
  state: GameState
  armyId: number
  attackTarget: number | null
  dispatch: (a: Action) => void
  onAttack: (armyId: number, toId: number) => void
  onBesiege: (armyId: number, toId: number) => void
  onCancelAttack: () => void
  onDeselect: () => void
  onFocus: (id: number) => void
}

export function ArmyBar({ state, armyId, attackTarget, dispatch, onAttack, onBesiege, onCancelAttack, onDeselect, onFocus }: Props) {
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
    const breach = wallsBreached(army, target)
    const mineP = attackPower(army.units, player, target.terrain, 2, state)
    const theirs = defensePower(def.units, owner, target, army.units.siege, breach)
    const siegeOk = canBesiege(state, army, target.id)
    const required = siegeRequired(target, army.units)
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
          {target.buildings.walls > 0 && (
            <span className="muted small">Walls {target.buildings.walls}{breach > 0 ? ` · ${breach} breached by the siege` : ''}</span>
          )}
        </div>
        <div className="qb-actions">
          <button className="btn danger" onClick={() => onAttack(army.id, target.id)}>Storm with {armySize(army.units)} units</button>
          {siegeOk.ok && (
            <button className="btn" title={`Invest the fortress instead. It surrenders after ${required} turn${required === 1 ? '' : 's'}, and every turn of siege lowers its walls.`} onClick={() => onBesiege(army.id, target.id)}>
              Lay siege ({required} turn{required === 1 ? '' : 's'})
            </button>
          )}
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
        {(() => {
          const limit = supplyLimit(here)
          const quartered = unitsQuartered(state, here.id, army.ownerId)
          return quartered > limit
            ? <span className="bad small">Over supply here: {quartered} of {limit} fed. Troops are starving.</span>
            : <span className="muted small">Supply {quartered}/{limit}</span>
        })()}
        {mine && army.movement > 0 && <span className="muted small">Click a blue tile to march, a red one to attack</span>}
        {mine && army.movement <= 0 && <span className="muted small">This army has finished moving this turn</span>}
        {targets.length > 0 && <span className="bad small">{targets.length} target{targets.length === 1 ? '' : 's'} in reach</span>}
      </div>
      {army.siege && (() => {
        const besieged = state.provinces[army.siege.provinceId]
        const required = siegeRequired(besieged, army.units)
        const pct = Math.min(100, (army.siege.progress / required) * 100)
        return (
          <div className="siege-strip">
            <div className="row between small">
              <span>Besieging <b>{besieged.name}</b> · walls {besieged.buildings.walls}, {wallsBreached(army, besieged)} breached</span>
              <span className="muted">{army.siege.progress} / {required} turns</span>
            </div>
            <div className="bar"><div style={{ width: `${pct}%`, background: 'var(--warn)' }} /></div>
          </div>
        )
      })()}
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
            {army.siege && <button className="btn" onClick={() => dispatch({ type: 'MOVE_ARMY', armyId: army.id, destId: army.provinceId })}>Lift siege</button>}
            <button className="btn" onClick={onDeselect}>Done</button>
            <button className="icon-btn" title="Centre camera" onClick={() => onFocus(army.provinceId)}><Locate /></button>
          </div>
        )
      )}
    </div>
  )
}
