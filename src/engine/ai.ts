import type { BuildingKey, GameState, Nation, Province, TechKey, UnitKey } from './types'
import { BUILDINGS, MAX_ARMY_UNITS, PERSONALITIES, TECHS, TECH_ORDER, UNITS } from './data'
import { armyPower, armySize, bordersNation, hasTech, hexDistance, log, nationArmy, ownedProvinces, totalPopulation } from './helpers'
import { armiesOf, canBesiege, defendersAt, disbandIntoGarrison, mergeArmies, moveArmy, raiseArmy, reachable, siegeRequired, startSiege, supplyLimit, unitsQuartered, wallsBreached } from './armies'
import { buildingCost, canAfford, nationBudget, pay, unitCost } from './economy'
import { aiAcceptsAlliance, aiAcceptsPeace, atWar, declareWar, formAlliance, makePeace } from './diplomacy'
import { attackPower, canArmyAttack, defensePower, performArmyAttack } from './military'
import type { FieldArmy } from './types'
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

function provinceWorth(p: Province): number {
  return p.population / 4000 + (p.resource ? 2 : 0) + (p.isCapital ? 4 : 0) + (p.ownerId === null ? 1 : 2) + p.buildings.walls
}

/** Would this host rather starve a fortress out than storm it? `ratio` is the massed odds. */
function prefersSiege(state: GameState, army: FieldArmy, p: Province, ratio: number): boolean {
  if (p.buildings.walls <= 0) return false
  if (!canBesiege(state, army, p.id).ok) return false
  if (ratio >= 2.2) return false
  return siegeRequired(p, army.units) <= 8
}

function aiRaiseArmies(state: GameState, n: Nation) {
  const pers = PERSONALITIES[n.personality]
  const wantOffence = n.wars.length > 0 || state.provinces.some((p) => p.ownerId === null && p.neighbors.some((i) => state.provinces[i].ownerId === n.id))
  if (!wantOffence) return
  const maxArmies = (n.personality === 'aggressive' ? 4 : 3) + Math.floor(ownedProvinces(state, n.id).length / 5)
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

/** Hostile strength that could fall on this province next turn. */
function threatTo(state: GameState, n: Nation, p: Province): number {
  let threat = 0
  for (const a of state.armies) {
    if (a.ownerId === n.id) continue
    if (!atWar(n, state.nations[a.ownerId]) && state.provinces[a.provinceId].ownerId !== null) continue
    if (a.siege?.provinceId === p.id) threat += armyPower(a.units) * 2
    else if (state.provinces[a.provinceId].neighbors.includes(p.id)) threat += armyPower(a.units)
  }
  for (const i of p.neighbors) {
    const q = state.provinces[i]
    if (q.ownerId === n.id || q.ownerId === null) continue
    if (atWar(n, state.nations[q.ownerId])) threat += armyPower(q.garrison) * 0.4
  }
  return threat
}

interface Objective { kind: 'capture' | 'defend'; province: Province; priority: number; needed: number }

/** Everything worth marching to this turn, most valuable first. */
function campaignObjectives(state: GameState, n: Nation): Objective[] {
  const out: Objective[] = []
  for (const p of ownedProvinces(state, n.id)) {
    const threat = threatTo(state, n, p)
    if (threat <= 0) continue
    const held = defensePower(defendersAt(state, p.id).units, n, p, 0)
    if (held >= threat * 1.4) continue
    out.push({ kind: 'defend', province: p, priority: threat / 10 + provinceWorth(p) + (p.isCapital ? 8 : 0), needed: threat })
  }
  for (const p of targetProvinces(state, n)) {
    const owner = p.ownerId === null ? null : state.nations[p.ownerId]
    const defence = defensePower(defendersAt(state, p.id).units, owner, p, 0)
    out.push({ kind: 'capture', province: p, priority: provinceWorth(p), needed: defence * 1.4 })
  }
  return out.sort((a, b) => b.priority - a.priority)
}

/** Gives every army a standing order, letting several converge on one hard target. */
function assignOrders(state: GameState, n: Nation) {
  const objectives = campaignObjectives(state, n)
  const armies = armiesOf(state, n.id).sort((a, b) => armyPower(b.units) - armyPower(a.units))
  const committed = new Map<number, number>()

  for (const army of armies) {
    // An army already investing a fortress keeps at it.
    if (army.siege) {
      army.order = { kind: 'capture', provinceId: army.siege.provinceId }
      committed.set(army.siege.provinceId, (committed.get(army.siege.provinceId) ?? 0) + armyPower(army.units))
      continue
    }
    const from = state.provinces[army.provinceId]
    let best: { obj: Objective; score: number } | null = null
    for (const obj of objectives) {
      const already = committed.get(obj.province.id) ?? 0
      // Do not pile more force onto a target that is already covered.
      if (already > obj.needed * 1.6) continue
      const dist = hexDistance(from, obj.province)
      const urgency = obj.kind === 'defend' ? 2.5 : 1
      const score = obj.priority * urgency - dist * 1.2
      if (!best || score > best.score) best = { obj, score }
    }
    if (!best) { army.order = null; continue }
    army.order = { kind: best.obj.kind, provinceId: best.obj.province.id }
    committed.set(best.obj.province.id, (committed.get(best.obj.province.id) ?? 0) + armyPower(army.units))
  }
}

/** Combined strength of every army of this nation poised to strike a province. */
function stagedStrength(state: GameState, n: Nation, targetId: number): number {
  return armiesOf(state, n.id)
    .filter((a) => state.provinces[a.provinceId].neighbors.includes(targetId) && canArmyAttack(state, a, targetId).ok)
    .reduce((s, a) => s + attackPower(a.units, n, state.provinces[targetId].terrain, 2, state), 0)
}

/** Folds together co-located armies under the same order, so force concentrates. */
function consolidate(state: GameState, n: Nation) {
  const armies = armiesOf(state, n.id)
  for (const a of armies) {
    if (a.siege) continue
    const partner = armiesOf(state, n.id).find((b) =>
      b.id !== a.id && !b.siege && b.provinceId === a.provinceId
      && b.order?.provinceId === a.order?.provinceId
      && armySize(a.units) + armySize(b.units) <= MAX_ARMY_UNITS,
    )
    if (partner) mergeArmies(state, a.id, partner.id)
  }
}

function marchToward(state: GameState, n: Nation, army: FieldArmy, goal: Province): void {
  const options = reachable(state, army)
  const here = hexDistance(state.provinces[army.provinceId], goal)
  let step: { id: number; dist: number } | null = null
  for (const id of options.keys()) {
    // Do not march into a province that cannot feed the troops already there.
    if (unitsQuartered(state, id, n.id) + armySize(army.units) > supplyLimit(state.provinces[id])) continue
    const dist = hexDistance(state.provinces[id], goal)
    if (dist < here && (!step || dist < step.dist)) step = { id, dist }
  }
  if (step) moveArmy(state, army.id, step.id)
}

function aiCommandArmies(state: GameState, n: Nation) {
  const pers = PERSONALITIES[n.personality]
  assignOrders(state, n)
  consolidate(state, n)

  for (const army of armiesOf(state, n.id)) {
    // A siege already under way is worth finishing: storm it the moment the breach is wide enough.
    if (army.siege) {
      const besieged = state.provinces[army.siege.provinceId]
      const breach = wallsBreached(army, besieged)
      const combined = stagedStrength(state, n, besieged.id)
      const owner = besieged.ownerId === null ? null : state.nations[besieged.ownerId]
      const holding = defensePower(defendersAt(state, besieged.id).units, owner, besieged, army.units.siege, breach)
      if (canArmyAttack(state, army, besieged.id).ok && (holding <= 0 || combined / holding >= 2.2)) {
        performArmyAttack(state, army.id, besieged.id)
      } else {
        army.movement = 0
      }
      continue
    }

    const order = army.order
    if (!order) {
      if (n.wars.length === 0 && state.provinces[army.provinceId].ownerId === n.id) disbandIntoGarrison(state, army.id)
      continue
    }
    const goal = state.provinces[order.provinceId]

    if (order.kind === 'defend') {
      // Stand in the threatened province, or strike the besiegers if we can reach them.
      const besieger = state.armies.find((a) => a.siege?.provinceId === goal.id && a.ownerId !== n.id)
      const besiegerTile = besieger ? state.provinces[besieger.provinceId] : null
      if (besiegerTile && canArmyAttack(state, army, besiegerTile.id).ok
        && stagedStrength(state, n, besiegerTile.id) >= defensePower(defendersAt(state, besiegerTile.id).units, state.nations[besiegerTile.ownerId ?? n.id], besiegerTile, 0) * 1.3) {
        performArmyAttack(state, army.id, besiegerTile.id)
      } else if (army.provinceId !== goal.id) {
        marchToward(state, n, army, goal)
      } else {
        army.movement = 0
      }
      continue
    }

    // Capture: invest walls we cannot cheaply storm, strike when the massed force is enough, else close in.
    if (canArmyAttack(state, army, goal.id).ok) {
      const owner = goal.ownerId === null ? null : state.nations[goal.ownerId]
      const holding = defensePower(defendersAt(state, goal.id).units, owner, goal, army.units.siege)
      const combined = stagedStrength(state, n, goal.id)
      const ratio = holding <= 0 ? 99 : combined / holding
      if (prefersSiege(state, army, goal, ratio)) {
        startSiege(state, army.id, goal.id)
        continue
      }
      if (ratio >= 1.35 && nextRand(state) < 0.55 + pers.aggression * 0.45) {
        performArmyAttack(state, army.id, goal.id)
        continue
      }
      // Not strong enough yet: hold the line and wait for the rest of the host.
      army.movement = 0
      continue
    }
    // A fortress at our feet is worth investing rather than walking past.
    const fortress = state.provinces[army.provinceId].neighbors
      .map((i) => state.provinces[i])
      .filter((p) => canBesiege(state, army, p.id).ok && siegeRequired(p, army.units) <= 8)
      .sort((x, y) => provinceWorth(y) - provinceWorth(x))[0]
    if (fortress) {
      startSiege(state, army.id, fortress.id)
      continue
    }
    marchToward(state, n, army, goal)
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
