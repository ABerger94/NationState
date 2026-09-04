import type { Difficulty, GameState, Nation, Province, ResourceKind, Terrain } from './types'
import type { MapSize } from './data'
import {
  AI_NATIONS, COLS, DIFFICULTIES, MAP_SIZES, NAME_PARTS, PLAYER_COLOR, RESOURCES, RESOURCE_ORDER, ROWS, START_YEAR, TERRAINS,
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
export function hexNeighbors(col: number, row: number, cols = COLS, rows = ROWS): Array<[number, number]> {
  const odd = row & 1
  const deltas: Array<[number, number]> = odd
    ? [[0, -1], [1, -1], [-1, 0], [1, 0], [0, 1], [1, 1]]
    : [[-1, -1], [0, -1], [-1, 0], [1, 0], [-1, 1], [0, 1]]
  return deltas
    .map(([dc, dr]) => [col + dc, row + dr] as [number, number])
    .filter(([c, r]) => c >= 0 && c < cols && r >= 0 && r < rows)
}

/** Evenly spread starting positions for however many nations the map holds. */
function startingSpots(state: GameState, count: number, cols: number, rows: number): Array<[number, number]> {
  const gridCols = Math.ceil(Math.sqrt(count))
  const gridRows = Math.ceil(count / gridCols)
  const spots: Array<[number, number]> = []
  for (let i = 0; i < count; i++) {
    const gx = i % gridCols
    const gy = Math.floor(i / gridCols)
    const col = Math.round(((gx + 0.5) / gridCols) * cols)
    const row = Math.round(((gy + 0.5) / gridRows) * rows)
    spots.push([clampInt(col, 1, cols - 2), clampInt(row, 1, rows - 2)])
  }
  return shuffle(state, spots)
}

const clampInt = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

/** Carves rivers from the high ground down toward the sea, marking the edges they run along. */
function carveRivers(state: GameState): void {
  const sources = state.provinces.filter((p) => p.terrain === 'mountains' || p.terrain === 'hills')
  const count = Math.max(1, Math.round(state.provinces.length / 14))
  for (const src of shuffle(state, sources).slice(0, count)) {
    let current = src
    const visited = new Set<number>([current.id])
    const length = randInt(state, 3, 7)
    for (let step = 0; step < length; step++) {
      const downhill = current.neighbors
        .map((i) => state.provinces[i])
        .filter((q) => !visited.has(q.id) && TERRAIN_ORDER[q.terrain] <= TERRAIN_ORDER[current.terrain])
      if (!downhill.length) break
      const next = pick(state, downhill)
      current.rivers.push(next.id)
      next.rivers.push(current.id)
      visited.add(next.id)
      if (next.terrain === 'coast') break
      current = next
    }
  }
}

/** Height ranking used to make rivers flow downhill. */
const TERRAIN_ORDER: Record<Terrain, number> = { mountains: 4, hills: 3, forest: 2, plains: 1, coast: 0 }

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

export function createGame(opts: { seed: number; playerName: string; difficulty: Difficulty; size?: MapSize }): GameState {
  const seed = opts.seed | 0 || 1
  const sizeDef = MAP_SIZES[opts.size ?? 'small']
  const cols = sizeDef.cols
  const rows = sizeDef.rows
  const nationCount = sizeDef.nations
  const state: GameState = {
    version: 1, seed, rng: seed, turn: 1, startYear: START_YEAR, difficulty: opts.difficulty,
    cols, rows, maxTurns: sizeDef.maxTurns, provinces: [], nations: [], armies: [], log: [], battles: [], nextId: 1,
    pendingEvent: null, lastTurnBattles: [], winner: null, gameOver: false, gameOverReason: null, objectives: [],
  }
  const used = new Set<string>()

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const edge = row === 0 || col === 0 || row === rows - 1 || col === cols - 1
      const terrain = weightedTerrain(state, edge)
      const id = state.provinces.length
      const pop = Math.round(randInt(state, 1500, 5000) * (terrain === 'mountains' ? 0.6 : 1))
      state.provinces.push({
        id, name: makeName(state, used), col, row, terrain, resource: null, rivers: [], pass: false, ownerId: null, population: pop,
        unrest: 0, devastation: 0, buildings: emptyBuildings(), development: 1, construction: null,
        garrison: { ...emptyArmy(), militia: Math.max(1, Math.round(pop / 1200)) },
        neighbors: [], conqueredTurn: null, lockedTurn: 0, isCapital: false,
      })
    }
  }
  for (const p of state.provinces) {
    p.neighbors = hexNeighbors(p.col, p.row, cols, rows).map(([c, r]) => r * cols + c)
    if (p.terrain === 'mountains' && nextRand(state) < 0.3) p.pass = true
    if (nextRand(state) < 0.3) {
      const options: ResourceKind[] = RESOURCE_ORDER.filter((k) => RESOURCES[k].terrains.includes(p.terrain))
      if (options.length) p.resource = pick(state, options)
    }
  }

  carveRivers(state)

  const diff = DIFFICULTIES[opts.difficulty]
  const seedSpots = startingSpots(state, nationCount, cols, rows)
  const aiDefs = shuffle(state, AI_NATIONS.slice()).slice(0, nationCount - 1)

  for (let i = 0; i < nationCount; i++) {
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
    const col = clampInt(sc + randInt(state, -1, 1), 0, cols - 1)
    const row = clampInt(sr + randInt(state, -1, 1), 0, rows - 1)
    let capital = state.provinces[row * cols + col]
    if (capital.ownerId !== null) capital = state.provinces[sr * cols + sc]
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
