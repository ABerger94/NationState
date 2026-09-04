import type { GameState } from './engine/types'
import { nationBudget } from './engine/economy'
import { armyPower, armySize, ownedProvinces, playerNation } from './engine/helpers'
import { attackPower, defensePower } from './engine/military'
import { atWar } from './engine/diplomacy'
import { bestBuildAcrossRealm, describeGain } from './engine/yields'
import { armiesOf, besiegersOf, defendersAt } from './engine/armies'
import { canArmyAttack } from './engine/military'
import { BUILDINGS } from './engine/data'
import { buildingCost } from './engine/economy'

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

  const touch = typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches
  if (state.turn <= 2) out.push({ id: 'welcome', level: 'tip', text: touch ? 'Tap a province to inspect it. Drag to pan, pinch to zoom, two fingers to rotate. Tap the action bar to build, recruit or attack.' : 'Click a province to inspect it. Left-drag pans the map, right-drag rotates, scroll zooms. Press Enter to end the turn.' })
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

  const best = bestBuildAcrossRealm(state, player)
  if (best && r.gold >= 120) out.push({ id: 'best-build', level: 'tip', text: `Best investment: a ${BUILDINGS[best.suggestion.key].name} in ${state.provinces[best.provinceId].name} for ${buildingCost(player, best.suggestion.key).gold} gold adds ${describeGain(best.suggestion.gain.yields)} per turn.`, provinceId: best.provinceId, tab: 'province' })

  const restless = provs.filter((p) => p.unrest >= 65).sort((a, b) => b.unrest - a.unrest)[0]
  if (restless) out.push({ id: 'unrest', level: restless.unrest >= 85 ? 'danger' : 'warn', text: `Unrest in ${restless.name} is ${Math.round(restless.unrest)}. Garrison it, build a temple, or lower taxes.`, provinceId: restless.id, tab: 'province' })

  let worstThreat: { p: typeof provs[number]; enemy: string; ratio: number } | null = null
  let undefended: typeof provs[number] | null = null
  for (const p of provs) {
    const own = defensePower(p.garrison, player, p, 0)
    for (const i of p.neighbors) {
      const q = state.provinces[i]
      if (q.ownerId === player.id) continue
      const enemy = q.ownerId === null ? null : state.nations[q.ownerId]
      if (enemy && atWar(player, enemy)) {
        const threat = attackPower(q.garrison, enemy, p.terrain, 2, state)
        const ratio = own > 0 ? threat / own : 99
        if (ratio > 1.1 && (!worstThreat || ratio > worstThreat.ratio)) worstThreat = { p, enemy: enemy.name, ratio }
      }
      if (armySize(p.garrison) === 0 && enemy && !undefended) undefended = p
    }
  }

  // The AI concentrates its hosts, so warn when one is gathering against us.
  let massing: { p: typeof provs[number]; power: number; count: number } | null = null
  for (const p of provs) {
    let power = 0
    let count = 0
    for (const a of state.armies) {
      if (a.ownerId === player.id) continue
      if (!atWar(player, state.nations[a.ownerId])) continue
      if (!state.provinces[a.provinceId].neighbors.includes(p.id) && a.provinceId !== p.id) continue
      power += armyPower(a.units)
      count += 1
    }
    if (count === 0) continue
    const held = defensePower(defendersAt(state, p.id).units, player, p, 0)
    if (power > held && (!massing || power > massing.power)) massing = { p, power, count }
  }
  if (massing) {
    out.push({
      id: 'massing', level: 'danger',
      text: `${massing.count} enemy ${massing.count === 1 ? 'army is' : 'armies are'} massing against ${massing.p.name}, and the defence there will not hold. Reinforce it or march to meet them.`,
      provinceId: massing.p.id, tab: 'province',
    })
  }
  for (const p of provs) {
    const siegers = besiegersOf(state, p.id).filter((a) => a.ownerId !== player.id)
    if (siegers.length) {
      out.push({ id: 'besieged', level: 'danger', text: `${p.name} is under siege. Its walls will not hold forever: relieve it or the province is lost.`, provinceId: p.id, tab: 'province' })
      break
    }
  }

  const armies = armiesOf(state, player.id)
  const idle = armies.filter((a) => a.movement > 0)
  const striker = idle.find((a) => state.provinces[a.provinceId].neighbors.some((i) => canArmyAttack(state, a, i).ok))
  if (striker) {
    const target = state.provinces[striker.provinceId].neighbors.find((i) => canArmyAttack(state, striker, i).ok)!
    out.push({ id: 'strike', level: 'tip', text: `${striker.name} can attack ${state.provinces[target].name} this turn.`, provinceId: striker.provinceId, tab: 'province' })
  } else if (idle.length) {
    out.push({ id: 'idle-army', level: 'info', text: `${idle.length} of your armies still have movement left this turn. Press N to cycle them.`, tab: 'military' })
  } else if (!armies.length) {
    const musterable = provs.find((p) => armySize(p.garrison) >= 4 && p.neighbors.some((i) => state.provinces[i].ownerId !== player.id))
    if (musterable) out.push({ id: 'muster', level: 'tip', text: `You have no field army. Raise one in ${musterable.name} to expand: garrisons cannot attack.`, provinceId: musterable.id, tab: 'province' })
  }

  if (worstThreat) out.push({ id: 'threat', level: 'danger', text: `${worstThreat.p.name} is outmatched by ${worstThreat.enemy} forces next door. Reinforce it or build walls.`, provinceId: worstThreat.p.id, tab: 'province' })
  if (undefended) out.push({ id: 'undefended', level: 'warn', text: `${undefended.name} has no garrison and borders a foreign nation.`, provinceId: undefended.id, tab: 'province' })

  const myPower = armyPower(provs.reduce((a, p) => { for (const k of Object.keys(a) as Array<keyof typeof a>) a[k] += p.garrison[k]; return a }, { militia: 0, infantry: 0, archers: 0, cavalry: 0, siege: 0 }))
  const bully = state.nations.find((n) => n.alive && !n.isPlayer && !atWar(player, n) && (player.relations[n.id] ?? 0) < -30 && armyPower(ownedProvinces(state, n.id).reduce((a, p) => { for (const k of Object.keys(a) as Array<keyof typeof a>) a[k] += p.garrison[k]; return a }, { militia: 0, infantry: 0, archers: 0, cavalry: 0, siege: 0 })) > myPower * 1.5)
  if (bully) out.push({ id: 'bully', level: 'info', text: `${bully.name} is hostile and far stronger than us. A gift or an alliance elsewhere may buy safety.`, tab: 'diplomacy' })

  return out.sort((a, b) => ORDER[a.level] - ORDER[b.level]).slice(0, 5)
}
