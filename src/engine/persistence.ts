import type { GameState } from './types'
import { SAVE_KEY } from './data'

export function saveGame(state: GameState | null): void {
  try {
    if (state) localStorage.setItem(SAVE_KEY, JSON.stringify(state))
    else localStorage.removeItem(SAVE_KEY)
  } catch {
    /* storage unavailable */
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as GameState
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.provinces)) return null
    return parsed
  } catch {
    return null
  }
}
