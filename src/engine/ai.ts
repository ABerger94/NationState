import type { BuildingKey, GameState, Nation, Province, TechKey, UnitKey } from './types'
import { BUILDINGS, PERSONALITIES, TECHS, TECH_ORDER, UNITS } from './data'
import { armyPower, armySize, bordersNation, emptyArmy, hasTech, hexDistance, log, nationArmy, ownedProvinces, totalPopulation } from './helpers'
import { armiesOf, defendersAt, disbandIntoGarrison, moveArmy, raiseArmy, reachable } from './armies'
import { buildingCost, canAfford, nationBudget, pay, unitCost } from './economy'
import { aiAcceptsAlliance, aiAcceptsPeace, atWar, declareWar, formAlliance, makePeace } from './diplomacy'
import { attackPower, canArmyAttack, defensePower, performArmyAttack } from './military'
import { nextRand, pick } from './rng'

export function availableTechs(n: Nation): TechKey[] {
  return TECH_ORDER.filter((t) => !n.techs.includes(t) && (!TECHS[t].requires || n.techs.includes(TECHS[t].requires!)))
}

function chooseResearch(n: Nation) {
  if (n.research) return
  const avail = availableTechs(n)
  if (!avail.length) return
  const pref = n.personality === 'aggressive' || n.personality === 'defensive'
  const sorted = avail.slice().sort((a, b) => {
    const ma = TECHS[a].military === pref ? 0 : 1
    const mb = TECHS[b].military === pref ? 0 : 1
    return ma - mb || TECHS[a].cost - TECHS[b].cost
  })
  n.research = sorted[0]
}

function borderProvinces(state: GameState, n: Nation): Province[] {
  return ownedProvinces(state, n.id).filter((p) => p.neighbors.some((i) => state.provinces[i].ownerId !== n.id))
}

function threatAt(state: GameState, n: Nation, p: Province): number {
  let threat = 0
  for (const i of p.neighbors) {
    const q = state.provinces[i]
    if (q.ownerId === n.id) continue
    const hostile = q.ownerId === null ? 0.3 : atWar(n, state.nations[q.ownerId]) ? 1.5 : 0.6
    threat += armyPower(q.garrison) * hostile
  }
  return threat
}

function aiBuild(state: GameState, n: Nation) {
  const pers = PERSONALITIES[n.personality]
  const provs = ownedProvinces(state, n.id)
  if (!provs.length) return
  for (let attempt = 0; attempt < 3; attempt++) {
    const budget = nationBudget(state, n)
    let want: BuildingKey[] = []
    if (budget.net.food < 2) want.push('farm')
    if (budget.income.iron < 3) want.push('mine')
    if (budget.income.wood < 4) want.push('lumberMill')
    if (n.resources.food > budget.foodCap * 0.9) want.push('granary')
    if (budget.stability < 50) want.push('temple')
    want = want.concat(pers.buildPriority)
    let built = false
    for (const key of want) {
      const cost = buildingCost(n, key)
      if (n.resources.gold - cost.gold < pers.reserve || !canAfford(n.resources, cost)) continue
      const candidates = provs.filter((p) => p.buildings[key] < BUILDINGS[key].max)
      if (!candidates.length) continue
      let target: Province
      if (key === 'walls' || key === 'barracks') {
        const border = candidates.filter((p) => p.neighbors.some((i) => state.provinces[i].ownerId !== n.id))
        target = (border.length ? border : candidates).reduce((b, p) => (p.population > b.population ? p : b))
      } else if (key === 'farm' || key === 'granary') {
        target = candidates.reduce((b, p) => (p.population > b.population ? p : b))
      } else {
        target = pick(state, candidates)
      }
      pay(n, cost)
      target.buildings[key] += 1
      built = true
      break
    }
    if (!built) break
  }
}

function aiRecruit(state: GameState, n: Nation) {
  const pers = PERSONALITIES[n.personality]
  const provs = ownedProvinces(state, n.id)
  if (!provs.length) return
  const army = nationArmy(state, n.id)
  const atWarNow = n.wars.length > 0
  const rich = n.resources.gold > 800 ? 1.6 : 1
  const desired = (totalPopulation(state, n.id) / 1000) * pers.armyRatio * (atWarNow ? 1.4 : 1) * rich
  let size = armySize(army)
  const budget = nationBudget(state, n)
  let guard = 0
  while (size < desired && guard++ < 12) {
    const border = provs.filter((p) => p.buildings.barracks > 0).sort((a, b) => threatAt(state, n, b) - threatAt(state, n, a))
    const site = border[0] ?? provs.reduce((b, p) => (p.population > b.population ? p : b))
    let unit: UnitKey = 'militia'
    if (site.buildings.barracks > 0) {
      const r = nextRand(state)
      const enemyWalls = n.wars.some((w) => ownedProvinces(state, w).some((p) => p.buildings.walls > 0))
      if (enemyWalls && army.siege < 2 && r < 0.2) unit = 'siege'
      else if (r < 0.55) unit = 'infantry'
      else if (r < 0.8) unit = 'archers'
      else unit = 'cavalry'
    }
    const cost = unitCost(unit, 1, n, state)
    const minReserve = atWarNow ? pers.reserve * 0.5 : pers.reserve
    if (!canAfford(n.resources, cost) || n.resources.gold - cost.gold < minReserve) break
    if (budget.net.gold - UNITS[unit].upkeepGold < -2) break
    if (site.population - UNITS[unit].men < 1000) break
    pay(n, cost)
    site.population -= UNITS[unit].men
    site.garrison[unit] += 1
    size += 1
  }
}

function aiDiplomacy(state: GameState, n: Nation) {
  const pers = PERSONALITIES[n.personality]
  for (const enemyId of n.wars.slice()) {
    const enemy = state.nations[enemyId]
    if (!enemy.alive) continue
    if (!aiAcceptsPeace(state, n, enemy)) continue
    if (nextRand(state) > 0.5) continue
    if (enemy.isPlayer) {
      if (!enemy.peaceOffersFrom.includes(n.id)) {
        enemy.peaceOffersFrom.push(n.id)
        log(state, 'diplomacy', `${n.name} sends envoys seeking peace. Review the offer in Diplomacy.`)
      }
    } else if (aiAcceptsPeace(state, enemy, n)) {
      makePeace(state, n.id, enemyId)
    }
  }
  const maxWars = n.personality === 'aggressive' ? 2 : 1
  const landLocked = !borderProvinces(state, n).some((p) => p.neighbors.some((i) => state.provinces[i].ownerId === null))
  const myPower = armyPower(nationArmy(state, n.id))
  const easyPrey = state.nations.some((o) => o.alive && o.id !== n.id && !atWar(n, o) && !n.allies.includes(o.id)
    && bordersNation(state, n.id, o.id) && myPower > armyPower(nationArmy(state, o.id)) * 2.5)
  const player = state.nations.find((o) => o.isPlayer)!
  const richWeakPlayer = player.alive && !atWar(n, player) && bordersNation(state, n.id, player.id)
    && player.resources.gold > 400 && myPower > armyPower(nationArmy(state, player.id)) * 1.8
  const warChance = pers.aggression * 0.08 * (landLocked ? 2 : 1) * (easyPrey ? 2 : 1) * (richWeakPlayer ? 1.5 : 1) * (state.difficulty === 'hard' ? 1.3 : state.difficulty === 'easy' ? 0.6 : 1)
  if (n.wars.length < maxWars && n.warWeariness < 20 && nextRand(state) < warChance) {
    const needed = n.personality === 'aggressive' ? 1.15 : 1.3
    const targets = state.nations.filter((o) =>
      o.alive && o.id !== n.id && !atWar(n, o) && !n.allies.includes(o.id)
      && bordersNation(state, n.id, o.id) && (n.relations[o.id] ?? 0) < 25
      && myPower > armyPower(nationArmy(state, o.id)) * needed,
    )
    if (targets.length) {
      const weakest = targets.reduce((b, o) => (armyPower(nationArmy(state, o.id)) < armyPower(nationArmy(state, b.id)) ? o : b))
      declareWar(state, n.id, weakest.id)
    }
  }
  if (n.allies.length < 2 && nextRand(state) < 0.08) {
    const friends = state.nations.filter((o) => o.alive && !o.isPlayer && o.id !== n.id && !n.allies.includes(o.id) && (n.relations[o.id] ?? 0) >= 60)
    for (const f of friends) {
      if (aiAcceptsAlliance(state, f, n) && aiAcceptsAlliance(state, n, f)) {
        formAlliance(state, n.id, f.id)
        break
      }
    }
  }
}

/** Troops a province should keep at home no matter what. */
function homeGuard(state: GameState, n: Nation, p: Province): number {
  if (p.isCapital) return 3
  const frontier = p.neighbors.some((i) => state.provinces[i].ownerId !== n.id)
  return frontier ? 2 : 1
}

/** Provinces this nation may attack: independent land, or land of a nation it is at war with. */
function targetProvinces(state: GameState, n: Nation): Province[] {
  return state.provinces.filter((p) => {
    if (p.ownerId === n.id) return false
    if (p.ownerId !== null && !atWar(n, state.nations[p.ownerId])) return false
    return p.neighbors.some((i) => state.provinces[i].ownerId === n.id)
      || armiesOf(state, n.id).some((a) => state.provinces[a.provinceId].neighbors.includes(p.id))
  })
}

/** How badly this nation wants a province, weighing its defence against its worth. */
function targetScore(state: GameState, n: Nation, p: Province, force: ReturnType<typeof emptyArmy>): number {
  const owner = p.ownerId === null ? null : state.nations[p.ownerId]
  const mine = attackPower(force, n, p.terrain, 2, state)
  const theirs = defensePower(defendersAt(state, p.id).units, owner, p, force.siege)
  const ratio = theirs <= 0 ? 99 : mine / theirs
  if (ratio < 1.25) return -1
  const worth = p.population / 4000 + (p.resource ? 2 : 0) + (p.isCapital ? 4 : 0) + (p.ownerId === null ? 1 : 2)
  return worth + Math.min(6, ratio)
}

function aiRaiseArmies(state: GameState, n: Nation) {
  const pers = PERSONALITIES[n.personality]
  const wantOffence = n.wars.length > 0 || state.provinces.some((p) => p.ownerId === null && p.neighbors.some((i) => state.provinces[i].ownerId === n.id))
  if (!wantOffence) return
  const maxArmies = n.personality === 'aggressive' ? 4 : 3
  for (const p of ownedProvinces(state, n.id)) {
    if (armiesOf(state, n.id).length >= maxArmies) break
    const guard = homeGuard(state, n, p)
    const spare = { ...p.garrison }
    let left = guard
    for (const k of ['militia', 'archers', 'infantry', 'cavalry', 'siege'] as UnitKey[]) {
      while (left > 0 && spare[k] > 0) { spare[k] -= 1; left -= 1 }
    }
    const size = armySize(spare)
    if (size < 3) continue
    if (nextRand(state) > pers.aggression + 0.35) continue
    raiseArmy(state, n.id, p.id, spare)
  }
}

function aiCommandArmies(state: GameState, n: Nation) {
  const pers = PERSONALITIES[n.personality]
  for (const army of armiesOf(state, n.id)) {
    const targets = targetProvinces(state, n)
    if (!targets.length) {
      if (n.wars.length === 0 && state.provinces[army.provinceId].ownerId === n.id) disbandIntoGarrison(state, army.id)
      continue
    }
    // Attack anything adjacent that is worth taking.
    const adjacent = state.provinces[army.provinceId].neighbors
      .map((i) => state.provinces[i])
      .filter((p) => targets.includes(p) && canArmyAttack(state, army, p.id).ok)
    let best: { p: Province; score: number } | null = null
    for (const p of adjacent) {
      const score = targetScore(state, n, p, army.units)
      if (score > 0 && (!best || score > best.score)) best = { p, score }
    }
    if (best && nextRand(state) < 0.5 + pers.aggression * 0.5) {
      performArmyAttack(state, army.id, best.p.id)
      continue
    }
    // Otherwise march toward the most attractive target we can still reach.
    const goal = targets
      .map((p) => ({ p, score: targetScore(state, n, p, army.units) - hexDistance(state.provinces[army.provinceId], p) * 0.5 }))
      .sort((a, b) => b.score - a.score)[0]
    if (!goal) continue
    const options = reachable(state, army)
    let step: { id: number; dist: number } | null = null
    const here = hexDistance(state.provinces[army.provinceId], goal.p)
    for (const id of options.keys()) {
      const dist = hexDistance(state.provinces[id], goal.p)
      if (dist < here && (!step || dist < step.dist)) step = { id, dist }
    }
    if (step) moveArmy(state, army.id, step.id)
  }
}

const AI_POLICIES: Record<Nation['personality'], Nation['policies']> = {
  aggressive: { economy: 'mercantile', military: 'expansionist', society: 'scholarly', changedTurn: 0 },
  builder: { economy: 'agrarian', military: 'drilled', society: 'tolerant', changedTurn: 0 },
  merchant: { economy: 'mercantile', military: 'levies', society: 'scholarly', changedTurn: 0 },
  defensive: { economy: 'agrarian', military: 'drilled', society: 'devout', changedTurn: 0 },
}

export function runAI(state: GameState, n: Nation): void {
  if (!n.alive || n.isPlayer) return
  if (n.policies.economy === null) n.policies = { ...AI_POLICIES[n.personality], changedTurn: state.turn }
  chooseResearch(n)
  const budget = nationBudget(state, n)
  if (budget.stability < 40) n.taxRate = 15
  else if (n.resources.gold < 60 && budget.stability > 60) n.taxRate = 28
  else n.taxRate = 20
  aiBuild(state, n)
  aiRecruit(state, n)
  aiDiplomacy(state, n)
  aiRaiseArmies(state, n)
  aiCommandArmies(state, n)
  if (!hasTech(n, 'agriculture') && n.research === null) n.research = 'agriculture'
}
