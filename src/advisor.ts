import type { GameState } from './engine/types'
import { nationBudget } from './engine/economy'
import { armyPower, armySize, ownedProvinces, playerNation } from './engine/helpers'
import { attackPower, defensePower } from './engine/military'
import { atWar } from './engine/diplomacy'

export type AdviceTab = 'province' | 'nation' | 'diplomacy' | 'military' | 'log'
export interface Advice { id: string; level: 'danger' | 'warn' | 'info' | 'tip'; text: string; tab?: AdviceTab; provinceId?: number }

const ORDER = { danger: 0, warn: 1, info: 2, tip: 3 }

export function getAdvice(state: GameState): Advice[] {
  const player = playerNation(state)
  if (!player.alive || state.gameOver) return []
  const out: Advice[] = []
  const provs = ownedProvinces(state, player.id)
  const budget = nationBudget(state, player)
  const r = player.resources

  if (state.turn <= 2) out.push({ id: 'welcome', level: 'tip', text: 'Click a province to inspect it. Left-drag pans the map, right-drag rotates, scroll zooms. Press Enter to end the turn.' })
  if (!player.research) out.push({ id: 'research', level: 'warn', text: 'No technology is being researched. Your scholars are idle.', tab: 'nation' })
  if (budget.net.food < 0) {
    const turns = Math.floor(r.food / -budget.net.food)
    out.push({ id: 'food', level: turns <= 3 ? 'danger' : 'warn', text: turns <= 0 ? 'The realm is starving. Build farms, sell iron for food, or disband troops.' : `Food is running out: famine in about ${turns} turn${turns === 1 ? '' : 's'}. Build farms or buy food.`, tab: 'nation' })
  } else if (r.food >= budget.foodCap - 1 && budget.net.food > 5) {
    out.push({ id: 'granary', level: 'info', text: 'Granaries are full and surplus food is wasted. Build a granary or sell food at the market.', tab: 'nation' })
  }
  if (budget.net.gold < 0) out.push({ id: 'gold', level: r.gold < -budget.net.gold * 3 ? 'danger' : 'warn', text: `The treasury loses ${Math.abs(budget.net.gold).toFixed(1)} gold per turn. Unpaid troops desert.`, tab: 'nation' })
  else if (r.gold > 450) out.push({ id: 'spend', level: 'tip', text: `${Math.floor(r.gold)} gold sits idle. Build, recruit, or buy goodwill with gifts.` })
  if (player.peaceOffersFrom.length) out.push({ id: 'peace', level: 'info', text: `${state.nations[player.peaceOffersFrom[0]].name} offers peace.`, tab: 'diplomacy' })
  if (player.warWeariness > 40) out.push({ id: 'weary', level: 'warn', text: `War weariness is ${Math.round(player.warWeariness)}. Stability suffers; consider making peace.`, tab: 'diplomacy' })

  const restless = provs.filter((p) => p.unrest >= 65).sort((a, b) => b.unrest - a.unrest)[0]
  if (restless) out.push({ id: 'unrest', level: restless.unrest >= 85 ? 'danger' : 'warn', text: `Unrest in ${restless.name} is ${Math.round(restless.unrest)}. Garrison it, build a temple, or lower taxes.`, provinceId: restless.id, tab: 'province' })

  let worstThreat: { p: typeof provs[number]; enemy: string; ratio: number } | null = null
  let undefended: typeof provs[number] | null = null
  let expansion: { from: typeof provs[number]; to: string; ratio: number } | null = null
  for (const p of provs) {
    const own = defensePower(p.garrison, player, p, 0)
    for (const i of p.neighbors) {
      const q = state.provinces[i]
      if (q.ownerId === player.id) continue
      const enemy = q.ownerId === null ? null : state.nations[q.ownerId]
      if (enemy && atWar(player, enemy)) {
        const threat = attackPower(q.garrison, enemy, p.terrain, 2)
        const ratio = own > 0 ? threat / own : 99
        if (ratio > 1.1 && (!worstThreat || ratio > worstThreat.ratio)) worstThreat = { p, enemy: enemy.name, ratio }
      }
      if (armySize(p.garrison) === 0 && enemy && !undefended) undefended = p
      if (q.ownerId === null && p.lockedTurn !== state.turn) {
        const mine = attackPower({ ...p.garrison, militia: 0 }, player, q.terrain, 2)
        const theirs = defensePower(q.garrison, null, q, p.garrison.siege)
        const ratio = theirs > 0 ? mine / theirs : 99
        if (ratio >= 1.7 && (!expansion || ratio > expansion.ratio)) expansion = { from: p, to: q.name, ratio }
      }
    }
  }
  if (worstThreat) out.push({ id: 'threat', level: 'danger', text: `${worstThreat.p.name} is outmatched by ${worstThreat.enemy} forces next door. Reinforce it or build walls.`, provinceId: worstThreat.p.id, tab: 'province' })
  if (undefended) out.push({ id: 'undefended', level: 'warn', text: `${undefended.name} has no garrison and borders a foreign nation.`, provinceId: undefended.id, tab: 'province' })
  if (expansion) out.push({ id: 'expand', level: 'tip', text: `The army in ${expansion.from.name} can take independent ${expansion.to} with good odds.`, provinceId: expansion.from.id, tab: 'province' })

  const myPower = armyPower(provs.reduce((a, p) => { for (const k of Object.keys(a) as Array<keyof typeof a>) a[k] += p.garrison[k]; return a }, { militia: 0, infantry: 0, archers: 0, cavalry: 0, siege: 0 }))
  const bully = state.nations.find((n) => n.alive && !n.isPlayer && !atWar(player, n) && (player.relations[n.id] ?? 0) < -30 && armyPower(ownedProvinces(state, n.id).reduce((a, p) => { for (const k of Object.keys(a) as Array<keyof typeof a>) a[k] += p.garrison[k]; return a }, { militia: 0, infantry: 0, archers: 0, cavalry: 0, siege: 0 })) > myPower * 1.5)
  if (bully) out.push({ id: 'bully', level: 'info', text: `${bully.name} is hostile and far stronger than us. A gift or an alliance elsewhere may buy safety.`, tab: 'diplomacy' })

  return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]).slice(0, 5)
}
