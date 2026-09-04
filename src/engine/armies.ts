import type { Army, FieldArmy, GameState, Nation, Province, UnitKey } from './types'
import { ARMY_BASE_MOVEMENT, ARMY_MAX_MOVEMENT, ARMY_MIN_MOVEMENT, TERRAIN_MOVE_COST, UNITS, UNIT_ORDER } from './data'
import { addArmy, armyFits, armyPower, armySize, emptyArmy, hasTech, subArmy } from './helpers'

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', '11th', '12th']

export function armiesOf(state: GameState, nationId: number): FieldArmy[] {
  return state.armies.filter((a) => a.ownerId === nationId)
}

export function armiesAt(state: GameState, provinceId: number): FieldArmy[] {
  return state.armies.filter((a) => a.provinceId === provinceId)
}

export function armyById(state: GameState, id: number): FieldArmy | null {
  return state.armies.find((a) => a.id === id) ?? null
}

/** Enemy field armies stationed in a province, from the point of view of `nationId`. */
export function hostileArmiesAt(state: GameState, provinceId: number, nationId: number): FieldArmy[] {
  return state.armies.filter((a) => a.provinceId === provinceId && a.ownerId !== nationId)
}

/** Movement points an army of these units gets each turn. */
export function maxMovementFor(units: Army, n: Nation | null): number {
  const total = armySize(units)
  if (total === 0) return ARMY_BASE_MOVEMENT
  let m = ARMY_BASE_MOVEMENT
  if (units.cavalry >= total / 2) m += 1
  if (units.siege > 0) m -= 1
  if (hasTech(n, 'logistics')) m += 1
  return Math.max(ARMY_MIN_MOVEMENT, Math.min(ARMY_MAX_MOVEMENT, m))
}

function nextArmyName(state: GameState, ownerId: number): string {
  const used = new Set(armiesOf(state, ownerId).map((a) => a.name))
  for (const o of ORDINALS) if (!used.has(`${o} Army`)) return `${o} Army`
  return `Army ${state.nextId}`
}

/** Creates a field army in a province. Callers deduct the units from wherever they came. */
export function createArmy(state: GameState, ownerId: number, provinceId: number, units: Army): FieldArmy {
  const n = state.nations[ownerId]
  const maxMovement = maxMovementFor(units, n)
  const army: FieldArmy = {
    id: state.nextId++,
    name: nextArmyName(state, ownerId),
    ownerId,
    provinceId,
    units: { ...units },
    movement: 0,
    maxMovement,
    morale: 100,
  }
  state.armies.push(army)
  return army
}

export function removeArmy(state: GameState, armyId: number): void {
  const i = state.armies.findIndex((a) => a.id === armyId)
  if (i >= 0) state.armies.splice(i, 1)
}

/** Drops armies that have no units left. */
export function pruneArmies(state: GameState): void {
  for (let i = state.armies.length - 1; i >= 0; i--) {
    if (armySize(state.armies[i].units) === 0) state.armies.splice(i, 1)
  }
}

export function refreshMovement(state: GameState): void {
  for (const a of state.armies) {
    a.maxMovement = maxMovementFor(a.units, state.nations[a.ownerId])
    a.movement = a.maxMovement
    a.morale = Math.min(100, a.morale + 15)
  }
}

/** Can this nation's armies walk through the province without fighting? */
export function isPassable(state: GameState, p: Province, nationId: number): boolean {
  if (p.ownerId === nationId) return true
  if (p.ownerId === null) return false
  const n = state.nations[nationId]
  if (!n.allies.includes(p.ownerId)) return false
  return hostileArmiesAt(state, p.id, nationId).length === 0
}

export function moveCost(p: Province): number {
  return TERRAIN_MOVE_COST[p.terrain]
}

/** Province ids the army can reach this turn, mapped to the movement they cost. */
export function reachable(state: GameState, army: FieldArmy): Map<number, number> {
  const out = new Map<number, number>([[army.provinceId, 0]])
  const frontier: number[] = [army.provinceId]
  while (frontier.length) {
    frontier.sort((a, b) => out.get(a)! - out.get(b)!)
    const id = frontier.shift()!
    const spent = out.get(id)!
    for (const nid of state.provinces[id].neighbors) {
      const p = state.provinces[nid]
      if (!isPassable(state, p, army.ownerId)) continue
      const cost = spent + moveCost(p)
      if (cost > army.movement) continue
      if (out.has(nid) && out.get(nid)! <= cost) continue
      out.set(nid, cost)
      frontier.push(nid)
    }
  }
  out.delete(army.provinceId)
  return out
}

/** Cheapest route to a destination the army can reach this turn, or null. */
export function pathTo(state: GameState, army: FieldArmy, destId: number): number[] | null {
  const cost = new Map<number, number>([[army.provinceId, 0]])
  const prev = new Map<number, number>()
  const frontier: number[] = [army.provinceId]
  while (frontier.length) {
    frontier.sort((a, b) => cost.get(a)! - cost.get(b)!)
    const id = frontier.shift()!
    if (id === destId) break
    for (const nid of state.provinces[id].neighbors) {
      const p = state.provinces[nid]
      if (!isPassable(state, p, army.ownerId)) continue
      const c = cost.get(id)! + moveCost(p)
      if (c > army.movement) continue
      if (cost.has(nid) && cost.get(nid)! <= c) continue
      cost.set(nid, c)
      prev.set(nid, id)
      frontier.push(nid)
    }
  }
  if (!cost.has(destId)) return null
  const path: number[] = []
  let cur = destId
  while (cur !== army.provinceId) {
    path.unshift(cur)
    cur = prev.get(cur)!
  }
  return path
}

export interface MoveCheck { ok: boolean; reason: string; cost: number; path: number[] }

export function canMoveArmy(state: GameState, army: FieldArmy, destId: number): MoveCheck {
  if (destId === army.provinceId) return { ok: false, reason: 'Already there', cost: 0, path: [] }
  if (army.movement <= 0) return { ok: false, reason: 'No movement left this turn', cost: 0, path: [] }
  const path = pathTo(state, army, destId)
  if (!path) return { ok: false, reason: 'Out of range, or the way is blocked', cost: 0, path: [] }
  const cost = path.reduce((s, id) => s + moveCost(state.provinces[id]), 0)
  return { ok: true, reason: '', cost, path }
}

export function moveArmy(state: GameState, armyId: number, destId: number): boolean {
  const army = armyById(state, armyId)
  if (!army) return false
  const check = canMoveArmy(state, army, destId)
  if (!check.ok) return false
  army.provinceId = destId
  army.movement -= check.cost
  return true
}

/** Splits units out of a province garrison into a new field army. */
export function raiseArmy(state: GameState, nationId: number, provinceId: number, units: Army): FieldArmy | null {
  const p = state.provinces[provinceId]
  if (p.ownerId !== nationId) return null
  if (armySize(units) === 0 || !armyFits(p.garrison, units)) return null
  p.garrison = subArmy(p.garrison, units)
  const army = createArmy(state, nationId, provinceId, units)
  army.movement = army.maxMovement
  return army
}

/** Folds a field army back into the garrison of the province it stands in. */
export function disbandIntoGarrison(state: GameState, armyId: number): boolean {
  const army = armyById(state, armyId)
  if (!army) return false
  const p = state.provinces[army.provinceId]
  if (p.ownerId !== army.ownerId) return false
  p.garrison = addArmy(p.garrison, army.units)
  removeArmy(state, armyId)
  return true
}

export function mergeArmies(state: GameState, intoId: number, fromId: number): boolean {
  const into = armyById(state, intoId)
  const from = armyById(state, fromId)
  if (!into || !from || into.id === from.id) return false
  if (into.ownerId !== from.ownerId || into.provinceId !== from.provinceId) return false
  into.units = addArmy(into.units, from.units)
  into.movement = Math.min(into.movement, from.movement)
  into.morale = Math.round((into.morale + from.morale) / 2)
  into.maxMovement = maxMovementFor(into.units, state.nations[into.ownerId])
  removeArmy(state, fromId)
  return true
}

export function splitArmy(state: GameState, armyId: number, units: Army): FieldArmy | null {
  const army = armyById(state, armyId)
  if (!army) return null
  if (armySize(units) === 0 || !armyFits(army.units, units)) return null
  if (armySize(units) === armySize(army.units)) return null
  army.units = subArmy(army.units, units)
  army.maxMovement = maxMovementFor(army.units, state.nations[army.ownerId])
  const child = createArmy(state, army.ownerId, army.provinceId, units)
  child.movement = army.movement
  child.morale = army.morale
  return child
}

/** Total defending force in a province: its garrison plus every friendly army standing there. */
export function defendersAt(state: GameState, provinceId: number): { units: Army; armies: FieldArmy[] } {
  const p = state.provinces[provinceId]
  const armies = p.ownerId === null
    ? state.armies.filter((a) => a.provinceId === provinceId)
    : state.armies.filter((a) => a.provinceId === provinceId && a.ownerId === p.ownerId)
  let units = { ...p.garrison }
  for (const a of armies) units = addArmy(units, a.units)
  return { units, armies }
}

/** Spreads casualties across the garrison and defending armies in proportion to their size. */
export function applyDefenderLosses(state: GameState, provinceId: number, survivors: Army): void {
  const { armies } = defendersAt(state, provinceId)
  const p = state.provinces[provinceId]
  const pools: Array<{ get: () => Army; set: (a: Army) => void }> = [
    { get: () => p.garrison, set: (a) => { p.garrison = a } },
    ...armies.map((army) => ({ get: () => army.units, set: (a: Army) => { army.units = a } })),
  ]
  for (const k of UNIT_ORDER) {
    let left = survivors[k]
    for (const pool of pools) {
      const cur = pool.get()
      const take = Math.min(cur[k], left)
      pool.set({ ...cur, [k]: take })
      left -= take
    }
  }
  pruneArmies(state)
}

export function armyStrength(a: FieldArmy): number {
  return armyPower(a.units)
}

export function describeFieldArmy(a: FieldArmy): string {
  const parts = UNIT_ORDER.filter((k) => a.units[k] > 0).map((k) => `${a.units[k]} ${UNITS[k].name.toLowerCase()}`)
  return parts.length ? parts.join(', ') : 'no troops'
}

export const emptyUnits = emptyArmy
export type { UnitKey }
