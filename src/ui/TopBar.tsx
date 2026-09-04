import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { GameState } from '../engine/types'
import { fmt, fmtSigned, playerNation, yearOf } from '../engine/helpers'
import { nationBudget } from '../engine/economy'

import { useTween } from './useTween'
import { Coin, Flask, Heart, Iron, Locate, Menu, Mute, Shield, Sound, Wheat, Wood } from './icons'
import { stabilityColor } from '../components/common'

interface Props {
  state: GameState
  busy: boolean
  muted: boolean
  idleArmies: number
  warnings: number
  onEndTurn: () => void
  onNewGame: () => void
  onToggleMute: () => void
  onHome: () => void
  onNextArmy: () => void
  onHelp: () => void
  onIntro: () => void
}

function Chip({ icon, label, value, delta, suffix, color, title }: { icon: React.ReactNode; label: string; value: number; delta?: number; suffix?: string; color?: string; title: string }) {
  const v = useTween(value)
  return (
    <div className="chip-res" title={title}>
      <span className="chip-icon">{icon}</span>
      <span className="chip-body">
        <span className="chip-top">
          <span className="chip-value" style={color ? { color } : undefined}>{fmt(Math.floor(v))}{suffix && <span className="chip-suffix">{suffix}</span>}</span>
          {delta !== undefined && <span className={'chip-delta ' + (delta >= 0 ? 'ok' : 'bad')}>{fmtSigned(delta)}</span>}
        </span>
        <span className="chip-label">{label}</span>
      </span>
    </div>
  )
}

export function TopBar({ state, busy, muted, idleArmies, warnings, onEndTurn, onNewGame, onToggleMute, onHome, onNextArmy, onHelp, onIntro }: Props) {
  const player = playerNation(state)
  const budget = nationBudget(state, player)
  const r = player.resources
  const blocked = !!state.pendingEvent || state.gameOver || busy
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuTop, setMenuTop] = useState(70)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuPopRef = useRef<HTMLDivElement>(null)
  const openMenu = () => {
    const rect = menuRef.current?.getBoundingClientRect()
    if (rect) setMenuTop(rect.bottom + 8)
    setMenuOpen((o) => !o)
  }

  useEffect(() => {
    if (!menuOpen) return
    const close = (e: MouseEvent) => {
      const t = e.target as Node
      if (menuRef.current?.contains(t) || menuPopRef.current?.contains(t)) return
      setMenuOpen(false)
    }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [menuOpen])

  const item = (label: string, hint: string, fn: () => void) => (
    <button className="menu-item" onClick={() => { setMenuOpen(false); fn() }}>
      <span>{label}</span>
      <span className="menu-hint">{hint}</span>
    </button>
  )

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="crest" style={{ background: player.color }} onClick={onHome} title="Your nation. Click to fly to your capital (H)">{player.name.replace(/^(Kingdom|Empire|Republic|Realm|Duchy|Sultanate) of /i, '').charAt(0)}</button>
        <div className="title-block">
          <div className="nation-name">{player.name} <span className="you-pill">you</span></div>
          <div className="turn-line">Turn {state.turn} <span className="dim">/ {state.maxTurns}</span> · Year {yearOf(state)}</div>
        </div>
      </div>
      <div className="chips-res">
        <Chip icon={<Coin />} label="Gold" value={r.gold} delta={budget.net.gold} title="Gold: taxes minus troop and building upkeep. Spend it on buildings, troops, gifts and trade." />
        <Chip icon={<Wheat />} label="Food" value={r.food} delta={budget.net.food} suffix={` / ${budget.foodCap}`} title="Food in storage and the storage cap. People eat every turn; surplus above the cap is wasted." />
        <Chip icon={<Wood />} label="Wood" value={r.wood} delta={budget.net.wood} title="Wood for buildings, archers and siege engines. Sell surplus at the market." />
        <Chip icon={<Iron />} label="Iron" value={r.iron} delta={budget.net.iron} title="Iron for professional troops, walls and barracks. Sell surplus at the market." />
        <Chip icon={<Flask />} label="Science" value={budget.science} suffix=" / turn" title="Research points per turn, from population and universities." />
        <Chip icon={<Heart />} label="Stability" value={budget.stability} color={stabilityColor(budget.stability)} suffix={player.warWeariness > 0 ? ` · weary ${Math.round(player.warWeariness)}` : ''} title="Stability scales taxes, growth and morale. Unrest, war weariness and high taxes lower it." />
      </div>
      <div className="topbar-right">
        <button className={'icon-btn wide' + (idleArmies ? ' attention' : '')} onClick={onNextArmy} disabled={!idleArmies} title="Armies that can still attack this turn. Click or press N to cycle through them."><Shield /> {idleArmies}</button>
        <button className="icon-btn" onClick={onHome} title="Fly to your capital (H)"><Locate /></button>
        <div className="menu-wrap" ref={menuRef}>
          <button className={'icon-btn' + (menuOpen ? ' open' : '')} onClick={openMenu} title="Menu" aria-haspopup="menu" aria-expanded={menuOpen}><Menu /></button>
          {menuOpen && createPortal(
            <div className="menu" role="menu" style={{ top: menuTop }} ref={menuPopRef}>
              {item('How to play', '?', onHelp)}
              {item('Show the welcome tour', '', onIntro)}
              <button className="menu-item" onClick={() => { onToggleMute() }}>
                <span>{muted ? 'Sound: off' : 'Sound: on'}</span>
                <span className="menu-hint">{muted ? <Mute /> : <Sound />}</span>
              </button>
              {item('Fly to capital', 'H', onHome)}
              <div className="menu-sep" />
              {item('New game…', '', onNewGame)}
              <div className="menu-note">Your game saves automatically after every action.</div>
            </div>,
            document.body,
          )}
        </div>
        <button className={'end-turn' + (blocked ? ' blocked' : '')} onClick={onEndTurn} disabled={blocked} title={state.pendingEvent ? 'Resolve the pending event first' : warnings ? `${warnings} advisor warning${warnings === 1 ? '' : 's'} outstanding` : 'End turn (Enter)'}>
          End turn
          {warnings > 0 && !blocked ? <span className="warn-pill" title="Advisor warnings">{warnings}</span> : <span className="kbd">↵</span>}
        </button>
      </div>
    </header>
  )
}
