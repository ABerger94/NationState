import type { BuildingKey, GameState, Nation, Province, TechKey, UnitKey } from './types'
import { BUILDINGS, PERSONALITIES, TECHS, TECH_ORDER, UNITS } from './data'
import { armyPower, armySize, bordersNation, hasTech, hexDistance, log, nationArmy, ownedProvinces, totalPopulation } from './helpers'
import { buildingCost, canAfford, nationBudget, pay, transferCost, unitCost } from './economy'
import { aiAcceptsAlliance, aiAcceptsPeace, atWar, declareWar, formAlliance, makePeace } from './diplomacy'
import { attackPower, defensePower, performAttack } from './military'
import { nextRand, pick, shuffle } from './rng'

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

/** Remove `keep` units from a force so a garrison always stays behind, cheapest units first. */
function leaveHomeGuard(force: { [K in UnitKey]: number }, keep: number) {
  const order: UnitKey[] = ['militia', 'archers', 'infantry', 'cavalry', 'siege']
  let left = keep
  for (const k of order) {
    while (left > 0 && force[k] > 0) { force[k] -= 1; left -= 1 }
  }
  return force
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

function aiRedeploy(state: GameState, n: Nation) {
  const provs = ownedProvinces(state, n.id)
  const border = borderProvinces(state, n)
  if (!border.length) return
  const interior = provs.filter((p) => !border.includes(p) && p.lockedTurn !== state.turn && armySize(p.garrison) > 1)
  for (const p of interior) {
    const dest = border.reduce((b, q) => (threatAt(state, n, q) - armyPower(q.garrison) > threatAt(state, n, b) - armyPower(b.garrison) ? q : b))
    const moving = leaveHomeGuard({ ...p.garrison }, 1)
    const units = armySize(moving)
    if (units === 0) continue
    const cost = transferCost(n, p, dest, units, hexDistance(p, dest))
    if (n.resources.gold < cost) continue
    n.resources.gold -= cost
    for (const k of Object.keys(moving) as UnitKey[]) {
      p.garrison[k] -= moving[k]
      dest.garrison[k] += moving[k]
    }
  }
}

function aiAttack(state: GameState, n: Nation) {
  const pers = PERSONALITIES[n.personality]
  let attacks = 0
  const maxAttacks = n.personality === 'aggressive' ? 3 : 2
  const sources = shuffle(state, borderProvinces(state, n))
  for (const from of sources) {
    if (attacks >= maxAttacks) break
    if (from.lockedTurn === state.turn) continue
    const force = leaveHomeGuard({ ...from.garrison }, from.isCapital ? 2 : 1)
    if (armySize(force) < 2) continue
    const targets = from.neighbors.map((i) => state.provinces[i]).filter((t) =>
      t.ownerId !== n.id && (t.ownerId === null || atWar(n, state.nations[t.ownerId])),
    )
    let best: { p: Province; ratio: number } | null = null
    for (const t of targets) {
      const owner = t.ownerId === null ? null : state.nations[t.ownerId]
      const mine = attackPower(force, n, t.terrain, 2, state)
      const theirs = defensePower(t.garrison, owner, t, force.siege)
      const ratio = theirs <= 0 ? 99 : mine / theirs
      const needed = t.ownerId === null ? Math.max(1.2, pers.attackRatio - 0.3) : pers.attackRatio
      if (ratio >= needed && (!best || ratio > best.ratio)) best = { p: t, ratio }
    }
    if (best) {
      performAttack(state, n.id, from.id, best.p.id, force)
      attacks++
    }
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
  aiRedeploy(state, n)
  aiAttack(state, n)
  if (!hasTech(n, 'agriculture') && n.research === null) n.research = 'agriculture'
}
