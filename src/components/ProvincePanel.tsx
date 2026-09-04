import { useEffect, useState } from 'react'
import type { Army, BuildingKey, GameState, Province, UnitKey } from '../engine/types'
import type { Action } from '../engine/actions'
import { armiesAt, describeFieldArmy, supplyLimit, unitsQuartered } from '../engine/armies'

import { BUILDINGS, BUILDING_ORDER, MAX_DEVELOPMENT, RESOURCES, TERRAINS, UNITS, UNIT_ORDER, developmentBonus } from '../engine/data'
import { armySize, describeArmy, emptyArmy, fmt, ownerName, playerNation } from '../engine/helpers'
import { buildTurns, buildingCost, canBuild, canDevelop, canRecruit, developTurns, provinceOutput, unitCost } from '../engine/economy'
import { provinceCapacity } from '../engine/population'

import { atWar } from '../engine/diplomacy'
import { ArmyPicker, Bar, unrestColor } from './common'
import { YieldsPanel } from './YieldsPanel'
import { buildingGain, describeGain } from '../engine/yields'

interface Props {
  state: GameState
  province: Province | null
  dispatch: (a: Action) => void
  onSelect: (id: number) => void
  onFocus?: (id: number) => void
  attackPreset?: number | null
  onDiplomacy?: () => void
  selectedArmy?: number | null
  onSelectArmy?: (id: number) => void
}

function costText(c: { gold: number; wood: number; iron: number }) {
  const parts = []
  if (c.gold) parts.push(`${c.gold}g`)
  if (c.wood) parts.push(`${c.wood}w`)
  if (c.iron) parts.push(`${c.iron}i`)
  return parts.join(' ')
}

export function ProvincePanel({ state, province: p, dispatch, onSelect, onFocus, onDiplomacy, selectedArmy = null, onSelectArmy }: Props) {
  const player = playerNation(state)
  const [unit, setUnit] = useState<UnitKey>('infantry')
  const [count, setCount] = useState(1)
  const [raiseUnits, setRaiseUnits] = useState<Army>(emptyArmy())

  useEffect(() => {
    setRaiseUnits(emptyArmy())
  }, [p?.id, state.turn])

  if (!p) return <p className="muted">Select a province on the map.</p>

  const owner = p.ownerId === null ? null : state.nations[p.ownerId]
  const mine = p.ownerId === player.id
  const out = provinceOutput(state, p)
  const cap = provinceCapacity(p, owner)
  const t = TERRAINS[p.terrain]
  const neighbours = p.neighbors.map((i) => state.provinces[i])
  const stationed = mine ? armiesAt(state, p.id).filter((a) => a.ownerId === player.id) : []

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
          <dt>Food balance</dt><dd className={out.food - p.population / 1000 >= 0 ? 'ok' : 'bad'}>{(out.food - p.population / 1000 >= 0 ? '+' : '') + (out.food - p.population / 1000).toFixed(1)} <span className="muted">(makes {out.food.toFixed(1)}, eats {(p.population / 1000).toFixed(1)})</span></dd>
          <dt>Terrain</dt><dd>defence ×{t.defense} · cavalry ×{t.cavalry}</dd>
          <dt title="Development multiplies every yield from this province">Development</dt>
          <dd>{p.development} / {MAX_DEVELOPMENT} <span className="muted">(×{developmentBonus(p.development).toFixed(2)} yields)</span></dd>
          {p.rivers.length > 0 && <><dt>Rivers</dt><dd className="info">on {p.rivers.length} border{p.rivers.length === 1 ? '' : 's'}</dd></>}
          {p.terrain === 'mountains' && p.pass && <><dt>Terrain feature</dt><dd className="info">Mountain pass</dd></>}
          {mine && <><dt title="Units this province can feed before armies quartered here start to starve">Supply</dt><dd className={unitsQuartered(state, p.id, player.id) > supplyLimit(p) ? 'bad' : ''}>{unitsQuartered(state, p.id, player.id)} / {supplyLimit(p)}</dd></>}
          {p.resource && <><dt>Resource</dt><dd title={RESOURCES[p.resource].description}><span style={{ color: RESOURCES[p.resource].color }}>{RESOURCES[p.resource].glyph}</span> {RESOURCES[p.resource].name}</dd></>}
        </dl>
        {p.resource && <div className="muted small" style={{ marginTop: 6 }}>{RESOURCES[p.resource].description}</div>}
        <div style={{ marginTop: 6 }}><Bar value={p.unrest} color={unrestColor(p.unrest)} /></div>
      </div>

      <h3>Garrison <span className="muted small">(defends this province)</span></h3>
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

      <h3 id="sec-yields">Yields</h3>
      <YieldsPanel state={state} province={p} player={player} mine={mine} dispatch={dispatch} />

      {mine && (
        <>
          <h3 id="sec-construction">Public works</h3>
          {p.construction ? (
            <div className="card construction">
              <div className="row between">
                <b>{p.construction.kind === 'building' ? BUILDINGS[p.construction.building].name : `Development to ${p.development + 1}`}</b>
                <span className="muted small">{p.construction.turnsLeft} of {p.construction.total} turn{p.construction.total === 1 ? '' : 's'} left</span>
              </div>
              <Bar value={p.construction.total - p.construction.turnsLeft} max={p.construction.total} color="var(--info)" />
              <div className="row" style={{ marginTop: 8 }}>
                <button className="btn small" onClick={() => dispatch({ type: 'CANCEL_CONSTRUCTION', provinceId: p.id })}>Cancel (half refunded)</button>
              </div>
            </div>
          ) : (
            <p className="muted small">Nothing is being built here. A province works on one project at a time.</p>
          )}
          {(() => {
            const dev = canDevelop(player, p)
            if (p.development >= MAX_DEVELOPMENT) return <p className="muted small">This province is fully developed.</p>
            return (
              <div className="row">
                <button className="btn" disabled={!dev.ok} title={dev.reason} onClick={() => dispatch({ type: 'DEVELOP', provinceId: p.id })}>
                  Develop to {p.development + 1} — {dev.cost} gold, {developTurns(player)} turns
                </button>
                <span className="muted small">+15% to every yield here</span>
              </div>
            )
          })()}
        </>
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
            const gain = mine && lvl < def.max ? buildingGain(state, p, b) : null
            const gainText = gain ? [describeGain(gain.yields), gain.note].filter(Boolean).join(' · ') : ''
            return (
              <tr key={b}>
                <td title={def.description}><b>{def.name}</b> <span className="muted">{lvl}/{def.max}</span>{gainText && <div className="gain small">Next level: {gainText}</div>}<div className="muted small">{def.description}</div></td>
                {mine && (
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>
                    <div className="muted small">{costText(cost)}</div>
                    <div className="muted small">{buildTurns(player, b)}t</div>
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

          <h3 id="sec-armies">Armies</h3>
          {stationed.length === 0 ? (
            <p className="muted small">No field army stands here. Raise one below to march on your neighbours.</p>
          ) : (
            <div className="stack">
              {stationed.map((a) => (
                <button key={a.id} className={'army-row' + (selectedArmy === a.id ? ' active' : '')} onClick={() => onSelectArmy?.(a.id)}>
                  <span className="swatch" style={{ background: player.color }} />
                  <span className="army-row-main">
                    <b>{a.name}</b>
                    <span className="muted small">{describeFieldArmy(a)}</span>
                  </span>
                  <span className={'army-move ' + (a.movement > 0 ? 'ok' : 'muted')}>{a.movement}/{a.maxMovement}</span>
                </button>
              ))}
            </div>
          )}

          <h3 id="sec-raise">Raise an army</h3>
          {armySize(p.garrison) === 0 ? (
            <p className="muted small">No troops in this garrison. Recruit some first.</p>
          ) : (
            <div className="stack">
              <p className="muted small">Garrisons defend where they stand. Only field armies can march and attack.</p>
              <ArmyPicker max={p.garrison} value={raiseUnits} onChange={setRaiseUnits} />
              <button className="btn primary" disabled={armySize(raiseUnits) === 0} onClick={() => { dispatch({ type: 'RAISE_ARMY', provinceId: p.id, units: raiseUnits }); setRaiseUnits(emptyArmy()) }}>
                Raise army of {armySize(raiseUnits)} units
              </button>
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
