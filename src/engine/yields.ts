import type { BuildingKey, GameState, Nation, Province } from './types'
import { BUILDINGS, TERRAINS } from './data'
import { buildingCost, canAfford, provinceOutput, type ProvinceOutput } from './economy'
import { hasTech, ownedProvinces } from './helpers'

export type YieldKey = 'food' | 'wood' | 'iron' | 'gold' | 'science'
export const YIELD_KEYS: YieldKey[] = ['food', 'wood', 'iron', 'gold', 'science']
export type MapMode = 'realm' | 'food' | 'wood' | 'iron' | 'gold' | 'unrest'
export const MAP_MODES: Array<{ key: MapMode; label: string; glyph: string; color: string }> = [
  { key: 'realm', label: 'Realm', glyph: '⬢', color: '#3d8bff' },
  { key: 'food', label: 'Food', glyph: '❦', color: '#8ac926' },
  { key: 'wood', label: 'Wood', glyph: '▲', color: '#d08a45' },
  { key: 'iron', label: 'Iron', glyph: '◆', color: '#c2ccd8' },
  { key: 'gold', label: 'Gold', glyph: '●', color: '#e0b341' },
  { key: 'unrest', label: 'Unrest', glyph: '!', color: '#ef5350' },
]
export type Quality = 'rich' | 'fair' | 'poor'

/** Which building improves which yield. */
export const YIELD_BUILDING: Record<YieldKey, BuildingKey> = { food: 'farm', wood: 'lumberMill', iron: 'mine', gold: 'market', science: 'university' }

/** Output the province would give with exactly 1,000 people and its current buildings: a fair way to compare land. */
export function yieldPer1k(state: GameState, p: Province, buildings: Province['buildings'] = p.buildings): ProvinceOutput {
  return provinceOutput(state, { ...p, population: 1000, buildings })
}

/** Raw land richness, before any building, tech or edict. */
export function landQuality(p: Province): Record<'food' | 'wood' | 'iron', Quality> {
  const t = TERRAINS[p.terrain]
  let food = t.food
  let wood = t.wood
  let iron = t.iron
  switch (p.resource) {
    case 'fertile': food *= 1.25; break
    case 'fish': food *= 1.2; break
    case 'horses': food *= 1.1; break
    case 'timber': wood *= 1.5; break
    case 'ore': iron *= 1.5; break
  }
  const rate = (v: number, rich: number, fair: number): Quality => (v >= rich ? 'rich' : v >= fair ? 'fair' : 'poor')
  return { food: rate(food, 2.4, 1.3), wood: rate(wood, 1.5, 0.7), iron: rate(iron, 1.4, 0.6) }
}

export interface BuildingGain { yields: Partial<Record<YieldKey, number>>; note: string }

/** What one more level of a building would add to this province right now. */
export function buildingGain(state: GameState, p: Province, key: BuildingKey): BuildingGain {
  const owner = p.ownerId === null ? null : state.nations[p.ownerId]
  if (p.buildings[key] >= BUILDINGS[key].max) return { yields: {}, note: 'Maximum level' }
  switch (key) {
    case 'walls': return { yields: {}, note: `+${hasTech(owner, 'masonry') ? 45 : 30}% defence` }
    case 'barracks': return { yields: {}, note: p.buildings.barracks === 0 ? 'Unlocks professional troops · +8% garrison strength' : '+8% garrison strength' }
    case 'granary': return { yields: {}, note: '+300 food storage · +30% capacity · famine halved' }
    case 'temple': return { yields: {}, note: '-3 unrest per turn · steadier stability' }
  }
  const before = provinceOutput(state, p)
  const after = provinceOutput(state, { ...p, buildings: { ...p.buildings, [key]: p.buildings[key] + 1 } })
  const yields: Partial<Record<YieldKey, number>> = {}
  for (const k of YIELD_KEYS) {
    const d = after[k] - before[k]
    if (Math.abs(d) >= 0.05) yields[k] = d
  }
  if (key === 'farm') return { yields, note: '+25% population capacity' }
  return { yields, note: '' }
}

export function gainValue(g: Partial<Record<YieldKey, number>>): number {
  return (g.food ?? 0) * 0.6 + (g.wood ?? 0) * 0.35 + (g.iron ?? 0) * 0.6 + (g.gold ?? 0) * 1 + (g.science ?? 0) * 2.5
}

export function describeGain(g: Partial<Record<YieldKey, number>>): string {
  return YIELD_KEYS.filter((k) => g[k]).map((k) => `${g[k]! > 0 ? '+' : ''}${g[k]!.toFixed(1)} ${k}`).join(', ')
}

export interface Suggestion { key: BuildingKey; gain: BuildingGain; value: number; perGold: number }

const PRODUCTION: BuildingKey[] = ['farm', 'lumberMill', 'mine', 'market', 'university']

/** The production building with the best return per gold in this province. */
export function suggestBuilding(state: GameState, n: Nation, p: Province): Suggestion | null {
  let best: Suggestion | null = null
  for (const key of PRODUCTION) {
    if (p.buildings[key] >= BUILDINGS[key].max) continue
    const gain = buildingGain(state, p, key)
    const value = gainValue(gain.yields)
    if (value <= 0) continue
    const cost = buildingCost(n, key)
    const perGold = value / Math.max(1, cost.gold + cost.wood * 0.4 + cost.iron * 0.6)
    if (!best || perGold > best.perGold) best = { key, gain, value, perGold }
  }
  return best
}

/** The single best affordable production build anywhere in the realm, for the advisor. */
export function bestBuildAcrossRealm(state: GameState, n: Nation): { provinceId: number; suggestion: Suggestion } | null {
  let best: { provinceId: number; suggestion: Suggestion } | null = null
  for (const p of ownedProvinces(state, n.id)) {
    const s = suggestBuilding(state, n, p)
    if (!s || !canAfford(n.resources, buildingCost(n, s.key))) continue
    if (!best || s.perGold > best.suggestion.perGold) best = { provinceId: p.id, suggestion: s }
  }
  return best
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
function lerpHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  return '#' + ca.map((v, i) => Math.round(v + (cb[i] - v) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, '0')).join('')
}

const CAPS: Record<Exclude<MapMode, 'realm' | 'unrest'>, number> = { food: 6, wood: 4, iron: 4, gold: 5 }

/** Tile colour and label for a map mode; null means "use the normal political colouring". */
export function mapModeTile(state: GameState, p: Province, mode: MapMode): { color: string; label: string } | null {
  if (mode === 'realm') return null
  if (mode === 'unrest') {
    if (p.ownerId === null) return { color: '#3a3f4a', label: '' }
    const t = p.unrest / 100
    return { color: t < 0.5 ? lerpHex('#2e9e5b', '#e0b341', t * 2) : lerpHex('#e0b341', '#d63a3a', (t - 0.5) * 2), label: String(Math.round(p.unrest)) }
  }
  const per1k = yieldPer1k(state, p)
  const v = per1k[mode]
  if (mode === 'gold' && p.ownerId === null) return { color: '#2a2f3a', label: '' }
  const modeColor = MAP_MODES.find((m) => m.key === mode)!.color
  return { color: lerpHex('#22262f', modeColor, Math.pow(v / CAPS[mode], 0.8)), label: v.toFixed(1) }
}
