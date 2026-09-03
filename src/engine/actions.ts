import type { Army, BuildingKey, Difficulty, GameState, TechKey, UnitKey } from './types'
import { TECHS, TRADE_PRICES, UNITS } from './data'
import { armyFits, armySize, cloneState, hexDistance, log, playerNation, subArmy, addArmy } from './helpers'
import { buildingCost, canBuild, canRecruit, pay, transferCost, unitCost } from './economy'
import { aiAcceptsAlliance, aiAcceptsPeace, atWar, breakAlliance, changeRelation, declareWar, formAlliance, makePeace } from './diplomacy'
import { performAttack } from './military'
import { applyEventChoice } from './events'
import { endTurn } from './turn'
import { createGame } from './world'

export type Action =
  | { type: 'NEW_GAME'; seed: number; playerName: string; difficulty: Difficulty }
  | { type: 'LOAD'; state: GameState }
  | { type: 'BUILD'; provinceId: number; building: BuildingKey }
  | { type: 'RECRUIT'; provinceId: number; unit: UnitKey; count: number }
  | { type: 'DISBAND'; provinceId: number; unit: UnitKey; count: number }
  | { type: 'TRANSFER'; from: number; to: number; army: Army }
  | { type: 'ATTACK'; from: number; to: number; army: Army }
  | { type: 'SET_TAX'; rate: number }
  | { type: 'SET_RESEARCH'; tech: TechKey | null }
  | { type: 'DECLARE_WAR'; target: number }
  | { type: 'PROPOSE_PEACE'; target: number }
  | { type: 'ACCEPT_PEACE'; target: number }
  | { type: 'SEND_GIFT'; target: number; amount: number }
  | { type: 'PROPOSE_ALLIANCE'; target: number }
  | { type: 'BREAK_ALLIANCE'; target: number }
  | { type: 'RESOLVE_EVENT'; choice: number }
  | { type: 'TRADE'; resource: 'food' | 'wood' | 'iron'; amount: number; direction: 'sell' | 'buy' }
  | { type: 'END_TURN' }
  | { type: 'QUIT' }

/** Which neighbours of a player province can currently be attacked from it. */
export function attackTargets(state: GameState, fromId: number): number[] {
  const from = state.provinces[fromId]
  const player = playerNation(state)
  if (from.ownerId !== player.id || from.lockedTurn === state.turn || armySize(from.garrison) === 0) return []
  return from.neighbors.filter((i) => {
    const t = state.provinces[i]
    return t.ownerId === null || (t.ownerId !== player.id && atWar(player, state.nations[t.ownerId]))
  })
}

export function canTransfer(state: GameState, fromId: number, toId: number, army: Army): { ok: boolean; reason: string; cost: number } {
  const player = playerNation(state)
  const from = state.provinces[fromId]
  const to = state.provinces[toId]
  const units = armySize(army)
  const cost = transferCost(player, from, to, units, hexDistance(from, to))
  if (from.ownerId !== player.id || to.ownerId !== player.id) return { ok: false, reason: 'Both provinces must be yours', cost }
  if (fromId === toId) return { ok: false, reason: 'Choose a different province', cost }
  if (from.lockedTurn === state.turn) return { ok: false, reason: 'These troops have already acted this turn', cost }
  if (units === 0) return { ok: false, reason: 'Select troops to move', cost }
  if (!armyFits(from.garrison, army)) return { ok: false, reason: 'Not enough troops', cost }
  if (player.resources.gold < cost) return { ok: false, reason: `Transfer costs ${cost} gold`, cost }
  return { ok: true, reason: '', cost }
}

export function reducer(state: GameState | null, action: Action): GameState | null {
  if (action.type === 'NEW_GAME') return createGame(action)
  if (action.type === 'LOAD') return action.state
  if (action.type === 'QUIT') return null
  if (!state) return state
  if (action.type === 'END_TURN') return endTurn(state)
  if (state.gameOver) return state

  const s = cloneState(state)
  const player = playerNation(s)

  switch (action.type) {
    case 'BUILD': {
      const p = s.provinces[action.provinceId]
      if (!canBuild(s, player, p, action.building).ok) return state
      pay(player, buildingCost(player, action.building))
      p.buildings[action.building] += 1
      return s
    }
    case 'RECRUIT': {
      const p = s.provinces[action.provinceId]
      if (!canRecruit(s, player, p, action.unit, action.count).ok) return state
      pay(player, unitCost(action.unit, action.count))
      p.population -= UNITS[action.unit].men * action.count
      p.garrison[action.unit] += action.count
      return s
    }
    case 'DISBAND': {
      const p = s.provinces[action.provinceId]
      if (p.ownerId !== player.id || p.garrison[action.unit] < action.count || action.count < 1) return state
      p.garrison[action.unit] -= action.count
      p.population += Math.round(UNITS[action.unit].men * action.count * 0.8)
      return s
    }
    case 'TRANSFER': {
      const check = canTransfer(s, action.from, action.to, action.army)
      if (!check.ok) return state
      player.resources.gold -= check.cost
      s.provinces[action.from].garrison = subArmy(s.provinces[action.from].garrison, action.army)
      s.provinces[action.to].garrison = addArmy(s.provinces[action.to].garrison, action.army)
      return s
    }
    case 'ATTACK': {
      if (!attackTargets(s, action.from).includes(action.to)) return state
      const from = s.provinces[action.from]
      if (armySize(action.army) === 0 || !armyFits(from.garrison, action.army)) return state
      if (s.pendingEvent) return state
      s.lastTurnBattles = []
      performAttack(s, player.id, action.from, action.to, action.army)
      return s
    }
    case 'TRADE': {
      const amount = Math.floor(action.amount)
      if (amount < 1) return state
      const price = TRADE_PRICES[action.resource]
      const r = player.resources
      if (action.direction === 'sell') {
        if (r[action.resource] < amount) return state
        r[action.resource] -= amount
        r.gold += Math.floor(amount * price.sell)
      } else {
        const cost = Math.ceil(amount * price.buy)
        if (r.gold < cost) return state
        r.gold -= cost
        r[action.resource] += amount
      }
      return s
    }
    case 'SET_TAX':
      player.taxRate = Math.max(0, Math.min(50, Math.round(action.rate)))
      return s
    case 'SET_RESEARCH': {
      if (action.tech === null) { player.research = null; return s }
      const def = TECHS[action.tech]
      if (player.techs.includes(action.tech)) return state
      if (def.requires && !player.techs.includes(def.requires)) return state
      player.research = action.tech
      return s
    }
    case 'DECLARE_WAR': {
      const t = s.nations[action.target]
      if (!t.alive || t.isPlayer || atWar(player, t)) return state
      declareWar(s, player.id, action.target)
      return s
    }
    case 'PROPOSE_PEACE': {
      const t = s.nations[action.target]
      if (!atWar(player, t)) return state
      if (aiAcceptsPeace(s, t, player)) makePeace(s, player.id, t.id)
      else {
        log(s, 'diplomacy', `${t.name} rejects our offer of peace. They believe the war still favours them.`)
        changeRelation(s, player.id, t.id, 2)
      }
      return s
    }
    case 'ACCEPT_PEACE': {
      const t = s.nations[action.target]
      if (!player.peaceOffersFrom.includes(t.id) || !atWar(player, t)) return state
      makePeace(s, player.id, t.id)
      return s
    }
    case 'SEND_GIFT': {
      const t = s.nations[action.target]
      const amount = Math.round(action.amount)
      if (!t.alive || amount < 1 || player.resources.gold < amount) return state
      player.resources.gold -= amount
      t.resources.gold += amount
      changeRelation(s, player.id, t.id, Math.min(25, Math.round(amount / 10)))
      log(s, 'diplomacy', `We send a gift of ${amount} gold to ${t.name}.`)
      return s
    }
    case 'PROPOSE_ALLIANCE': {
      const t = s.nations[action.target]
      if (!t.alive || player.allies.includes(t.id) || atWar(player, t)) return state
      if (aiAcceptsAlliance(s, t, player) && player.allies.length < 2) formAlliance(s, player.id, t.id)
      else log(s, 'diplomacy', `${t.name} politely declines an alliance for now.`)
      return s
    }
    case 'BREAK_ALLIANCE':
      breakAlliance(s, player.id, action.target)
      return s
    case 'RESOLVE_EVENT': {
      if (!s.pendingEvent) return state
      const ev = s.pendingEvent
      s.pendingEvent = null
      applyEventChoice(s, ev, action.choice)
      return s
    }
    default:
      return state
  }
}
