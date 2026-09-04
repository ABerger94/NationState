export type Resource = 'gold' | 'food' | 'wood' | 'iron'
export type Terrain = 'plains' | 'forest' | 'hills' | 'mountains' | 'coast'
export type BuildingKey =
  | 'farm' | 'lumberMill' | 'mine' | 'market' | 'granary'
  | 'barracks' | 'walls' | 'university' | 'temple'
export type UnitKey = 'militia' | 'infantry' | 'archers' | 'cavalry' | 'siege'
export type TechKey =
  | 'agriculture' | 'currency' | 'ironWorking' | 'masonry' | 'tactics' | 'horsemanship'
  | 'medicine' | 'philosophy' | 'logistics' | 'engineering' | 'banking' | 'professionalArmy'
export type Personality = 'aggressive' | 'builder' | 'merchant' | 'defensive'
export type Difficulty = 'easy' | 'normal' | 'hard'
export type ResourceKind = 'horses' | 'gems' | 'spices' | 'wine' | 'fish' | 'ore' | 'timber' | 'fertile'
export type EconomyPolicy = 'agrarian' | 'mercantile' | 'industrious'
export type MilitaryPolicy = 'levies' | 'drilled' | 'expansionist'
export type SocietyPolicy = 'tolerant' | 'scholarly' | 'devout'
export type PolicyCategory = 'economy' | 'military' | 'society'
export interface Policies { economy: EconomyPolicy | null; military: MilitaryPolicy | null; society: SocietyPolicy | null; changedTurn: number }
export interface NationStats { built: number; recruited: number; battlesWon: number; defensiveWins: number; tribalConquests: number; nationConquests: number }
export interface CompletedObjective { id: string; turn: number }

export type Army = Record<UnitKey, number>

/** A mobile stack of troops standing in a province. Garrisons defend; field armies attack. */
export interface FieldArmy {
  id: number
  name: string
  ownerId: number
  provinceId: number
  units: Army
  movement: number
  maxMovement: number
  morale: number
}
export type Resources = Record<Resource, number>

export interface Province {
  id: number
  name: string
  col: number
  row: number
  terrain: Terrain
  resource: ResourceKind | null
  ownerId: number | null
  population: number
  unrest: number
  devastation: number
  buildings: Record<BuildingKey, number>
  garrison: Army
  neighbors: number[]
  conqueredTurn: number | null
  /** Turn in which this garrison attacked or was moved into after a conquest; it cannot act again that turn. */
  lockedTurn: number
  isCapital: boolean
}

export interface Nation {
  id: number
  name: string
  adjective: string
  color: string
  isPlayer: boolean
  alive: boolean
  personality: Personality
  resources: Resources
  taxRate: number
  warWeariness: number
  techs: TechKey[]
  research: TechKey | null
  researchProgress: number
  relations: Record<number, number>
  wars: number[]
  allies: number[]
  /** Nations that have offered peace to this nation. */
  peaceOffersFrom: number[]
  capitalId: number
  provincesLost: number
  provincesGained: number
  policies: Policies
  stats: NationStats
}

export type LogKind = 'info' | 'war' | 'economy' | 'diplomacy' | 'event' | 'battle'
export interface LogEntry { id: number; turn: number; kind: LogKind; text: string; important: boolean }

export interface BattleRound {
  round: number
  attackerPower: number
  defenderPower: number
  attackerLosses: number
  defenderLosses: number
  attackerMorale: number
  defenderMorale: number
}

export interface BattleReport {
  id: number
  turn: number
  provinceId: number
  provinceName: string
  terrain: Terrain
  attackerId: number | null
  defenderId: number | null
  attackerName: string
  defenderName: string
  attackerStart: Army
  defenderStart: Army
  attackerEnd: Army
  defenderEnd: Army
  rounds: BattleRound[]
  winner: 'attacker' | 'defender'
  conquered: boolean
  kind: 'battle' | 'rebellion'
  involvesPlayer: boolean
}

export interface EventChoice { label: string; description: string }
export interface GameEvent {
  id: string
  title: string
  text: string
  provinceId?: number
  nationId?: number
  choices: EventChoice[]
}

export interface GameState {
  version: number
  seed: number
  rng: number
  turn: number
  startYear: number
  difficulty: Difficulty
  cols: number
  rows: number
  provinces: Province[]
  nations: Nation[]
  armies: FieldArmy[]
  log: LogEntry[]
  battles: BattleReport[]
  nextId: number
  pendingEvent: GameEvent | null
  /** Battle ids resolved during the last end-turn that involve the player. */
  lastTurnBattles: number[]
  winner: number | null
  gameOver: boolean
  gameOverReason: string | null
  objectives: CompletedObjective[]
}
