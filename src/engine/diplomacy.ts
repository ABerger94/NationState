import type { GameState, Nation } from './types'
import { armyPower, clamp, log, nationArmy, ownedProvinces } from './helpers'

export function setRelation(state: GameState, a: number, b: number, v: number): void {
  const val = clamp(Math.round(v), -100, 100)
  state.nations[a].relations[b] = val
  state.nations[b].relations[a] = val
}

export function changeRelation(state: GameState, a: number, b: number, d: number): void {
  setRelation(state, a, b, (state.nations[a].relations[b] ?? 0) + d)
}

export function atWar(a: Nation, b: Nation): boolean {
  return a.wars.includes(b.id)
}

function addUnique(arr: number[], v: number) {
  if (!arr.includes(v)) arr.push(v)
}
function remove(arr: number[], v: number) {
  const i = arr.indexOf(v)
  if (i >= 0) arr.splice(i, 1)
}

export function breakAlliance(state: GameState, a: number, b: number, silent = false): void {
  const na = state.nations[a]
  const nb = state.nations[b]
  if (!na.allies.includes(b)) return
  remove(na.allies, b)
  remove(nb.allies, a)
  changeRelation(state, a, b, -30)
  if (!silent) log(state, 'diplomacy', `${na.name} has broken its alliance with ${nb.name}.`)
}

export function formAlliance(state: GameState, a: number, b: number): void {
  const na = state.nations[a]
  const nb = state.nations[b]
  addUnique(na.allies, b)
  addUnique(nb.allies, a)
  setRelation(state, a, b, Math.max(na.relations[b] ?? 0, 70))
  log(state, 'diplomacy', `${na.name} and ${nb.name} have sworn an alliance.`)
}

export function declareWar(state: GameState, aggressorId: number, targetId: number): void {
  const agg = state.nations[aggressorId]
  const tgt = state.nations[targetId]
  if (atWar(agg, tgt) || !agg.alive || !tgt.alive) return
  if (agg.allies.includes(targetId)) breakAlliance(state, aggressorId, targetId, true)
  addUnique(agg.wars, targetId)
  addUnique(tgt.wars, aggressorId)
  remove(agg.peaceOffersFrom, targetId)
  remove(tgt.peaceOffersFrom, aggressorId)
  setRelation(state, aggressorId, targetId, -80)
  log(state, 'war', `${agg.name} has declared war on ${tgt.name}!`)
  for (const other of state.nations) {
    if (!other.alive || other.id === aggressorId || other.id === targetId) continue
    changeRelation(state, other.id, aggressorId, other.allies.includes(targetId) ? -30 : -8)
  }
  for (const allyId of tgt.allies.slice()) {
    const ally = state.nations[allyId]
    if (!ally.alive || allyId === aggressorId || atWar(ally, agg)) continue
    if (ally.allies.includes(aggressorId)) breakAlliance(state, allyId, aggressorId, true)
    addUnique(ally.wars, aggressorId)
    addUnique(agg.wars, allyId)
    setRelation(state, allyId, aggressorId, Math.min(ally.relations[aggressorId] ?? 0, -50))
    log(state, 'war', `${ally.name} honours its alliance and joins the war against ${agg.name}.`)
  }
}

export function makePeace(state: GameState, a: number, b: number): void {
  const na = state.nations[a]
  const nb = state.nations[b]
  remove(na.wars, b)
  remove(nb.wars, a)
  remove(na.peaceOffersFrom, b)
  remove(nb.peaceOffersFrom, a)
  setRelation(state, a, b, Math.max(na.relations[b] ?? -50, -50) + 30)
  na.warWeariness = Math.max(0, na.warWeariness - 15)
  nb.warWeariness = Math.max(0, nb.warWeariness - 15)
  log(state, 'diplomacy', `${na.name} and ${nb.name} have signed a peace treaty.`)
}

/** Positive when `nationId` is winning against `enemyId`. Roughly -100..100. */
export function warScore(state: GameState, nationId: number, enemyId: number): number {
  const mine = armyPower(nationArmy(state, nationId)) + ownedProvinces(state, nationId).length * 10
  const theirs = armyPower(nationArmy(state, enemyId)) + ownedProvinces(state, enemyId).length * 10
  const n = state.nations[nationId]
  const e = state.nations[enemyId]
  const territory = (n.provincesGained - n.provincesLost) - (e.provincesGained - e.provincesLost)
  return clamp(((mine - theirs) / Math.max(1, mine + theirs)) * 100 + territory * 5, -100, 100)
}

export function aiAcceptsPeace(state: GameState, ai: Nation, other: Nation): boolean {
  const score = warScore(state, ai.id, other.id)
  if (ai.warWeariness > 45) return true
  if (ai.personality === 'aggressive') return score < 0
  return score < 25
}

export function aiAcceptsAlliance(state: GameState, ai: Nation, other: Nation): boolean {
  if (atWar(ai, other) || ai.allies.length >= 2) return false
  if (ai.wars.some((w) => other.allies.includes(w))) return false
  const rel = ai.relations[other.id] ?? 0
  void state
  return rel >= 60
}
