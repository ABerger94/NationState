import type { BuildingKey, GameState, Nation, Province, Resources, UnitKey } from './types'
import { BUILDINGS, DIFFICULTIES, TERRAINS, UNIT_ORDER, UNITS } from './data'
import { armySize, clamp, emptyResources, hasTech, ownedProvinces, totalPopulation } from './helpers'

export interface ProvinceOutput { food: number; wood: number; iron: number; gold: number; science: number }

export interface Budget {
  income: Resources
  upkeep: Resources
  net: Resources
  science: number
  foodCap: number
  unitGold: number
  unitFood: number
  buildingGold: number
  foodConsumption: number
  stability: number
}

export function stabilityFactor(stability: number): number {
  return 0.5 + stability / 200
}

/** Stability is derived from unrest, war weariness, taxation and institutions. 0-100. */
export function computeStability(state: GameState, n: Nation): number {
  const provs = ownedProvinces(state, n.id)
  if (provs.length === 0) return 0
  const pop = provs.reduce((s, p) => s + p.population, 0)
  const avgUnrest = provs.reduce((s, p) => s + p.unrest * p.population, 0) / Math.max(1, pop)
  const temples = provs.reduce((s, p) => s + p.buildings.temple, 0)
  let v = 85 - avgUnrest * 0.6 - n.warWeariness * 0.5 - (n.taxRate - 20) * 0.5 + Math.min(10, temples * 2)
  if (hasTech(n, 'philosophy')) v += 5
  return clamp(Math.round(v), 0, 100)
}

export function provinceOutput(state: GameState, p: Province, stability?: number): ProvinceOutput {
  const owner = p.ownerId === null ? null : state.nations[p.ownerId]
  const t = TERRAINS[p.terrain]
  const w = p.population / 1000
  const dev = 1 - p.devastation * 0.6
  const food = w * t.food * (1 + 0.3 * p.buildings.farm) * (hasTech(owner, 'agriculture') ? 1.2 : 1) * dev
  const wood = w * t.wood * (1 + 0.4 * p.buildings.lumberMill) * dev
  const iron = w * t.iron * (1 + 0.4 * p.buildings.mine) * dev
  let gold = 0
  let science = 0
  if (owner) {
    const stab = stabilityFactor(stability ?? computeStability(state, owner))
    const taxes = w * 2.0 * (owner.taxRate / 20) * (1 + 0.25 * p.buildings.market)
      * (hasTech(owner, 'currency') ? 1.2 : 1) * (hasTech(owner, 'banking') ? 1.3 : 1)
    gold = (taxes + w * t.gold) * stab * dev
    science = p.buildings.university * 3
  }
  return { food, wood, iron, gold, science }
}

export function nationBudget(state: GameState, n: Nation): Budget {
  const provs = ownedProvinces(state, n.id)
  const stability = computeStability(state, n)
  const income = emptyResources()
  const upkeep = emptyResources()
  let science = provs.length ? 1 + Math.floor(totalPopulation(state, n.id) / 25000) : 0
  let unitGold = 0
  let unitFood = 0
  let buildingGold = 0
  let granaries = 0
  const logisticsMult = hasTech(n, 'logistics') ? 0.8 : 1

  for (const p of provs) {
    const out = provinceOutput(state, p, stability)
    income.food += out.food
    income.wood += out.wood
    income.iron += out.iron
    income.gold += out.gold
    science += out.science
    for (const k of UNIT_ORDER) {
      unitGold += p.garrison[k] * UNITS[k].upkeepGold * logisticsMult
      unitFood += p.garrison[k] * UNITS[k].upkeepFood
    }
    let levels = 0
    for (const b of Object.keys(p.buildings) as BuildingKey[]) levels += p.buildings[b]
    buildingGold += levels * 0.5
    granaries += p.buildings.granary
  }
  if (!n.isPlayer) income.gold *= DIFFICULTIES[state.difficulty].aiIncome
  const foodConsumption = totalPopulation(state, n.id) / 1000
  upkeep.gold = unitGold + buildingGold
  upkeep.food = foodConsumption + unitFood
  const net: Resources = {
    gold: income.gold - upkeep.gold,
    food: income.food - upkeep.food,
    wood: income.wood - upkeep.wood,
    iron: income.iron - upkeep.iron,
  }
  return {
    income, upkeep, net, science, foodCap: 500 + 300 * granaries,
    unitGold, unitFood, buildingGold, foodConsumption, stability,
  }
}

export function buildingCost(n: Nation, key: BuildingKey): Resources {
  const base = BUILDINGS[key].cost
  const m = hasTech(n, 'engineering') ? 0.85 : 1
  return { gold: Math.ceil(base.gold * m), food: 0, wood: Math.ceil(base.wood * m), iron: Math.ceil(base.iron * m) }
}

export function unitCost(key: UnitKey, count = 1): Resources {
  const c = UNITS[key].cost
  return { gold: c.gold * count, food: 0, wood: c.wood * count, iron: c.iron * count }
}

export function canAfford(r: Resources, cost: Resources): boolean {
  return r.gold >= cost.gold && r.food >= cost.food && r.wood >= cost.wood && r.iron >= cost.iron
}

export function pay(n: Nation, cost: Resources): void {
  n.resources.gold -= cost.gold
  n.resources.food -= cost.food
  n.resources.wood -= cost.wood
  n.resources.iron -= cost.iron
}

export function missingResources(r: Resources, cost: Resources): string {
  const parts: string[] = []
  if (r.gold < cost.gold) parts.push(`${Math.ceil(cost.gold - r.gold)} gold`)
  if (r.wood < cost.wood) parts.push(`${Math.ceil(cost.wood - r.wood)} wood`)
  if (r.iron < cost.iron) parts.push(`${Math.ceil(cost.iron - r.iron)} iron`)
  return parts.join(', ')
}

export function canBuild(state: GameState, n: Nation, p: Province, key: BuildingKey): { ok: boolean; reason: string } {
  if (p.ownerId !== n.id) return { ok: false, reason: 'Not your province' }
  if (p.buildings[key] >= BUILDINGS[key].max) return { ok: false, reason: 'Maximum level reached' }
  const cost = buildingCost(n, key)
  if (!canAfford(n.resources, cost)) return { ok: false, reason: `Need ${missingResources(n.resources, cost)}` }
  void state
  return { ok: true, reason: '' }
}

export function canRecruit(state: GameState, n: Nation, p: Province, key: UnitKey, count: number): { ok: boolean; reason: string } {
  if (p.ownerId !== n.id) return { ok: false, reason: 'Not your province' }
  if (count < 1) return { ok: false, reason: 'Choose how many' }
  if (UNITS[key].requiresBarracks && p.buildings.barracks < 1) return { ok: false, reason: 'Needs a barracks' }
  const men = UNITS[key].men * count
  if (p.population - men < 500) return { ok: false, reason: 'Not enough people to levy' }
  const cost = unitCost(key, count)
  if (!canAfford(n.resources, cost)) return { ok: false, reason: `Need ${missingResources(n.resources, cost)}` }
  void state
  return { ok: true, reason: '' }
}

export function transferCost(n: Nation, from: Province, to: Province, units: number, distance: number): number {
  const perUnit = hasTech(n, 'logistics') ? 0.5 : 1
  void from
  void to
  return Math.ceil(units * distance * perUnit)
}

export function nationScore(state: GameState, n: Nation): number {
  if (!n.alive) return 0
  const provs = ownedProvinces(state, n.id)
  const pop = provs.reduce((s, p) => s + p.population, 0)
  const units = provs.reduce((s, p) => s + armySize(p.garrison), 0)
  return Math.round(pop / 1000 + provs.length * 10 + units * 2 + n.techs.length * 8 + n.resources.gold / 50)
}
