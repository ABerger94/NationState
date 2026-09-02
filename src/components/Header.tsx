import type { GameState } from '../engine/types'
import { fmt, fmtSigned, playerNation, yearOf } from '../engine/helpers'
import { nationBudget } from '../engine/economy'
import { MAX_TURNS } from '../engine/data'
import { stabilityColor } from './common'

interface Props {
  state: GameState
  onEndTurn: () => void
  onNewGame: () => void
}

export function Header({ state, onEndTurn, onNewGame }: Props) {
  const player = playerNation(state)
  const budget = nationBudget(state, player)
  const r = player.resources
  const delta = (v: number) => <span className={'delta ' + (v >= 0 ? 'ok' : 'bad')}>{fmtSigned(v)}/turn</span>
  return (
    <header className="header">
      <div className="title">
        <span className="swatch" style={{ background: player.color }} />
        {player.name}
      </div>
      <div className="muted small">
        Turn {state.turn} / {MAX_TURNS} · Year {yearOf(state)}
      </div>
      <div className="resources">
        <div className="res"><span className="label">Gold</span><span className="value">{fmt(Math.floor(r.gold))}</span>{delta(budget.net.gold)}</div>
        <div className="res"><span className="label">Food</span><span className="value">{fmt(Math.floor(r.food))} <span className="muted small">/ {budget.foodCap}</span></span>{delta(budget.net.food)}</div>
        <div className="res"><span className="label">Wood</span><span className="value">{fmt(Math.floor(r.wood))}</span>{delta(budget.net.wood)}</div>
        <div className="res"><span className="label">Iron</span><span className="value">{fmt(Math.floor(r.iron))}</span>{delta(budget.net.iron)}</div>
        <div className="res"><span className="label">Science</span><span className="value">{budget.science}</span><span className="delta muted">/turn</span></div>
        <div className="res"><span className="label">Stability</span><span className="value" style={{ color: stabilityColor(budget.stability) }}>{budget.stability}</span><span className="delta muted">war weariness {Math.round(player.warWeariness)}</span></div>
      </div>
      <div className="spacer" />
      <button className="btn small" onClick={onNewGame}>New game</button>
      <button className="btn primary big" onClick={onEndTurn} disabled={!!state.pendingEvent || state.gameOver} title={state.pendingEvent ? 'Resolve the pending event first' : ''}>
        End turn
      </button>
    </header>
  )
}
