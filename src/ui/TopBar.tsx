import type { GameState } from '../engine/types'
import { fmt, fmtSigned, playerNation, yearOf } from '../engine/helpers'
import { nationBudget } from '../engine/economy'
import { MAX_TURNS } from '../engine/data'
import { useTween } from './useTween'
import { Coin, Flask, Heart, Iron, Menu, Mute, Sound, Wheat, Wood } from './icons'
import { stabilityColor } from '../components/common'

interface Props {
  state: GameState
  busy: boolean
  muted: boolean
  onEndTurn: () => void
  onNewGame: () => void
  onToggleMute: () => void
}

function Chip({ icon, label, value, delta, suffix, color }: { icon: React.ReactNode; label: string; value: number; delta?: number; suffix?: string; color?: string }) {
  const v = useTween(value)
  return (
    <div className="chip-res" title={label}>
      <span className="chip-icon">{icon}</span>
      <span className="chip-body">
        <span className="chip-value" style={color ? { color } : undefined}>{fmt(Math.floor(v))}{suffix && <span className="chip-suffix">{suffix}</span>}</span>
        {delta !== undefined && <span className={'chip-delta ' + (delta >= 0 ? 'ok' : 'bad')}>{fmtSigned(delta)}</span>}
      </span>
    </div>
  )
}

export function TopBar({ state, busy, muted, onEndTurn, onNewGame, onToggleMute }: Props) {
  const player = playerNation(state)
  const budget = nationBudget(state, player)
  const r = player.resources
  const blocked = !!state.pendingEvent || state.gameOver || busy
  return (
    <header className="topbar">
      <div className="crest" style={{ background: player.color }}>{player.name.replace(/^(Kingdom|Empire|Republic|Realm) of /i, '').charAt(0)}</div>
      <div className="title-block">
        <div className="nation-name">{player.name}</div>
        <div className="turn-line">Turn {state.turn} <span className="dim">/ {MAX_TURNS}</span> · Year {yearOf(state)}</div>
      </div>
      <div className="chips-res">
        <Chip icon={<Coin />} label="Gold" value={r.gold} delta={budget.net.gold} />
        <Chip icon={<Wheat />} label="Food" value={r.food} delta={budget.net.food} suffix={` / ${budget.foodCap}`} />
        <Chip icon={<Wood />} label="Wood" value={r.wood} delta={budget.net.wood} />
        <Chip icon={<Iron />} label="Iron" value={r.iron} delta={budget.net.iron} />
        <Chip icon={<Flask />} label="Science per turn" value={budget.science} suffix=" / turn" />
        <Chip icon={<Heart />} label="Stability" value={budget.stability} color={stabilityColor(budget.stability)} suffix={player.warWeariness > 0 ? ` · weary ${Math.round(player.warWeariness)}` : ''} />
      </div>
      <div className="spacer" />
      <button className="icon-btn" onClick={onToggleMute} title={muted ? 'Unmute' : 'Mute'}>{muted ? <Mute /> : <Sound />}</button>
      <button className="icon-btn" onClick={onNewGame} title="New game"><Menu /></button>
      <button className={'end-turn' + (blocked ? ' blocked' : '')} onClick={onEndTurn} disabled={blocked} title={state.pendingEvent ? 'Resolve the pending event first' : 'End turn (Enter)'}>
        End turn
        <span className="kbd">↵</span>
      </button>
    </header>
  )
}
