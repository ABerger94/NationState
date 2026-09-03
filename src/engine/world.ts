import type { Difficulty, GameState, Nation, Province, ResourceKind, Terrain } from './types'
import {
  AI_NATIONS, COLS, DIFFICULTIES, NAME_PARTS, NATION_COUNT, PLAYER_COLOR, RESOURCES, RESOURCE_ORDER, ROWS, START_YEAR, TERRAINS,
} from './data'
import { defaultPolicies, emptyArmy, emptyStats, log } from './helpers'
import { nextRand, pick, randInt, shuffle } from './rng'

const TERRAIN_KEYS = Object.keys(TERRAINS) as Terrain[]

function weightedTerrain(state: GameState, edge: boolean): Terrain {
  if (edge && nextRand(state) < 0.4) return 'coast'
  const total = TERRAIN_KEYS.reduce((s, k) => s + (k === 'coast' ? (edge ? TERRAINS[k].weight : 3) : TERRAINS[k].weight), 0)
  let r = nextRand(state) * total
  for (const k of TERRAIN_KEYS) {
    const w = k === 'coast' ? (edge ? TERRAINS[k].weight : 3) : TERRAINS[k].weight
    r -= w
    if (r <= 0) return k
  }
  return 'plains'
}

function makeName(state: GameState, used: Set<string>): string {
  for (let i = 0; i < 50; i++) {
    const useMid = nextRand(state) < 0.4
    const name = pick(state, NAME_PARTS.starts) + (useMid ? pick(state, NAME_PARTS.mids) : '') + pick(state, NAME_PARTS.ends)
    if (!used.has(name)) {
      used.add(name)
      return name
    }
  }
  const fallback = `Province ${used.size + 1}`
  used.add(fallback)
  return fallback
}

/** Odd-r offset neighbours. */
export function hexNeighbors(col: number, row: number): Array<[number, number]> {
  const odd = row & 1
  const deltas: Array<[number, number]> = odd
    ? [[0, -1], [1, -1], [-1, 0], [1, 0], [0, 1], [1, 1]]
    : [[-1, -1], [0, -1], [-1, 0], [1, 0], [-1, 1], [0, 1]]
  return deltas
    .map(([dc, dr]) => [col + dc, row + dr] as [number, number])
    .filter(([c, r]) => c >= 0 && c < COLS && r >= 0 && r < ROWS)
}

function emptyBuildings() {
  return { farm: 0, lumberMill: 0, mine: 0, market: 0, granary: 0, barracks: 0, walls: 0, university: 0, temple: 0 }
}

function settle(state: GameState, nation: Nation, p: Province, capital: boolean, bonus: number) {
  p.ownerId = nation.id
  p.unrest = 5
  p.devastation = 0
  if (capital) {
    p.isCapital = true
    p.population = Math.round(12000 * (0.9 + 0.2 * bonus))
    p.buildings.farm = 1
    p.buildings.market = 1
    p.buildings.barracks = 1
    p.buildings.walls = 1
    p.garrison = { ...emptyArmy(), infantry: 4, archers: 2, militia: 2 }
    nation.capitalId = p.id
  } else {
    p.population = randInt(state, 6000, 9000)
    if (nextRand(state) < 0.5) p.buildings.farm = 1
    p.garrison = { ...emptyArmy(), infantry: 1, militia: 2 }
  }
  if (p.terrain === 'mountains') p.population = Math.round(p.population * 0.6)
}

export function createGame(opts: { seed: number; playerName: string; difficulty: Difficulty }): GameState {
  const seed = opts.seed | 0 || 1
  const state: GameState = {
    version: 1, seed, rng: seed, turn: 1, startYear: START_YEAR, difficulty: opts.difficulty,
    cols: COLS, rows: ROWS, provinces: [], nations: [], log: [], battles: [], nextId: 1,
    pendingEvent: null, lastTurnBattles: [], winner: null, gameOver: false, gameOverReason: null, objectives: [],
  }
  const used = new Set<string>()

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const edge = row === 0 || col === 0 || row === ROWS - 1 || col === COLS - 1
      const terrain = weightedTerrain(state, edge)
      const id = state.provinces.length
      const pop = Math.round(randInt(state, 1500, 5000) * (terrain === 'mountains' ? 0.6 : 1))
      state.provinces.push({
        id, name: makeName(state, used), col, row, terrain, resource: null, ownerId: null, population: pop,
        unrest: 0, devastation: 0, buildings: emptyBuildings(),
        garrison: { ...emptyArmy(), militia: Math.max(1, Math.round(pop / 1200)) },
        neighbors: [], conqueredTurn: null, lockedTurn: 0, isCapital: false,
      })
    }
  }
  for (const p of state.provinces) {
    p.neighbors = hexNeighbors(p.col, p.row).map(([c, r]) => r * COLS + c)
    if (nextRand(state) < 0.3) {
      const options: ResourceKind[] = RESOURCE_ORDER.filter((k) => RESOURCES[k].terrains.includes(p.terrain))
      if (options.length) p.resource = pick(state, options)
    }
  }

  const diff = DIFFICULTIES[opts.difficulty]
  const seedSpots: Array<[number, number]> = shuffle(state, [[1, 1], [9, 1], [1, 6], [9, 6], [5, 1], [5, 6]])
  const aiDefs = shuffle(state, AI_NATIONS.slice()).slice(0, NATION_COUNT - 1)

  for (let i = 0; i < NATION_COUNT; i++) {
    const isPlayer = i === 0
    const def = isPlayer ? null : aiDefs[i - 1]
    const bonus = isPlayer ? 1 : diff.aiStartBonus
    const nation: Nation = {
      id: i,
      name: isPlayer ? (opts.playerName.trim() || 'Your Realm') : def!.name,
      adjective: isPlayer ? 'Our' : def!.adjective,
      color: isPlayer ? PLAYER_COLOR : def!.color,
      isPlayer, alive: true,
      personality: isPlayer ? 'builder' : def!.personality,
      resources: { gold: Math.round(300 * bonus), food: Math.round(250 * bonus), wood: Math.round(120 * bonus), iron: Math.round(60 * bonus) },
      taxRate: 20, warWeariness: 0, techs: [], research: null, researchProgress: 0,
      relations: {}, wars: [], allies: [], peaceOffersFrom: [], capitalId: 0,
      provincesLost: 0, provincesGained: 0, policies: defaultPolicies(), stats: emptyStats(),
    }
    state.nations.push(nation)

    const [sc, sr] = seedSpots[i]
    const col = Math.max(0, Math.min(COLS - 1, sc + randInt(state, -1, 1)))
    const row = Math.max(0, Math.min(ROWS - 1, sr + randInt(state, -1, 1)))
    let capital = state.provinces[row * COLS + col]
    if (capital.ownerId !== null) capital = state.provinces[sr * COLS + sc]
    if (capital.terrain === 'mountains') capital.terrain = 'hills'
    settle(state, nation, capital, true, bonus)
    const free = shuffle(state, capital.neighbors.map((n) => state.provinces[n]).filter((p) => p.ownerId === null))
    for (const p of free.slice(0, 2)) settle(state, nation, p, false, bonus)
  }

  for (const a of state.nations) {
    for (const b of state.nations) {
      if (a.id === b.id) continue
      if (a.relations[b.id] === undefined) {
        const v = randInt(state, -25, 25)
        a.relations[b.id] = v
        b.relations[a.id] = v
      }
    }
  }

  log(state, 'info', `The year is ${START_YEAR}. ${state.nations[0].name} takes its place among the nations of the world.`)
  return state
}
