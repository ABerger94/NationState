import type { GameState, Nation, Province } from './types'
import { TERRAINS } from './data'
import { armySize, clamp, hasTech } from './helpers'
import { stabilityFactor } from './economy'

export function provinceCapacity(p: Province, owner: Nation | null): number {
  const t = TERRAINS[p.terrain]
  let m = 1 + 0.25 * p.buildings.farm + 0.3 * p.buildings.granary
  if (hasTech(owner, 'agriculture')) m += 0.15
  return Math.round(t.capacity * m)
}

export interface GrowthContext { stability: number; foodRatio: number; starving: number }

export function growProvince(p: Province, owner: Nation | null, ctx: GrowthContext): void {
  const cap = provinceCapacity(p, owner)
  let rate = 0.025 * stabilityFactor(ctx.stability) * clamp(ctx.foodRatio, 0.6, 1.4)
  if (hasTech(owner, 'medicine')) rate *= 1.3
  rate -= p.devastation * 0.02
  if (p.unrest > 60) rate -= 0.01
  if (ctx.starving > 0) rate -= 0.05 * ctx.starving * (p.buildings.granary > 0 ? 0.5 : 1)
  let delta: number
  if (rate < 0) delta = p.population * rate
  else delta = p.population * rate * (1 - p.population / cap)
  p.population = Math.max(300, Math.round(p.population + delta))
}

export function growTribal(p: Province): void {
  const cap = provinceCapacity(p, null) * 0.5
  const delta = p.population * 0.012 * (1 - p.population / cap)
  p.population = Math.max(300, Math.round(p.population + delta))
  p.devastation = Math.max(0, p.devastation - 0.05)
  p.unrest = Math.max(0, p.unrest - 2)
  const want = Math.max(1, Math.round(p.population / 1200))
  if (armySize(p.garrison) < want) p.garrison.militia += 1
}

export function updateUnrest(state: GameState, p: Province, owner: Nation, starving: number): void {
  let d = (owner.taxRate - 20) / 4 - 2 + p.devastation * 5 - p.buildings.temple * 3
  if (hasTech(owner, 'philosophy')) d -= 1
  if (starving > 0) d += 8 * starving
  if (p.conqueredTurn !== null && state.turn - p.conqueredTurn < 10) d += 3
  if (armySize(p.garrison) * 2000 >= p.population) d -= 1
  p.unrest = clamp(p.unrest + d, 0, 100)
  p.devastation = Math.max(0, p.devastation - 0.05)
}
