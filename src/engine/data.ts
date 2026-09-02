import type { BuildingKey, Difficulty, Personality, Resources, TechKey, Terrain, UnitKey } from './types'

export const COLS = 11
export const ROWS = 8
export const NATION_COUNT = 6
export const MAX_TURNS = 150
export const CONQUEST_SHARE = 0.6
export const START_YEAR = 1000
export const SAVE_KEY = 'nationstate-save-v1'

export interface TerrainDef {
  name: string; food: number; wood: number; iron: number; gold: number
  capacity: number; defense: number; cavalry: number; color: string; weight: number
}
export const TERRAINS: Record<Terrain, TerrainDef> = {
  plains: { name: 'Plains', food: 3.0, wood: 0.4, iron: 0.2, gold: 0, capacity: 30000, defense: 1.0, cavalry: 1.3, color: '#7aa25a', weight: 34 },
  forest: { name: 'Forest', food: 1.4, wood: 2.0, iron: 0.3, gold: 0, capacity: 18000, defense: 1.15, cavalry: 0.7, color: '#3f7a48', weight: 24 },
  hills: { name: 'Hills', food: 1.5, wood: 0.8, iron: 1.5, gold: 0, capacity: 15000, defense: 1.3, cavalry: 0.8, color: '#a08a5a', weight: 18 },
  mountains: { name: 'Mountains', food: 0.6, wood: 0.5, iron: 2.5, gold: 0.2, capacity: 8000, defense: 1.5, cavalry: 0.5, color: '#8b8b8b', weight: 10 },
  coast: { name: 'Coast', food: 2.4, wood: 0.6, iron: 0.2, gold: 0.6, capacity: 25000, defense: 1.0, cavalry: 1.1, color: '#5b9bb5', weight: 14 },
}

export interface BuildingDef { name: string; description: string; cost: Resources; max: number }
export const BUILDINGS: Record<BuildingKey, BuildingDef> = {
  farm: { name: 'Farm', description: '+30% food and +25% population capacity per level.', cost: { gold: 60, food: 0, wood: 20, iron: 0 }, max: 5 },
  lumberMill: { name: 'Lumber Mill', description: '+40% wood production per level.', cost: { gold: 50, food: 0, wood: 10, iron: 0 }, max: 4 },
  mine: { name: 'Mine', description: '+40% iron production per level.', cost: { gold: 80, food: 0, wood: 20, iron: 0 }, max: 4 },
  market: { name: 'Market', description: '+25% tax income per level.', cost: { gold: 100, food: 0, wood: 30, iron: 0 }, max: 4 },
  granary: { name: 'Granary', description: '+300 food storage, +30% population capacity, halves famine losses here.', cost: { gold: 70, food: 0, wood: 40, iron: 0 }, max: 2 },
  barracks: { name: 'Barracks', description: 'Required to train professional troops. Garrison fights +8% harder per level.', cost: { gold: 90, food: 0, wood: 30, iron: 10 }, max: 3 },
  walls: { name: 'Walls', description: '+30% defence per level. Siege engines can breach them.', cost: { gold: 120, food: 0, wood: 40, iron: 20 }, max: 3 },
  university: { name: 'University', description: '+3 science per turn per level.', cost: { gold: 150, food: 0, wood: 50, iron: 0 }, max: 2 },
  temple: { name: 'Temple', description: '-3 unrest per turn per level and steadier stability.', cost: { gold: 80, food: 0, wood: 30, iron: 0 }, max: 2 },
}
export const BUILDING_ORDER: BuildingKey[] = ['farm', 'lumberMill', 'mine', 'market', 'granary', 'barracks', 'walls', 'university', 'temple']

export interface UnitDef {
  name: string; description: string; attack: number; defense: number; cost: Resources
  upkeepGold: number; upkeepFood: number; men: number; requiresBarracks: boolean
}
export const UNITS: Record<UnitKey, UnitDef> = {
  militia: { name: 'Militia', description: 'Cheap levies. Weak on the attack, passable behind walls.', attack: 2, defense: 3, cost: { gold: 20, food: 0, wood: 0, iron: 0 }, upkeepGold: 0.5, upkeepFood: 0.2, men: 100, requiresBarracks: false },
  infantry: { name: 'Infantry', description: 'Professional line troops. The backbone of any army.', attack: 5, defense: 6, cost: { gold: 50, food: 0, wood: 0, iron: 10 }, upkeepGold: 1, upkeepFood: 0.2, men: 100, requiresBarracks: true },
  archers: { name: 'Archers', description: 'Devastating opening volley, fragile in melee. Strong in forests.', attack: 6, defense: 3, cost: { gold: 60, food: 0, wood: 10, iron: 5 }, upkeepGold: 1, upkeepFood: 0.2, men: 100, requiresBarracks: true },
  cavalry: { name: 'Cavalry', description: 'Shock troops. Dominant on plains, poor in rough terrain.', attack: 9, defense: 5, cost: { gold: 120, food: 0, wood: 0, iron: 15 }, upkeepGold: 2, upkeepFood: 0.4, men: 100, requiresBarracks: true },
  siege: { name: 'Siege Engines', description: 'Each engine negates half a wall level. Helpless if caught alone.', attack: 4, defense: 1, cost: { gold: 200, food: 0, wood: 30, iron: 30 }, upkeepGold: 3, upkeepFood: 0.2, men: 50, requiresBarracks: true },
}
export const UNIT_ORDER: UnitKey[] = ['militia', 'infantry', 'archers', 'cavalry', 'siege']

export interface TechDef { name: string; cost: number; description: string; requires?: TechKey; military: boolean }
export const TECHS: Record<TechKey, TechDef> = {
  agriculture: { name: 'Agriculture', cost: 30, description: '+20% food production.', military: false },
  currency: { name: 'Currency', cost: 40, description: '+20% tax income.', military: false },
  ironWorking: { name: 'Iron Working', cost: 50, description: '+15% attack for all units.', military: true },
  masonry: { name: 'Masonry', cost: 50, description: 'Walls give +45% defence per level instead of +30%.', military: true },
  tactics: { name: 'Tactics', cost: 60, description: '+10% defence for all units.', military: true },
  horsemanship: { name: 'Horsemanship', cost: 60, description: '+20% cavalry attack.', requires: 'ironWorking', military: true },
  medicine: { name: 'Medicine', cost: 70, description: '+30% population growth; plagues are half as deadly.', requires: 'agriculture', military: false },
  philosophy: { name: 'Philosophy', cost: 70, description: '-1 unrest per turn everywhere and +5 stability.', military: false },
  logistics: { name: 'Logistics', cost: 80, description: 'Unit upkeep -20%; troop transfers cost half.', requires: 'currency', military: true },
  engineering: { name: 'Engineering', cost: 90, description: 'Buildings 15% cheaper; siege engines +50% attack.', requires: 'masonry', military: false },
  banking: { name: 'Banking', cost: 110, description: '+30% tax income.', requires: 'currency', military: false },
  professionalArmy: { name: 'Professional Army', cost: 120, description: '+10% attack and defence for all units.', requires: 'tactics', military: true },
}
export const TECH_ORDER: TechKey[] = [
  'agriculture', 'currency', 'ironWorking', 'masonry', 'tactics', 'horsemanship',
  'medicine', 'philosophy', 'logistics', 'engineering', 'banking', 'professionalArmy',
]

export interface AiNationDef { name: string; adjective: string; color: string; personality: Personality }
export const AI_NATIONS: AiNationDef[] = [
  { name: 'Kingdom of Valoria', adjective: 'Valorian', color: '#c0392b', personality: 'aggressive' },
  { name: 'Kethrand Republic', adjective: 'Kethrandi', color: '#8e44ad', personality: 'merchant' },
  { name: 'Ostmark', adjective: 'Ostmarker', color: '#2980b9', personality: 'defensive' },
  { name: 'Sarnian Empire', adjective: 'Sarnian', color: '#d35400', personality: 'aggressive' },
  { name: 'Drakmoor Clans', adjective: 'Drakmoori', color: '#16a085', personality: 'builder' },
  { name: 'Illyrion', adjective: 'Illyrian', color: '#6c7a89', personality: 'merchant' },
  { name: 'Cassar Dominion', adjective: 'Cassarian', color: '#b7950b', personality: 'defensive' },
]
export const PLAYER_COLOR = '#e0b341'

export interface PersonalityDef {
  label: string; aggression: number; armyRatio: number; attackRatio: number; reserve: number
  buildPriority: BuildingKey[]
}
export const PERSONALITIES: Record<Personality, PersonalityDef> = {
  aggressive: { label: 'Aggressive', aggression: 1.0, armyRatio: 0.9, attackRatio: 1.2, reserve: 40, buildPriority: ['barracks', 'farm', 'mine', 'market', 'walls', 'granary', 'temple', 'lumberMill', 'university'] },
  builder: { label: 'Builder', aggression: 0.25, armyRatio: 0.55, attackRatio: 1.6, reserve: 80, buildPriority: ['farm', 'granary', 'market', 'lumberMill', 'university', 'temple', 'mine', 'barracks', 'walls'] },
  merchant: { label: 'Mercantile', aggression: 0.4, armyRatio: 0.6, attackRatio: 1.5, reserve: 100, buildPriority: ['market', 'farm', 'university', 'lumberMill', 'granary', 'barracks', 'temple', 'mine', 'walls'] },
  defensive: { label: 'Defensive', aggression: 0.3, armyRatio: 0.75, attackRatio: 1.7, reserve: 60, buildPriority: ['walls', 'farm', 'barracks', 'temple', 'granary', 'mine', 'market', 'lumberMill', 'university'] },
}

export interface DifficultyDef { label: string; aiIncome: number; aiStartBonus: number; description: string }
export const DIFFICULTIES: Record<Difficulty, DifficultyDef> = {
  easy: { label: 'Easy', aiIncome: 0.8, aiStartBonus: 0.8, description: 'Rival nations earn 20% less and start poorer.' },
  normal: { label: 'Normal', aiIncome: 1.0, aiStartBonus: 1.0, description: 'Everyone plays by the same rules.' },
  hard: { label: 'Hard', aiIncome: 1.35, aiStartBonus: 1.6, description: 'Rival nations earn 35% more and start richer.' },
}

/** Gold per unit when selling to / buying from foreign merchants. */
export const TRADE_PRICES: Record<'food' | 'wood' | 'iron', { sell: number; buy: number }> = {
  food: { sell: 0.3, buy: 0.8 },
  wood: { sell: 0.4, buy: 0.9 },
  iron: { sell: 0.6, buy: 1.3 },
}

export const NAME_PARTS = {
  starts: ['Ald', 'Bre', 'Cal', 'Dor', 'El', 'Fen', 'Gal', 'Hal', 'Is', 'Kar', 'Lor', 'Mar', 'Nor', 'Or', 'Pel', 'Ros', 'Sel', 'Tor', 'Ul', 'Var', 'Wes', 'Yor'],
  mids: ['a', 'e', 'i', 'o', 'u', 'an', 'en', 'in', 'or', 'ur', 'ar', 'el'],
  ends: ['ford', 'burg', 'haven', 'mark', 'wick', 'stead', 'dale', 'moor', 'holm', 'gate', 'field', 'shire', 'wold', 'ness', 'by', 'ton'],
}
