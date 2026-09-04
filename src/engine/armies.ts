import type { Army, FieldArmy, GameState, Nation, Province, UnitKey } from './types'
import { ARMY_BASE_MOVEMENT, ARMY_MAX_MOVEMENT, ARMY_MIN_MOVEMENT, ATTRITION_RATE, MAX_ARMY_UNITS, SIEGE_TURNS_PER_WALL, SUPPLY_BASE, SUPPLY_PER_POP, TERRAIN_MOVE_COST, UNITS, UNIT_ORDER } from './data'
import { addArmy, armyFits, armyPower, armySize, emptyArmy, hasTech, log, subArmy } from './helpers'

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
    siege: null,
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

// ---------------------------------------------------------------- sieges

/** Turns of siege a fortress can hold out for, shortened by siege engines. */
export function siegeRequired(p: Province, units: Army): number {
  const engines = units.siege
  return Math.max(1, p.buildings.walls * SIEGE_TURNS_PER_WALL - engines)
}

/** Wall levels already battered down by an ongoing siege. */
export function wallsBreached(army: FieldArmy, p: Province): number {
  if (!army.siege || army.siege.provinceId !== p.id) return 0
  return Math.min(p.buildings.walls, Math.floor(army.siege.progress / SIEGE_TURNS_PER_WALL))
}

export function canBesiege(state: GameState, army: FieldArmy, toId: number): { ok: boolean; reason: string } {
  const to = state.provinces[toId]
  if (!state.provinces[army.provinceId].neighbors.includes(toId)) return { ok: false, reason: 'Not adjacent' }
  if (to.ownerId === army.ownerId) return { ok: false, reason: 'Already yours' }
  if (to.buildings.walls <= 0) return { ok: false, reason: 'No walls to besiege. Assault it instead.' }
  if (armySize(army.units) === 0) return { ok: false, reason: 'No troops' }
  if (to.ownerId !== null && !state.nations[army.ownerId].wars.includes(to.ownerId)) {
    return { ok: false, reason: `Not at war with ${state.nations[to.ownerId].name}` }
  }
  return { ok: true, reason: '' }
}

export function startSiege(state: GameState, armyId: number, toId: number): boolean {
  const army = armyById(state, armyId)
  if (!army || !canBesiege(state, army, toId).ok) return false
  if (army.siege?.provinceId !== toId) {
    army.siege = { provinceId: toId, progress: 0 }
    log(state, 'war', `${state.nations[army.ownerId].name}'s ${army.name} lays siege to ${state.provinces[toId].name}.`)
  }
  army.movement = 0
  return true
}

export function breakSiege(army: FieldArmy): void {
  army.siege = null
}

/** Armies currently investing a province. */
export function besiegersOf(state: GameState, provinceId: number): FieldArmy[] {
  return state.armies.filter((a) => a.siege?.provinceId === provinceId)
}

export interface SiegeFall { armyId: number; provinceId: number }

/** Advances every siege by a turn and reports the fortresses that surrendered. */
export function advanceSieges(state: GameState): SiegeFall[] {
  const fallen: SiegeFall[] = []
  for (const army of state.armies) {
    if (!army.siege) continue
    const target = state.provinces[army.siege.provinceId]
    const stillValid = state.provinces[army.provinceId].neighbors.includes(target.id)
      && target.ownerId !== army.ownerId
      && (target.ownerId === null || state.nations[army.ownerId].wars.includes(target.ownerId))
    if (!stillValid) { army.siege = null; continue }
    army.siege.progress += 1
    // A blockaded province suffers.
    target.unrest = Math.min(100, target.unrest + 3)
    target.devastation = Math.min(1, target.devastation + 0.04)
    if (army.siege.progress >= siegeRequired(target, army.units)) fallen.push({ armyId: army.id, provinceId: target.id })
  }
  return fallen
}

// ---------------------------------------------------------------- supply

/** Units a province can feed before armies quartered there begin to waste away. */
export function supplyLimit(p: Province): number {
  const base = SUPPLY_BASE + Math.floor(p.population / SUPPLY_PER_POP)
  const hostile = p.ownerId === null ? 0.6 : 1
  return Math.max(2, Math.round(base * (1 - p.devastation * 0.5) * hostile))
}

/** Everything a nation has quartered in a province: its garrison plus its armies there. */
export function unitsQuartered(state: GameState, provinceId: number, nationId: number): number {
  const p = state.provinces[provinceId]
  const garrison = p.ownerId === nationId ? armySize(p.garrison) : 0
  return garrison + state.armies.filter((a) => a.provinceId === provinceId && a.ownerId === nationId).reduce((s, a) => s + armySize(a.units), 0)
}

export interface AttritionLoss { armyId: number; lost: number; provinceName: string }

/** Starves overcrowded stacks. Returns what each army lost. */
export function applyAttrition(state: GameState, rand: () => number): AttritionLoss[] {
  const losses: AttritionLoss[] = []
  const seen = new Set<string>()
  for (const army of state.armies) {
    const key = `${army.provinceId}:${army.ownerId}`
    if (seen.has(key)) continue
    seen.add(key)
    const p = state.provinces[army.provinceId]
    const limit = supplyLimit(p)
    const quartered = unitsQuartered(state, army.provinceId, army.ownerId)
    if (quartered <= limit) continue
    const excess = quartered - limit
    const here = state.armies.filter((a) => a.provinceId === army.provinceId && a.ownerId === army.ownerId)
    const toKill = Math.max(1, Math.round(excess * ATTRITION_RATE))
    for (let i = 0; i < toKill; i++) {
      const victim = here.filter((a) => armySize(a.units) > 0).sort((a, b) => armySize(b.units) - armySize(a.units))[0]
      if (!victim) break
      const kinds = UNIT_ORDER.filter((k) => victim.units[k] > 0)
      const kind = kinds[Math.floor(rand() * kinds.length)] ?? kinds[0]
      if (!kind) break
      victim.units[kind] -= 1
      victim.morale = Math.max(10, victim.morale - 5)
      const rec = losses.find((l) => l.armyId === victim.id)
      if (rec) rec.lost += 1
      else losses.push({ armyId: victim.id, lost: 1, provinceName: p.name })
    }
  }
  pruneArmies(state)
  return losses
}

/** Sends a broken army back to the nearest province of its own nation. */
export function retreatArmy(state: GameState, army: FieldArmy): boolean {
  const here = state.provinces[army.provinceId]
  if (here.ownerId === army.ownerId) return false
  const refuge = here.neighbors.map((i) => state.provinces[i]).find((p) => p.ownerId === army.ownerId)
  if (!refuge) return false
  army.provinceId = refuge.id
  army.siege = null
  return true
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
  army.siege = null
  return true
}

/** Trims a force down to the largest army the crown can hold together, keeping the best troops. */
export function capToMaxArmy(units: Army): Army {
  let total = armySize(units)
  if (total <= MAX_ARMY_UNITS) return { ...units }
  const out = { ...units }
  for (const k of ['militia', 'archers', 'siege', 'infantry', 'cavalry'] as UnitKey[]) {
    while (total > MAX_ARMY_UNITS && out[k] > 0) { out[k] -= 1; total -= 1 }
  }
  return out
}

/** Splits units out of a province garrison into a new field army. */
export function raiseArmy(state: GameState, nationId: number, provinceId: number, units: Army): FieldArmy | null {
  const p = state.provinces[provinceId]
  if (p.ownerId !== nationId) return null
  units = capToMaxArmy(units)
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
  if (armySize(into.units) + armySize(from.units) > MAX_ARMY_UNITS) return false
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
