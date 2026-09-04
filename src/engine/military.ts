import type { Army, BattleReport, FieldArmy, GameState, Nation, Province, Terrain } from './types'
import { TERRAINS, UNIT_ORDER, UNITS } from './data'
import { addArmy, armySize, clamp, emptyArmy, hasTech, log, nationHasResource, ownedProvinces } from './helpers'
import { computeStability } from './economy'
import { applyDefenderLosses, armyById, breakSiege, crossesRiver, defendersAt, moveCost, pruneArmies, removeArmy, retreatArmy, wallsBreached } from './armies'
import { nextRand, pick } from './rng'

export function attackPower(army: Army, n: Nation | null, terrain: Terrain, round: number, state?: GameState): number {
  const t = TERRAINS[terrain]
  const horses = !!(n && state && nationHasResource(state, n.id, 'horses'))
  let total = 0
  for (const k of UNIT_ORDER) {
    const c = army[k]
    if (!c) continue
    let a = UNITS[k].attack
    if (k === 'cavalry') {
      a *= t.cavalry
      if (hasTech(n, 'horsemanship')) a *= 1.2
      if (horses) a *= 1.1
    } else if (k === 'archers') {
      if (round === 1) a *= 1.6
      if (terrain === 'forest') a *= 1.15
    } else if (k === 'siege') {
      if (hasTech(n, 'engineering')) a *= 1.5
    }
    total += c * a
  }
  if (hasTech(n, 'ironWorking')) total *= 1.15
  if (hasTech(n, 'professionalArmy')) total *= 1.1
  if (n?.policies.military === 'levies') total *= 0.9
  else if (n?.policies.military === 'expansionist') total *= 1.1
  return total
}

export function defensePower(army: Army, n: Nation | null, p: Province, attackerSiege: number, breached = 0, acrossRiver = false): number {
  let total = 0
  for (const k of UNIT_ORDER) total += army[k] * UNITS[k].defense
  const t = TERRAINS[p.terrain]
  total *= t.defense
  const wallBonus = hasTech(n, 'masonry') ? 0.65 : 0.45
  const effWalls = Math.max(0, p.buildings.walls - attackerSiege * 0.5 - breached)
  total *= 1 + wallBonus * effWalls
  total *= 1 + 0.08 * p.buildings.barracks
  if (acrossRiver) total *= 1.25
  if (hasTech(n, 'tactics')) total *= 1.1
  if (hasTech(n, 'professionalArmy')) total *= 1.1
  if (n?.policies.military === 'drilled') total *= 1.1
  return total
}

function applyLosses(state: GameState, army: Army, frac: number): number {
  if (frac <= 0) return 0
  let total = 0
  for (const k of UNIT_ORDER) {
    const c = army[k]
    if (!c) continue
    const raw = c * frac
    let loss = Math.floor(raw)
    if (nextRand(state) < raw - loss) loss += 1
    loss = Math.min(c, loss)
    army[k] -= loss
    total += loss
  }
  if (total === 0 && frac > 0.05 && armySize(army) > 0) {
    const biggest = UNIT_ORDER.reduce((b, k) => (army[k] > army[b] ? k : b), UNIT_ORDER[0])
    army[biggest] -= 1
    total = 1
  }
  return total
}

export interface BattleArgs {
  attackerId: number | null
  defenderId: number | null
  attacker: Army
  defender: Army
  province: Province
  kind: 'battle' | 'rebellion'
  /** Wall levels already knocked down by a siege. */
  breached?: number
  /** The attackers had to force a river crossing. */
  acrossRiver?: boolean
}

export function resolveBattle(state: GameState, args: BattleArgs): BattleReport {
  const an = args.attackerId === null ? null : state.nations[args.attackerId]
  const dn = args.defenderId === null ? null : state.nations[args.defenderId]
  const atk: Army = { ...args.attacker }
  const def: Army = { ...args.defender }
  let aMorale = an ? 60 + computeStability(state, an) * 0.4 : 80
  let dMorale = dn ? 60 + computeStability(state, dn) * 0.4 : 80
  const rounds: BattleReport['rounds'] = []
  let winner: 'attacker' | 'defender' | null = armySize(def) === 0 ? 'attacker' : null
  if (armySize(atk) === 0) winner = 'defender'

  for (let r = 1; r <= 8 && winner === null; r++) {
    const A = attackPower(atk, an, args.province.terrain, r, state)
    const D = defensePower(def, dn, args.province, atk.siege, args.breached ?? 0, args.acrossRiver ?? false)
    if (A + D <= 0) break
    const aFrac = clamp((D / (A + D)) * 0.3 * (0.8 + 0.4 * nextRand(state)), 0, 0.9)
    const dFrac = clamp((A / (A + D)) * 0.3 * (0.8 + 0.4 * nextRand(state)), 0, 0.9)
    const aLoss = applyLosses(state, atk, aFrac)
    const dLoss = applyLosses(state, def, dFrac)
    aMorale -= aFrac * 130 + 3
    dMorale -= dFrac * 130 + (dFrac > aFrac ? 3 : 0)
    rounds.push({
      round: r, attackerPower: Math.round(A), defenderPower: Math.round(D),
      attackerLosses: aLoss, defenderLosses: dLoss,
      attackerMorale: Math.round(Math.max(0, aMorale)), defenderMorale: Math.round(Math.max(0, dMorale)),
    })
    if (armySize(def) === 0) winner = 'attacker'
    else if (armySize(atk) === 0) winner = 'defender'
    else if (dMorale < 30) winner = 'attacker'
    else if (aMorale < 30) winner = 'defender'
  }
  if (winner === null) winner = 'defender'

  const attackerName = an ? an.name : args.kind === 'rebellion' ? 'Rebels' : 'Tribal warbands'
  const defenderName = dn ? dn.name : 'Tribal warbands'
  return {
    id: state.nextId++, turn: state.turn, provinceId: args.province.id, provinceName: args.province.name,
    terrain: args.province.terrain, attackerId: args.attackerId, defenderId: args.defenderId,
    attackerName, defenderName, attackerStart: { ...args.attacker }, defenderStart: { ...args.defender },
    attackerEnd: atk, defenderEnd: def, rounds, winner, conquered: false, kind: args.kind,
    involvesPlayer: !!(an?.isPlayer || dn?.isPlayer),
  }
}

function recordBattle(state: GameState, report: BattleReport) {
  state.battles.push(report)
  if (state.battles.length > 40) state.battles.splice(0, state.battles.length - 40)
  if (report.involvesPlayer) state.lastTurnBattles.push(report.id)
}

/** Reassign a nation's capital after it loses the current one; returns false if the nation has no land left. */
export function relocateCapital(state: GameState, nationId: number): boolean {
  const n = state.nations[nationId]
  const provs = ownedProvinces(state, nationId)
  if (provs.length === 0) return false
  const best = provs.reduce((b, p) => (p.population > b.population ? p : b), provs[0])
  best.isCapital = true
  n.capitalId = best.id
  log(state, 'info', `${n.name} moves its capital to ${best.name}.`)
  return true
}

export function checkElimination(state: GameState, nationId: number): void {
  const n = state.nations[nationId]
  if (!n.alive) return
  if (ownedProvinces(state, nationId).length > 0) return
  n.alive = false
  for (const other of state.nations) {
    other.wars = other.wars.filter((w) => w !== nationId)
    other.allies = other.allies.filter((w) => w !== nationId)
    other.peaceOffersFrom = other.peaceOffersFrom.filter((w) => w !== nationId)
  }
  n.wars = []
  n.allies = []
  log(state, 'war', `${n.name} has been wiped from the map.`)
}

export function transferOwnership(state: GameState, p: Province, newOwner: number | null, garrison: Army): void {
  // Any surviving armies of the previous owner are pushed out with the province.
  for (const a of state.armies.filter((x) => x.provinceId === p.id && x.ownerId !== newOwner)) {
    const refuge = p.neighbors.map((i) => state.provinces[i]).find((q) => q.ownerId === a.ownerId)
    if (refuge) a.provinceId = refuge.id
    else removeArmy(state, a.id)
  }
  const prevOwner = p.ownerId
  p.ownerId = newOwner
  p.garrison = { ...garrison }
  p.conqueredTurn = state.turn
  p.lockedTurn = state.turn
  p.devastation = Math.min(1, p.devastation + 0.3)
  p.population = Math.max(300, Math.round(p.population * 0.93))
  p.unrest = prevOwner === null ? 35 : 60
  if (newOwner !== null) {
    const winner = state.nations[newOwner]
    winner.provincesGained += 1
    if (winner.policies.military === 'expansionist') p.unrest += 10
    if (prevOwner === null) winner.stats.tribalConquests += 1
    else winner.stats.nationConquests += 1
  }
  if (prevOwner !== null) {
    state.nations[prevOwner].provincesLost += 1
    if (p.isCapital) {
      p.isCapital = false
      const prev = state.nations[prevOwner]
      log(state, 'war', `The capital of ${prev.name}, ${p.name}, has fallen!`)
      if (newOwner !== null) {
        const loot = Math.round(prev.resources.gold * 0.5)
        prev.resources.gold -= loot
        state.nations[newOwner].resources.gold += loot
        if (loot > 0) log(state, 'economy', `${state.nations[newOwner].name} plunders ${loot} gold from the fallen capital.`)
      }
      relocateCapital(state, prevOwner)
    }
    checkElimination(state, prevOwner)
  }
}

/** A field army assaults an adjacent province. Mutates state and returns the report. */
export function performArmyAttack(state: GameState, armyId: number, toId: number, fullyBreached = false): BattleReport | null {
  const army = armyById(state, armyId)
  if (!army) return null
  const to = state.provinces[toId]
  const attackerId = army.ownerId
  const attacker = state.nations[attackerId]
  const defenderId = to.ownerId
  const defender = defenderId === null ? null : state.nations[defenderId]
  const force = { ...army.units }
  const defence = defendersAt(state, toId)

  const breached = fullyBreached ? to.buildings.walls : wallsBreached(army, to)
  const acrossRiver = crossesRiver(state.provinces[army.provinceId], to)
  const report = resolveBattle(state, {
    attackerId, defenderId, attacker: force, defender: { ...defence.units }, province: to, kind: 'battle', breached, acrossRiver,
  })

  army.units = { ...report.attackerEnd }
  army.movement = 0
  army.morale = Math.max(10, army.morale - (report.winner === 'attacker' ? 10 : 30))

  if (report.winner === 'attacker') {
    // Survivors of the defence stream away to a neighbouring province of their nation.
    applyDefenderLosses(state, toId, report.defenderEnd)
    const remnants = { ...state.provinces[toId].garrison }
    if (defenderId !== null && armySize(remnants) > 0) {
      const refuge = to.neighbors.map((i) => state.provinces[i]).filter((p) => p.ownerId === defenderId && p.id !== to.id)
      if (refuge.length) {
        const r = pick(state, refuge)
        r.garrison = addArmy(r.garrison, remnants)
      }
    }
    transferOwnership(state, to, attackerId, emptyArmy())
    army.provinceId = toId
    breakSiege(army)
    report.conquered = true
    attacker.stats.battlesWon += 1
    attacker.warWeariness = Math.min(100, attacker.warWeariness + 1)
    if (defender) {
      defender.warWeariness = Math.min(100, defender.warWeariness + 6)
      for (const other of state.nations) {
        if (other.alive && other.id !== attackerId && other.id !== defenderId) {
          other.relations[attackerId] = clamp((other.relations[attackerId] ?? 0) - 4, -100, 100)
          attacker.relations[other.id] = other.relations[attackerId]
        }
      }
    }
    log(state, 'battle', `${attacker.name}'s ${army.name} storms ${to.name} (${report.defenderName}) and takes it.`)
  } else {
    applyDefenderLosses(state, toId, report.defenderEnd)
    attacker.warWeariness = Math.min(100, attacker.warWeariness + 4)
    if (defender) {
      defender.warWeariness = Math.min(100, defender.warWeariness + 2)
      defender.stats.defensiveWins += 1
      defender.stats.battlesWon += 1
    }
    const broke = army.morale < 30 && retreatArmy(state, army)
    log(state, 'battle', `${attacker.name}'s ${army.name} assaults ${to.name} (${report.defenderName}) and is thrown back${broke ? ', falling back in disorder' : ''}.`)
  }
  pruneArmies(state)
  recordBattle(state, report)
  return report
}

/** Whether an army may attack a given province this turn. */
export function canArmyAttack(state: GameState, army: FieldArmy, toId: number): { ok: boolean; reason: string } {
  if (army.movement < moveCost(state.provinces[toId])) return { ok: false, reason: 'Not enough movement left' }
  if (!state.provinces[army.provinceId].neighbors.includes(toId)) return { ok: false, reason: 'Not adjacent' }
  if (armySize(army.units) === 0) return { ok: false, reason: 'No troops' }
  const to = state.provinces[toId]
  if (to.ownerId === army.ownerId) return { ok: false, reason: 'Already yours' }
  if (to.ownerId !== null && !state.nations[army.ownerId].wars.includes(to.ownerId)) {
    return { ok: false, reason: `Not at war with ${state.nations[to.ownerId].name}` }
  }
  return { ok: true, reason: '' }
}

export function resolveRebellion(state: GameState, p: Province): BattleReport | null {
  const ownerId = p.ownerId
  if (ownerId === null) return null
  const owner = state.nations[ownerId]
  const rebels: Army = { ...emptyArmy(), militia: Math.max(2, Math.round(p.population / 1500)) }
  const report = resolveBattle(state, {
    attackerId: null, defenderId: ownerId, attacker: rebels, defender: { ...defendersAt(state, p.id).units }, province: p, kind: 'rebellion',
  })
  if (report.winner === 'attacker') {
    const wasCapital = p.isCapital
    applyDefenderLosses(state, p.id, emptyArmy())
    transferOwnership(state, p, null, report.attackerEnd)
    p.unrest = 20
    log(state, 'war', `Rebellion in ${p.name}! The province has thrown off ${owner.name}'s rule${wasCapital ? ' and the capital is lost' : ''}.`)
    report.conquered = true
  } else {
    applyDefenderLosses(state, p.id, report.defenderEnd)
    p.unrest = Math.max(0, p.unrest - 35)
    log(state, 'war', `An uprising in ${p.name} was crushed by the ${owner.name} garrison.`)
  }
  recordBattle(state, report)
  return report
}
