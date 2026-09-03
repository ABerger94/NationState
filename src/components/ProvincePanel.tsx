import { useEffect, useMemo, useState } from 'react'
import type { Army, BuildingKey, GameState, Province, UnitKey } from '../engine/types'
import type { Action } from '../engine/actions'
import { attackTargets, canTransfer } from '../engine/actions'
import { BUILDINGS, BUILDING_ORDER, RESOURCES, TERRAINS, UNITS, UNIT_ORDER } from '../engine/data'
import { armySize, describeArmy, emptyArmy, fmt, hexDistance, ownedProvinces, ownerName, playerNation } from '../engine/helpers'
import { buildingCost, canBuild, canRecruit, provinceOutput, unitCost } from '../engine/economy'
import { provinceCapacity } from '../engine/population'
import { attackPower, defensePower } from '../engine/military'
import { atWar } from '../engine/diplomacy'
import { ArmyPicker, Bar, unrestColor } from './common'

interface Props {
  state: GameState
  province: Province | null
  dispatch: (a: Action) => void
  onSelect: (id: number) => void
  transferTarget: number | null
  setTransferTarget: (id: number | null) => void
  onFocus?: (id: number) => void
  attackPreset?: number | null
  onDiplomacy?: () => void
}

function costText(c: { gold: number; wood: number; iron: number }) {
  const parts = []
  if (c.gold) parts.push(`${c.gold}g`)
  if (c.wood) parts.push(`${c.wood}w`)
  if (c.iron) parts.push(`${c.iron}i`)
  return parts.join(' ')
}

export function ProvincePanel({ state, province: p, dispatch, onSelect, transferTarget, setTransferTarget, onFocus, attackPreset = null, onDiplomacy }: Props) {
  const player = playerNation(state)
  const [unit, setUnit] = useState<UnitKey>('infantry')
  const [count, setCount] = useState(1)
  const [attackTo, setAttackTo] = useState<number | null>(null)
  const [attackArmy, setAttackArmy] = useState<Army>(emptyArmy())
  const [moveArmy, setMoveArmy] = useState<Army>(emptyArmy())

  const targets = useMemo(() => (p ? attackTargets(state, p.id) : []), [state, p])

  useEffect(() => {
    if (!p) return
    setAttackArmy({ ...p.garrison, militia: 0 })
    setMoveArmy(emptyArmy())
    setAttackTo(targets[0] ?? null)
    setTransferTarget(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p?.id, state.turn])

  useEffect(() => {
    if (attackTo !== null && !targets.includes(attackTo)) setAttackTo(targets[0] ?? null)
  }, [targets, attackTo])

  useEffect(() => {
    if (attackPreset !== null && targets.includes(attackPreset)) {
      setAttackTo(attackPreset)
      setTimeout(() => document.getElementById('sec-attack')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
    }
  }, [attackPreset, targets])

  if (!p) return <p className="muted">Select a province on the map.</p>

  const owner = p.ownerId === null ? null : state.nations[p.ownerId]
  const mine = p.ownerId === player.id
  const out = provinceOutput(state, p)
  const cap = provinceCapacity(p, owner)
  const t = TERRAINS[p.terrain]
  const locked = p.lockedTurn === state.turn
  const neighbours = p.neighbors.map((i) => state.provinces[i])
  const myProvinces = ownedProvinces(state, player.id).filter((q) => q.id !== p.id)

  const target = attackTo !== null ? state.provinces[attackTo] : null
  const targetOwner = target && target.ownerId !== null ? state.nations[target.ownerId] : null
  const myPower = target ? attackPower(attackArmy, player, target.terrain, 2, state) : 0
  const theirPower = target ? defensePower(target.garrison, targetOwner, target, attackArmy.siege) : 0
  const ratio = theirPower > 0 ? myPower / theirPower : 99
  const odds = ratio >= 1.8 ? ['Overwhelming', 'ok'] : ratio >= 1.25 ? ['Favourable', 'ok'] : ratio >= 0.9 ? ['Even', 'warn'] : ['Poor', 'bad']

  const transfer = transferTarget !== null ? canTransfer(state, p.id, transferTarget, moveArmy) : null

  return (
    <div>
      <div className="row between">
        <h2 style={{ margin: 0 }}>{p.isCapital ? '★ ' : ''}{p.name}</h2>
        <span className="row">
          <span className="muted">{t.name}</span>
          {onFocus && <button className="btn small" onClick={() => onFocus(p.id)} title="Centre the camera here">Locate</button>}
        </span>
      </div>
      <p className="muted small">
        {ownerName(state, p.ownerId)}
        {owner && !mine && (atWar(player, owner) ? <span className="bad"> · at war</span> : player.allies.includes(owner.id) ? <span className="ok"> · ally</span> : <span> · at peace</span>)}
        {p.conqueredTurn !== null && state.turn - p.conqueredTurn < 10 && <span className="warn"> · recently conquered</span>}
      </p>
      {owner && !mine && onDiplomacy && (
        <div className="row" style={{ marginBottom: 8 }}>
          <button className="btn small" onClick={onDiplomacy}>Diplomacy with {owner.name}</button>
          {!atWar(player, owner) && <span className="muted small">At peace. Declare war before attacking.</span>}
        </div>
      )}

      <div className="card">
        <dl className="kv">
          <dt>Population</dt><dd>{fmt(p.population)} <span className="muted">/ {fmt(cap)}</span></dd>
          <dt>Unrest</dt><dd style={{ color: unrestColor(p.unrest) }}>{Math.round(p.unrest)}</dd>
          {p.devastation > 0.01 && <><dt>Devastation</dt><dd className="bad">{Math.round(p.devastation * 100)}%</dd></>}
          <dt>Food</dt><dd>{out.food.toFixed(1)} <span className="muted">(eats {(p.population / 1000).toFixed(1)})</span></dd>
          <dt>Wood / Iron</dt><dd>{out.wood.toFixed(1)} / {out.iron.toFixed(1)}</dd>
          {owner && <><dt>Taxes</dt><dd>{out.gold.toFixed(1)} gold</dd></>}
          <dt>Terrain</dt><dd>defence ×{t.defense} · cavalry ×{t.cavalry}</dd>
          {p.resource && <><dt>Resource</dt><dd title={RESOURCES[p.resource].description}><span style={{ color: RESOURCES[p.resource].color }}>{RESOURCES[p.resource].glyph}</span> {RESOURCES[p.resource].name}</dd></>}
        </dl>
        {p.resource && <div className="muted small" style={{ marginTop: 6 }}>{RESOURCES[p.resource].description}</div>}
        <div style={{ marginTop: 6 }}><Bar value={p.unrest} color={unrestColor(p.unrest)} /></div>
      </div>

      <h3>Garrison {locked && <span className="muted small">(has acted this turn)</span>}</h3>
      <p>{describeArmy(p.garrison)} <span className="muted">· {armySize(p.garrison)} units</span></p>
      {mine && UNIT_ORDER.some((k) => p.garrison[k] > 0) && (
        <div className="row">
          {UNIT_ORDER.filter((k) => p.garrison[k] > 0).map((k) => (
            <button key={k} className="btn small" title={`Disband one ${UNITS[k].name}: returns ${Math.round(UNITS[k].men * 0.8)} people`} onClick={() => dispatch({ type: 'DISBAND', provinceId: p.id, unit: k, count: 1 })}>
              Disband {UNITS[k].name}
            </button>
          ))}
        </div>
      )}

      <h3 id="sec-build">Buildings</h3>
      <table className="tbl">
        <tbody>
          {BUILDING_ORDER.map((b: BuildingKey) => {
            const def = BUILDINGS[b]
            const lvl = p.buildings[b]
            if (!mine && lvl === 0) return null
            const check = mine ? canBuild(state, player, p, b) : { ok: false, reason: '' }
            const cost = buildingCost(player, b)
            return (
              <tr key={b}>
                <td title={def.description}><b>{def.name}</b> <span className="muted">{lvl}/{def.max}</span><div className="muted small">{def.description}</div></td>
                {mine && (
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>
                    <div className="muted small">{costText(cost)}</div>
                    <button className="btn small" disabled={!check.ok} title={check.reason} onClick={() => dispatch({ type: 'BUILD', provinceId: p.id, building: b })}>
                      {lvl >= def.max ? 'Max' : 'Build'}
                    </button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      {mine && (
        <>
          <h3 id="sec-recruit">Recruit</h3>
          <div className="row">
            <select value={unit} onChange={(e) => setUnit(e.target.value as UnitKey)}>
              {UNIT_ORDER.map((k) => <option key={k} value={k}>{UNITS[k].name} ({costText(unitCost(k, 1, player, state))})</option>)}
            </select>
            <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(Math.max(1, parseInt(e.target.value, 10) || 1))} />
            {(() => {
              const check = canRecruit(state, player, p, unit, count)
              return <button className="btn primary small" disabled={!check.ok} title={check.reason} onClick={() => dispatch({ type: 'RECRUIT', provinceId: p.id, unit, count })}>Recruit</button>
            })()}
          </div>
          <p className="muted small" style={{ marginTop: 6 }}>
            {UNITS[unit].description} Attack {UNITS[unit].attack}, defence {UNITS[unit].defense}, upkeep {UNITS[unit].upkeepGold} gold/turn, levies {UNITS[unit].men} people.
            {UNITS[unit].requiresBarracks && p.buildings.barracks < 1 && <span className="warn"> Needs a barracks here.</span>}
          </p>

          <h3 id="sec-attack">Attack</h3>
          {targets.length === 0 ? (
            <p className="muted small">{locked ? 'This garrison has already acted this turn.' : armySize(p.garrison) === 0 ? 'No troops here.' : 'No adjacent enemy or independent province. Declare war in Diplomacy to open new fronts.'}</p>
          ) : (
            <div className="stack">
              <div className="row">
                <select value={attackTo ?? ''} onChange={(e) => setAttackTo(parseInt(e.target.value, 10))}>
                  {targets.map((i) => {
                    const q = state.provinces[i]
                    return <option key={i} value={i}>{q.name} — {ownerName(state, q.ownerId)} ({armySize(q.garrison)} units{q.buildings.walls ? `, walls ${q.buildings.walls}` : ''})</option>
                  })}
                </select>
                <button className="btn small" onClick={() => attackTo !== null && onSelect(attackTo)}>View</button>
              </div>
              <ArmyPicker max={p.garrison} value={attackArmy} onChange={setAttackArmy} />
              {target && (
                <div className="card">
                  <div className="row between">
                    <span>Our strength <b>{Math.round(myPower)}</b> vs their defence <b>{Math.round(theirPower)}</b></span>
                    <span className={odds[1]}><b>{odds[0]}</b></span>
                  </div>
                  <div className="muted small">
                    {TERRAINS[target.terrain].name}: defence ×{TERRAINS[target.terrain].defense}, cavalry ×{TERRAINS[target.terrain].cavalry}.
                    {target.buildings.walls > 0 && ` Walls level ${target.buildings.walls}${attackArmy.siege ? ` (${attackArmy.siege} siege engines breach ${Math.min(target.buildings.walls, attackArmy.siege * 0.5)} levels)` : ''}.`}
                    {' '}Defenders: {describeArmy(target.garrison)}.
                  </div>
                </div>
              )}
              <button className="btn danger" disabled={armySize(attackArmy) === 0 || attackTo === null || !!state.pendingEvent} onClick={() => attackTo !== null && dispatch({ type: 'ATTACK', from: p.id, to: attackTo, army: attackArmy })}>
                Attack with {armySize(attackArmy)} units
              </button>
            </div>
          )}

          <h3 id="sec-move">Move troops</h3>
          {myProvinces.length === 0 ? <p className="muted small">You have no other province.</p> : locked ? <p className="muted small">This garrison has already acted this turn.</p> : (
            <div className="stack">
              <select value={transferTarget ?? ''} onChange={(e) => setTransferTarget(e.target.value === '' ? null : parseInt(e.target.value, 10))}>
                <option value="">Choose destination…</option>
                {myProvinces.slice().sort((a, b) => hexDistance(p, a) - hexDistance(p, b)).map((q) => (
                  <option key={q.id} value={q.id}>{q.name} — {hexDistance(p, q)} hex{hexDistance(p, q) === 1 ? '' : 'es'} · {armySize(q.garrison)} units</option>
                ))}
              </select>
              <ArmyPicker max={p.garrison} value={moveArmy} onChange={setMoveArmy} />
              <div className="row">
                <button className="btn" disabled={!transfer || !transfer.ok} title={transfer?.reason ?? 'Choose a destination'} onClick={() => transferTarget !== null && dispatch({ type: 'TRANSFER', from: p.id, to: transferTarget, army: moveArmy })}>
                  Move {armySize(moveArmy)} units{transfer ? ` (${transfer.cost} gold)` : ''}
                </button>
                {transfer && !transfer.ok && <span className="muted small">{transfer.reason}</span>}
              </div>
            </div>
          )}
        </>
      )}

      <h3>Neighbours</h3>
      <div className="row">
        {neighbours.map((q) => (
          <button key={q.id} className="btn small" onClick={() => onSelect(q.id)} style={{ borderColor: q.ownerId === null ? undefined : state.nations[q.ownerId].color }}>
            {q.name} <span className="muted">{armySize(q.garrison)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
