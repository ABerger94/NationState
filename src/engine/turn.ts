import type { GameState, Nation } from './types'
import { CONQUEST_SHARE, MAX_TURNS, TECHS, UNIT_ORDER } from './data'
import { cloneState, log, ownedProvinces, playerNation } from './helpers'
import { nationBudget, nationScore } from './economy'
import { growProvince, growTribal, updateUnrest } from './population'
import { runAI } from './ai'
import { resolveRebellion, checkElimination } from './military'
import { rollEvent } from './events'
import { checkObjectives } from './objectives'
import { nextRand } from './rng'
import { changeRelation } from './diplomacy'

function processEconomy(state: GameState, n: Nation): void {
  const budget = nationBudget(state, n)
  const r = n.resources
  r.gold += budget.net.gold
  r.wood += budget.net.wood
  r.iron += budget.net.iron
  r.food += budget.net.food

  let starving = 0
  if (r.food < 0) {
    starving = Math.min(1, -r.food / Math.max(1, budget.upkeep.food))
    r.food = 0
    if (n.isPlayer) log(state, 'economy', `Famine! Our granaries are empty and the people go hungry.`)
  }
  r.food = Math.min(r.food, budget.foodCap)

  if (r.gold < 0) {
    r.gold = 0
    let deserted = 0
    for (const p of ownedProvinces(state, n.id)) {
      for (const k of UNIT_ORDER) {
        const d = Math.ceil(p.garrison[k] * 0.1)
        p.garrison[k] -= d
        deserted += d
      }
      p.unrest = Math.min(100, p.unrest + 5)
    }
    if (deserted > 0) log(state, 'economy', `${n.name} cannot pay its troops: ${deserted} units desert.`)
  }

  const foodRatio = budget.income.food / Math.max(1, budget.upkeep.food)
  for (const p of ownedProvinces(state, n.id)) {
    growProvince(p, n, { stability: budget.stability, foodRatio, starving })
    updateUnrest(state, p, n, starving, budget.luxuries)
  }

  if (n.research) {
    n.researchProgress += budget.science
    const cost = TECHS[n.research].cost
    if (n.researchProgress >= cost) {
      n.researchProgress -= cost
      n.techs.push(n.research)
      log(state, 'info', `${n.name} has discovered ${TECHS[n.research].name}.`)
      n.research = null
    }
  }

  if (n.wars.length > 0) n.warWeariness = Math.min(100, n.warWeariness + 1.5 * n.wars.length * (n.policies.military === 'expansionist' ? 1.5 : 1))
  else n.warWeariness = Math.max(0, n.warWeariness - 3)
}

function processRebellions(state: GameState): void {
  for (const p of state.provinces) {
    if (p.ownerId === null || p.unrest < 85) continue
    if (nextRand(state) < 0.3) resolveRebellion(state, p)
  }
}

function driftRelations(state: GameState): void {
  const alive = state.nations.filter((n) => n.alive)
  for (const a of alive) {
    for (const b of alive) {
      if (b.id <= a.id) continue
      const rel = a.relations[b.id] ?? 0
      if (a.wars.includes(b.id)) changeRelation(state, a.id, b.id, -1)
      else if (a.allies.includes(b.id)) changeRelation(state, a.id, b.id, 1)
      else if (rel < 0) changeRelation(state, a.id, b.id, 1)
      else if (rel > 30 && nextRand(state) < 0.5) changeRelation(state, a.id, b.id, -1)
    }
  }
}

function checkVictory(state: GameState): void {
  const player = playerNation(state)
  const total = state.provinces.length
  if (!player.alive) {
    state.gameOver = true
    state.gameOverReason = 'Your nation has been destroyed. The chronicles will remember what might have been.'
    return
  }
  const rivals = state.nations.filter((n) => n.alive && !n.isPlayer)
  if (rivals.length === 0) {
    state.gameOver = true
    state.winner = player.id
    state.gameOverReason = 'Every rival lies broken. You rule the known world.'
    return
  }
  for (const n of state.nations) {
    if (!n.alive) continue
    if (ownedProvinces(state, n.id).length / total >= CONQUEST_SHARE) {
      state.gameOver = true
      state.winner = n.id
      state.gameOverReason = n.isPlayer
        ? `You control ${Math.round(CONQUEST_SHARE * 100)}% of the world. Victory by conquest!`
        : `${n.name} controls ${Math.round(CONQUEST_SHARE * 100)}% of the world and proclaims a universal empire.`
      return
    }
  }
  if (state.turn >= MAX_TURNS) {
    const ranked = state.nations.filter((n) => n.alive).map((n) => ({ n, s: nationScore(state, n) })).sort((a, b) => b.s - a.s)
    state.gameOver = true
    state.winner = ranked[0].n.id
    state.gameOverReason = ranked[0].n.isPlayer
      ? `The age ends and history judges your nation the greatest with a score of ${ranked[0].s}.`
      : `The age ends. ${ranked[0].n.name} is judged the greatest nation with a score of ${ranked[0].s}. You scored ${ranked.find((x) => x.n.isPlayer)?.s ?? 0}.`
  }
}

export function endTurn(prev: GameState): GameState {
  const state = cloneState(prev)
  if (state.gameOver || state.pendingEvent) return state
  state.lastTurnBattles = []

  for (const n of state.nations) if (n.alive) processEconomy(state, n)
  for (const p of state.provinces) if (p.ownerId === null) growTribal(p)
  for (const n of state.nations) if (n.alive && !n.isPlayer) runAI(state, n)
  processRebellions(state)
  driftRelations(state)
  for (const n of state.nations) checkElimination(state, n.id)

  checkObjectives(state)
  state.turn += 1
  checkVictory(state)
  if (!state.gameOver) state.pendingEvent = rollEvent(state)
  if (state.gameOver && state.gameOverReason) log(state, 'info', state.gameOverReason)
  return state
}
