import type { Army, GameState, LogKind, Nation, NationStats, Policies, Province, ResourceKind, Resources, TechKey } from './types'
import { UNIT_ORDER, UNITS } from './data'

export const emptyArmy = (): Army => ({ militia: 0, infantry: 0, archers: 0, cavalry: 0, siege: 0 })
export const emptyResources = (): Resources => ({ gold: 0, food: 0, wood: 0, iron: 0 })

export const armySize = (a: Army): number => UNIT_ORDER.reduce((s, k) => s + a[k], 0)

export function addArmy(a: Army, b: Army): Army {
  const r = emptyArmy()
  for (const k of UNIT_ORDER) r[k] = a[k] + b[k]
  return r
}

export function subArmy(a: Army, b: Army): Army {
  const r = emptyArmy()
  for (const k of UNIT_ORDER) r[k] = Math.max(0, a[k] - b[k])
  return r
}

export function armyFits(container: Army, part: Army): boolean {
  return UNIT_ORDER.every((k) => part[k] >= 0 && part[k] <= container[k])
}

/** Rough strength of an army ignoring terrain; used for AI estimates and score. */
export function armyPower(a: Army): number {
  return UNIT_ORDER.reduce((s, k) => s + a[k] * (UNITS[k].attack + UNITS[k].defense) / 2, 0)
}

export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v))

export function cloneState<T>(s: T): T {
  return structuredClone(s)
}

export function hasTech(n: Nation | null | undefined, t: TechKey): boolean {
  return !!n && n.techs.includes(t)
}

/** Odd-r offset coordinates to cube distance. */
export function hexDistance(a: { col: number; row: number }, b: { col: number; row: number }): number {
  const toCube = (c: number, r: number) => {
    const x = c - (r - (r & 1)) / 2
    const z = r
    return { x, y: -x - z, z }
  }
  const p = toCube(a.col, a.row)
  const q = toCube(b.col, b.row)
  return Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y), Math.abs(p.z - q.z))
}

export function fmt(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M'
  if (abs >= 10_000) return (n / 1000).toFixed(1) + 'k'
  if (abs >= 1000) return Math.round(n).toLocaleString('en-US')
  if (Number.isInteger(n)) return String(n)
  return n.toFixed(1)
}

export function fmtSigned(n: number): string {
  const r = Math.round(n * 10) / 10
  return (r > 0 ? '+' : '') + fmt(r)
}

export function nationById(state: GameState, id: number): Nation {
  return state.nations[id]
}

export function provinceById(state: GameState, id: number): Province {
  return state.provinces[id]
}

export function playerNation(state: GameState): Nation {
  return state.nations.find((n) => n.isPlayer)!
}

export function ownedProvinces(state: GameState, nationId: number): Province[] {
  return state.provinces.filter((p) => p.ownerId === nationId)
}

export function totalPopulation(state: GameState, nationId: number): number {
  return ownedProvinces(state, nationId).reduce((s, p) => s + p.population, 0)
}

/** Every unit the nation fields: province garrisons plus field armies. */
export function nationArmy(state: GameState, nationId: number): Army {
  const fromProvinces = ownedProvinces(state, nationId).reduce((acc, p) => addArmy(acc, p.garrison), emptyArmy())
  return state.armies.filter((a) => a.ownerId === nationId).reduce((acc, a) => addArmy(acc, a.units), fromProvinces)
}

export function ownerName(state: GameState, ownerId: number | null): string {
  return ownerId === null ? 'Independent' : state.nations[ownerId].name
}

const IMPORTANT = /declared war|wiped from the map|has fallen|Rebellion|Objective|peace treaty|alliance/i

/** Adds a chronicle entry. Entries are flagged important when they concern the player or reshape the world. */
export function log(state: GameState, kind: LogKind, text: string, important?: boolean): void {
  const player = state.nations.find((n) => n.isPlayer)
  const flag = important ?? (kind === 'event' || (!!player && text.includes(player.name)) || IMPORTANT.test(text))
  state.log.push({ id: state.nextId++, turn: state.turn, kind, text, important: flag })
  if (state.log.length > 300) state.log.splice(0, state.log.length - 300)
}

export const emptyStats = (): NationStats => ({ built: 0, recruited: 0, battlesWon: 0, defensiveWins: 0, tribalConquests: 0, nationConquests: 0 })
export const defaultPolicies = (): Policies => ({ economy: null, military: null, society: null, changedTurn: -99 })

export function nationHasResource(state: GameState, nationId: number, kind: ResourceKind): boolean {
  return state.provinces.some((p) => p.ownerId === nationId && p.resource === kind)
}

/** Number of distinct luxury kinds a nation controls (capped at 3). */
export function luxuryCount(state: GameState, nationId: number): number {
  const kinds = new Set<ResourceKind>()
  for (const p of state.provinces) if (p.ownerId === nationId && (p.resource === 'gems' || p.resource === 'spices' || p.resource === 'wine')) kinds.add(p.resource)
  return Math.min(3, kinds.size)
}

export function yearOf(state: GameState, turn = state.turn): number {
  return state.startYear + turn - 1
}

export function describeArmy(a: Army): string {
  const parts = UNIT_ORDER.filter((k) => a[k] > 0).map((k) => `${a[k]} ${UNITS[k].name.toLowerCase()}`)
  return parts.length ? parts.join(', ') : 'no troops'
}

export function bordersNation(state: GameState, a: number, b: number): boolean {
  return state.provinces.some(
    (p) => p.ownerId === a && p.neighbors.some((nid) => state.provinces[nid].ownerId === b),
  )
}
