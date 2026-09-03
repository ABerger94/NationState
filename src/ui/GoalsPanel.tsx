import type { GameState } from '../engine/types'
import type { Advice } from '../advisor'
import { Objectives } from './Objectives'
import { Advisor } from './Advisor'
import { Legend } from './Legend'

interface Props { state: GameState; advice: Advice[]; onAdvice: (a: Advice) => void; onFocusNation: (id: number) => void }

/** Mobile tab that gathers the floating desktop widgets: objectives, advisor and the nation legend. */
export function GoalsPanel({ state, advice, onAdvice, onFocusNation }: Props) {
  return (
    <div className="goals-panel">
      <Objectives state={state} />
      {advice.length ? <Advisor advice={advice} onAction={onAdvice} forceOpen /> : <div className="card muted small">The advisor has nothing to warn you about.</div>}
      <h3>Nations</h3>
      <Legend state={state} onFocusNation={onFocusNation} inline />
    </div>
  )
}
