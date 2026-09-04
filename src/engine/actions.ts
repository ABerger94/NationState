import type { Army, BuildingKey, Difficulty, EconomyPolicy, GameState, MilitaryPolicy, PolicyCategory, SocietyPolicy, TechKey, UnitKey } from './types'
import { POLICY_CHANGE_COST, POLICY_COOLDOWN, TECHS, TRADE_PRICES, UNITS } from './data'
import { checkObjectives } from './objectives'
import { cloneState, log, playerNation } from './helpers'
import { buildingCost, canBuild, canRecruit, pay, unitCost } from './economy'
import { aiAcceptsAlliance, aiAcceptsPeace, atWar, breakAlliance, changeRelation, declareWar, formAlliance, makePeace } from './diplomacy'
import { canArmyAttack, performArmyAttack } from './military'
import { applyEventChoice } from './events'
import { endTurn } from './turn'
import { createGame } from './world'
import { armiesOf, armyById, disbandIntoGarrison, mergeArmies, moveArmy, raiseArmy, splitArmy } from './armies'

export type Action =
  | { type: 'NEW_GAME'; seed: number; playerName: string; difficulty: Difficulty }
  | { type: 'LOAD'; state: GameState }
  | { type: 'BUILD'; provinceId: number; building: BuildingKey }
  | { type: 'RECRUIT'; provinceId: number; unit: UnitKey; count: number }
  | { type: 'DISBAND'; provinceId: number; unit: UnitKey; count: number }
  | { type: 'RAISE_ARMY'; provinceId: number; units: Army }
  | { type: 'MOVE_ARMY'; armyId: number; destId: number }
  | { type: 'ARMY_ATTACK'; armyId: number; toId: number }
  | { type: 'DISBAND_ARMY'; armyId: number }
  | { type: 'MERGE_ARMIES'; intoId: number; fromId: number }
  | { type: 'SPLIT_ARMY'; armyId: number; units: Army }
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
  | { type: 'SET_POLICY'; category: PolicyCategory; value: EconomyPolicy | MilitaryPolicy | SocietyPolicy }
  | { type: 'END_TURN' }
  | { type: 'QUIT' }

/** Provinces the given army may attack this turn. */
export function armyAttackTargets(state: GameState, armyId: number): number[] {
  const army = armyById(state, armyId)
  if (!army) return []
  return state.provinces[army.provinceId].neighbors.filter((i) => canArmyAttack(state, army, i).ok)
}

/** Every province any of the player's armies could attack this turn. */
export function allAttackTargets(state: GameState): number[] {
  const player = playerNation(state)
  const out = new Set<number>()
  for (const a of armiesOf(state, player.id)) for (const i of armyAttackTargets(state, a.id)) out.add(i)
  return [...out]
}

export function canChangePolicy(state: GameState, category: PolicyCategory): { ok: boolean; reason: string; cost: number } {
  const player = playerNation(state)
  const firstPick = player.policies[category] === null
  const cost = firstPick ? 0 : POLICY_CHANGE_COST
  const wait = POLICY_COOLDOWN - (state.turn - player.policies.changedTurn)
  if (!firstPick && wait > 0) return { ok: false, reason: `The court needs ${wait} more turn${wait === 1 ? '' : 's'} before another edict`, cost }
  if (player.resources.gold < cost) return { ok: false, reason: `Changing an edict costs ${cost} gold`, cost }
  return { ok: true, reason: '', cost }
}

export function reducer(state: GameState | null, action: Action): GameState | null {
  if (action.type === 'NEW_GAME') return createGame(action)
  if (action.type === 'LOAD') return action.state
  if (action.type === 'QUIT') return null
  if (!state) return state
  if (action.type === 'END_TURN') return endTurn(state)
  if (state.gameOver) return state

  const next = applyAction(state, action)
  if (next !== state && next) checkObjectives(next)
  return next
}

function applyAction(state: GameState, action: Action): GameState | null {
  const s = cloneState(state)
  const player = playerNation(s)

  switch (action.type) {
    case 'BUILD': {
      const p = s.provinces[action.provinceId]
      if (!canBuild(s, player, p, action.building).ok) return state
      pay(player, buildingCost(player, action.building))
      p.buildings[action.building] += 1
      player.stats.built += 1
      return s
    }
    case 'RECRUIT': {
      const p = s.provinces[action.provinceId]
      if (!canRecruit(s, player, p, action.unit, action.count).ok) return state
      pay(player, unitCost(action.unit, action.count, player, s))
      p.population -= UNITS[action.unit].men * action.count
      p.garrison[action.unit] += action.count
      player.stats.recruited += action.count
      return s
    }
    case 'DISBAND': {
      const p = s.provinces[action.provinceId]
      if (p.ownerId !== player.id || p.garrison[action.unit] < action.count || action.count < 1) return state
      p.garrison[action.unit] -= action.count
      p.population += Math.round(UNITS[action.unit].men * action.count * 0.8)
      return s
    }
    case 'RAISE_ARMY': {
      const army = raiseArmy(s, player.id, action.provinceId, action.units)
      if (!army) return state
      log(s, 'info', `${army.name} musters in ${s.provinces[action.provinceId].name}.`, false)
      return s
    }
    case 'MOVE_ARMY': {
      if (!moveArmy(s, action.armyId, action.destId)) return state
      return s
    }
    case 'ARMY_ATTACK': {
      const army = armyById(s, action.armyId)
      if (!army || army.ownerId !== player.id) return state
      if (!canArmyAttack(s, army, action.toId).ok) return state
      if (s.pendingEvent) return state
      s.lastTurnBattles = []
      performArmyAttack(s, action.armyId, action.toId)
      return s
    }
    case 'DISBAND_ARMY': {
      const army = armyById(s, action.armyId)
      if (!army || army.ownerId !== player.id) return state
      if (!disbandIntoGarrison(s, action.armyId)) return state
      return s
    }
    case 'MERGE_ARMIES': {
      const into = armyById(s, action.intoId)
      if (!into || into.ownerId !== player.id) return state
      if (!mergeArmies(s, action.intoId, action.fromId)) return state
      return s
    }
    case 'SPLIT_ARMY': {
      const army = armyById(s, action.armyId)
      if (!army || army.ownerId !== player.id) return state
      if (!splitArmy(s, action.armyId, action.units)) return state
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
    case 'SET_POLICY': {
      if (player.policies[action.category] === action.value) return state
      const check = canChangePolicy(s, action.category)
      if (!check.ok) return state
      player.resources.gold -= check.cost
      if (player.policies[action.category] !== null) player.policies.changedTurn = s.turn
      ;(player.policies as unknown as Record<string, string | number | null>)[action.category] = action.value
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
