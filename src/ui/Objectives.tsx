import { useState } from 'react'
import type { GameState } from '../engine/types'
import { OBJECTIVES, activeObjectives } from '../engine/objectives'
import { playerNation } from '../engine/helpers'
import { Chevron } from './icons'

export function Objectives({ state }: { state: GameState }) {
  const [open, setOpen] = useState(true)
  const player = playerNation(state)
  const active = activeObjectives(state)
  const done = state.objectives.length
  if (!active.length && !done) return null
  return (
    <div className={'objectives' + (open ? '' : ' collapsed')}>
      <button className="advisor-head" onClick={() => setOpen(!open)}>
        <span className="obj-icon">◈</span>
        <span>Objectives</span>
        <span className="count">{done} / {OBJECTIVES.length}</span>
        <Chevron className={'chev' + (open ? ' open' : '')} />
      </button>
      {open && (
        <ul>
          {active.map((o) => {
            const r = o.check(state, player)
            return (
              <li key={o.id} className="obj">
                <div className="obj-row">
                  <b>{o.title}</b>
                  <span className="obj-reward">+{o.reward} gold</span>
                </div>
                <div className="muted small">{o.description}</div>
                {r.progress && <div className="obj-progress">{r.progress}</div>}
              </li>
            )
          })}
          {!active.length && <li className="obj muted small">Every objective is complete. The chronicles will sing of you.</li>}
        </ul>
      )}
    </div>
  )
}
