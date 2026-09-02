import type { BuildingKey, GameEvent, GameState, Province } from './types'
import { BUILDINGS, BUILDING_ORDER } from './data'
import { armySize, hasTech, log, ownedProvinces, playerNation } from './helpers'
import { changeRelation } from './diplomacy'
import { nextRand, pick } from './rng'

function eventFor(state: GameState, id: string, p: Province | null, extra: Partial<GameEvent> = {}): GameEvent {
  const player = playerNation(state)
  switch (id) {
    case 'plague':
      return { id, title: 'Plague', provinceId: p!.id, text: `A sickness spreads through ${p!.name}. Physicians beg for a quarantine, but the merchants say it would ruin the town.`, choices: [
        { label: 'Quarantine (50 gold)', description: '−8% population, +10 unrest in the province.' },
        { label: 'Let it run its course', description: `−${hasTech(player, 'medicine') ? 9 : 18}% population in the province.` },
      ], ...extra }
    case 'harvest':
      return { id, title: 'Bountiful Harvest', provinceId: p!.id, text: `The fields of ${p!.name} yield more than anyone can remember.`, choices: [
        { label: 'Fill the granaries', description: '+150 food.' },
        { label: 'Hold a feast', description: '+60 food and −8 unrest in the province.' },
      ], ...extra }
    case 'goldVein':
      return { id, title: 'Gold Discovered', provinceId: p!.id, text: `Prospectors strike a rich vein in the hills of ${p!.name}.`, choices: [
        { label: 'Claim it for the crown', description: '+120 gold.' },
        { label: 'Let the locals keep it', description: '−10 unrest in the province and +40 gold in taxes.' },
      ], ...extra }
    case 'bandits':
      return { id, title: 'Bandits', provinceId: p!.id, text: `Outlaws are raiding the roads around ${p!.name}.`, choices: [
        { label: 'Send the garrison', description: armySize(p!.garrison) >= 2 ? 'Lose 1 unit; −5 unrest.' : 'The garrison is too small. +15 unrest and some devastation.' },
        { label: 'Pay them off (80 gold)', description: 'Costs 80 gold. Nothing else happens.' },
        { label: 'Ignore them', description: '+15 unrest and some devastation in the province.' },
      ], ...extra }
    case 'migrants':
      return { id, title: 'Migrants Arrive', provinceId: p!.id, text: `Refugees from distant wars ask to settle in ${p!.name}.`, choices: [
        { label: 'Welcome them', description: '+1,500 population, +8 unrest in the province.' },
        { label: 'Turn them away', description: 'Nothing changes.' },
      ], ...extra }
    case 'fire':
      return { id, title: 'Great Fire', provinceId: p!.id, text: `A fire tears through ${p!.name}, destroying a building.`, choices: [
        { label: 'Rebuild at once (60 gold)', description: 'Keep the building.' },
        { label: 'Let it burn', description: 'Lose one building level.' },
      ], ...extra }
    case 'festival':
      return { id, title: 'Festival Season', text: 'The people petition for a grand festival in your honour.', choices: [
        { label: 'Fund it (60 gold)', description: '−10 unrest in every province.' },
        { label: 'Decline', description: '+3 unrest everywhere.' },
      ], ...extra }
    case 'scholar':
      return { id, title: 'A Visiting Scholar', text: 'A renowned scholar offers to work at your court in exchange for patronage.', choices: [
        { label: 'Patronise her (70 gold)', description: '+40 research progress.' },
        { label: 'Decline', description: 'Nothing changes.' },
      ], ...extra }
    case 'mercenaries':
      return { id, title: 'Mercenary Company', provinceId: p!.id, text: `A free company offers its swords at ${p!.name}.`, choices: [
        { label: 'Hire them (130 gold)', description: '+4 infantry in the province.' },
        { label: 'Send them away', description: 'Nothing changes.' },
      ], ...extra }
    case 'borderDispute':
      return { id, title: 'Border Dispute', text: `Herders from ${state.nations[extra.nationId!].name} have crossed into your lands and refuse to leave.`, choices: [
        { label: 'Let it pass', description: `+12 relations with ${state.nations[extra.nationId!].name}.` },
        { label: 'Expel them', description: `−20 relations with ${state.nations[extra.nationId!].name}; −5 unrest everywhere as the people cheer.` },
      ], ...extra }
    default:
      throw new Error('unknown event ' + id)
  }
}

export function rollEvent(state: GameState): GameEvent | null {
  if (state.turn < 3 || nextRand(state) > 0.3) return null
  const player = playerNation(state)
  const provs = ownedProvinces(state, player.id)
  if (!provs.length) return null
  const p = pick(state, provs)
  const pool: string[] = ['plague', 'harvest', 'goldVein', 'bandits', 'migrants', 'fire', 'festival', 'scholar', 'mercenaries']
  const neighbours = state.nations.filter((n) => n.alive && !n.isPlayer && !player.wars.includes(n.id)
    && state.provinces.some((q) => q.ownerId === player.id && q.neighbors.some((i) => state.provinces[i].ownerId === n.id)))
  if (neighbours.length) pool.push('borderDispute')
  const id = pick(state, pool)
  if (id === 'fire' && !BUILDING_ORDER.some((b) => p.buildings[b] > 0)) return eventFor(state, 'harvest', p)
  if (id === 'borderDispute') return eventFor(state, id, null, { nationId: pick(state, neighbours).id })
  return eventFor(state, id, p)
}

export function applyEventChoice(state: GameState, ev: GameEvent, choice: number): void {
  const player = playerNation(state)
  const r = player.resources
  const p = ev.provinceId !== undefined ? state.provinces[ev.provinceId] : null
  const owned = ownedProvinces(state, player.id)
  const shrink = (prov: Province, frac: number) => { prov.population = Math.max(300, Math.round(prov.population * (1 - frac))) }
  switch (ev.id) {
    case 'plague':
      if (choice === 0 && r.gold >= 50) { r.gold -= 50; shrink(p!, 0.08); p!.unrest = Math.min(100, p!.unrest + 10) }
      else shrink(p!, hasTech(player, 'medicine') ? 0.09 : 0.18)
      break
    case 'harvest':
      if (choice === 0) r.food += 150
      else { r.food += 60; p!.unrest = Math.max(0, p!.unrest - 8) }
      break
    case 'goldVein':
      if (choice === 0) r.gold += 120
      else { r.gold += 40; p!.unrest = Math.max(0, p!.unrest - 10) }
      break
    case 'bandits':
      if (choice === 0) {
        if (armySize(p!.garrison) >= 2) {
          const k = (['militia', 'archers', 'infantry', 'cavalry', 'siege'] as const).find((u) => p!.garrison[u] > 0)!
          p!.garrison[k] -= 1
          p!.unrest = Math.max(0, p!.unrest - 5)
        } else { p!.unrest = Math.min(100, p!.unrest + 15); p!.devastation = Math.min(1, p!.devastation + 0.1) }
      } else if (choice === 1 && r.gold >= 80) r.gold -= 80
      else { p!.unrest = Math.min(100, p!.unrest + 15); p!.devastation = Math.min(1, p!.devastation + 0.1) }
      break
    case 'migrants':
      if (choice === 0) { p!.population += 1500; p!.unrest = Math.min(100, p!.unrest + 8) }
      break
    case 'fire': {
      if (choice === 0 && r.gold >= 60) { r.gold -= 60; break }
      const built = BUILDING_ORDER.filter((b) => p!.buildings[b] > 0)
      if (built.length) {
        const b: BuildingKey = pick(state, built)
        p!.buildings[b] -= 1
        log(state, 'event', `A ${BUILDINGS[b].name.toLowerCase()} in ${p!.name} burned down.`)
      }
      break
    }
    case 'festival':
      if (choice === 0 && r.gold >= 60) { r.gold -= 60; for (const q of owned) q.unrest = Math.max(0, q.unrest - 10) }
      else for (const q of owned) q.unrest = Math.min(100, q.unrest + 3)
      break
    case 'scholar':
      if (choice === 0 && r.gold >= 70) { r.gold -= 70; player.researchProgress += 40 }
      break
    case 'mercenaries':
      if (choice === 0 && r.gold >= 130) { r.gold -= 130; p!.garrison.infantry += 4 }
      break
    case 'borderDispute':
      if (choice === 0) changeRelation(state, player.id, ev.nationId!, 12)
      else { changeRelation(state, player.id, ev.nationId!, -20); for (const q of owned) q.unrest = Math.max(0, q.unrest - 5) }
      break
  }
  log(state, 'event', `${ev.title}: ${ev.choices[choice]?.label ?? 'resolved'}.`)
}
