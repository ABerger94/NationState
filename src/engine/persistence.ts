import type { GameState } from './types'
import { AI_NATIONS, PLAYER_COLOR, SAVE_KEY } from './data'
import { defaultPolicies, emptyStats } from './helpers'

export function saveGame(state: GameState | null): void {
  try {
    if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state))
    else localStorage.removeItem(SAVE_KEY)
  } catch {
    /* storage unavailable */
  }
}

/** Brings saves from earlier versions up to the current shape. */
export function migrate(raw: GameState): GameState {
  const s = raw
  s.objectives ??= []
  s.armies ??= []
  for (const a of s.armies) a.siege ??= null
  for (const n of s.nations) {
    n.policies ??= defaultPolicies()
    n.stats ??= emptyStats()
    if (n.isPlayer) n.color = PLAYER_COLOR
    else {
      const def = AI_NATIONS.find((d) => d.name === n.name)
      if (def) n.color = def.color
    }
  }
  for (const p of s.provinces) p.resource ??= null
  for (const e of s.log) e.important ??= true
  s.version = 3
  return s
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GameState
    if (!parsed || !Array.isArray(parsed.provinces) || !Array.isArray(parsed.nations)) return null
    if (![1, 2, 3].includes(parsed.version)) return null
    return migrate(parsed)
  } catch {
    return null
  }
}
