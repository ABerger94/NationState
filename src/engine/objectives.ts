import type { GameState, Nation } from './types'
import { armySize, log, nationArmy, ownedProvinces, playerNation } from './helpers'

export interface ObjectiveDef {
  id: string
  title: string
  description: string
  reward: number
  check: (state: GameState, player: Nation) => { done: boolean; progress?: string }
}

const count = (n: number, goal: number) => ({ done: n >= goal, progress: `${Math.min(n, goal)} / ${goal}` })

export const OBJECTIVES: ObjectiveDef[] = [
  { id: 'build-1', title: 'Lay the first stone', description: 'Construct any building. Select a province and use the Buildings list.', reward: 30, check: (_, p) => count(p.stats.built, 1) },
  { id: 'research-1', title: 'Found a school', description: 'Choose a technology to research in the Nation tab.', reward: 20, check: (_, p) => ({ done: p.research !== null || p.techs.length > 0 }) },
  { id: 'recruit-3', title: 'Call to arms', description: 'Recruit three units. Professional troops need a barracks.', reward: 40, check: (_, p) => count(p.stats.recruited, 3) },
  { id: 'conquer-1', title: 'Manifest destiny', description: 'Conquer an independent province. Select your capital and attack a red-ringed neighbour.', reward: 80, check: (_, p) => count(p.stats.tribalConquests, 1) },
  { id: 'build-5', title: 'Builders of the realm', description: 'Construct five buildings in total.', reward: 60, check: (_, p) => count(p.stats.built, 5) },
  { id: 'prov-6', title: 'A growing realm', description: 'Rule six provinces.', reward: 100, check: (s, p) => count(ownedProvinces(s, p.id).length, 6) },
  { id: 'tech-2', title: 'Age of discovery', description: 'Discover two technologies.', reward: 80, check: (_, p) => count(p.techs.length, 2) },
  { id: 'granary', title: 'Against the lean years', description: 'Build a granary anywhere.', reward: 50, check: (s, p) => ({ done: ownedProvinces(s, p.id).some((q) => q.buildings.granary > 0) }) },
  { id: 'walls-2', title: 'Stone and mortar', description: 'Raise walls to level 2 in any province.', reward: 80, check: (s, p) => ({ done: ownedProvinces(s, p.id).some((q) => q.buildings.walls >= 2) }) },
  { id: 'univ', title: 'Halls of learning', description: 'Build a university.', reward: 80, check: (s, p) => ({ done: ownedProvinces(s, p.id).some((q) => q.buildings.university > 0) }) },
  { id: 'army-24', title: 'A standing army', description: 'Field 24 units at once.', reward: 100, check: (s, p) => count(armySize(nationArmy(s, p.id)), 24) },
  { id: 'prov-10', title: 'Regional power', description: 'Rule ten provinces.', reward: 150, check: (s, p) => count(ownedProvinces(s, p.id).length, 10) },
  { id: 'luxury', title: 'Taste for finery', description: 'Control a luxury resource: gems, spices or vineyards.', reward: 100, check: (s, p) => ({ done: ownedProvinces(s, p.id).some((q) => q.resource === 'gems' || q.resource === 'spices' || q.resource === 'wine') }) },
  { id: 'ally', title: 'Friends abroad', description: 'Form an alliance. Relations of 60 or more are needed; gifts help.', reward: 120, check: (_, p) => ({ done: p.allies.length > 0 }) },
  { id: 'capital-16k', title: 'A great city', description: 'Grow your capital to 16,000 people.', reward: 120, check: (s, p) => { const cap = s.provinces[p.capitalId]; return { done: cap.ownerId === p.id && cap.population >= 16000, progress: `${Math.min(16000, cap.population).toLocaleString('en-US')} / 16,000` } } },
  { id: 'defend-1', title: 'Hold the line', description: 'Win a battle as the defender.', reward: 150, check: (_, p) => count(p.stats.defensiveWins, 1) },
  { id: 'nation-conquest', title: 'Spoils of war', description: 'Take a province from a rival nation.', reward: 200, check: (_, p) => count(p.stats.nationConquests, 1) },
  { id: 'tech-6', title: 'Enlightenment', description: 'Discover six technologies.', reward: 200, check: (_, p) => count(p.techs.length, 6) },
  { id: 'prov-16', title: 'An empire rises', description: 'Rule sixteen provinces.', reward: 250, check: (s, p) => count(ownedProvinces(s, p.id).length, 16) },
  { id: 'destroy', title: 'Delenda est', description: 'Wipe a rival nation from the map.', reward: 400, check: (s) => ({ done: s.nations.some((n) => !n.isPlayer && !n.alive) }) },
  { id: 'prov-25', title: 'Hegemon', description: 'Rule twenty-five provinces.', reward: 400, check: (s, p) => count(ownedProvinces(s, p.id).length, 25) },
]

export function activeObjectives(state: GameState): ObjectiveDef[] {
  const done = new Set(state.objectives.map((o) => o.id))
  return OBJECTIVES.filter((o) => !done.has(o.id)).slice(0, 3)
}

/** Completes any active objective whose condition now holds, pays the reward, and returns the completed ids. */
export function checkObjectives(state: GameState): string[] {
  const player = playerNation(state)
  if (!player.alive) return []
  const completed: string[] = []
  for (let guard = 0; guard < 6; guard++) {
    const active = activeObjectives(state)
    const hit = active.find((o) => o.check(state, player).done)
    if (!hit) break
    state.objectives.push({ id: hit.id, turn: state.turn })
    player.resources.gold += hit.reward
    log(state, 'event', `Objective complete: ${hit.title} (+${hit.reward} gold).`, true)
    completed.push(hit.id)
  }
  return completed
}
