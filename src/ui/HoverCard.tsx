import { useEffect, useRef } from 'react'
import type { GameState, Province } from '../engine/types'
import { TERRAINS } from '../engine/data'
import { armySize, describeArmy, fmt, ownerName, playerNation } from '../engine/helpers'
import { atWar } from '../engine/diplomacy'
import { unrestColor } from '../components/common'

/** Follows the mouse without re-rendering React on every move. */
export function HoverCard({ state, province: p }: { state: GameState; province: Province }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const el = ref.current
      if (!el) return
      const x = Math.min(window.innerWidth - 270, e.clientX + 18)
      const y = Math.min(window.innerHeight - 140, e.clientY + 18)
      el.style.transform = `translate(${x}px, ${y}px)`
    }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [])
  const player = playerNation(state)
  const owner = p.ownerId === null ? null : state.nations[p.ownerId]
  const rel = owner && !owner.isPlayer ? (atWar(player, owner) ? 'at war' : player.allies.includes(owner.id) ? 'ally' : 'at peace') : null
  return (
    <div ref={ref} className="hover-card" style={{ borderColor: owner?.color ?? '#6b6b6b' }}>
      <div className="hc-title">{p.isCapital ? '★ ' : ''}{p.name} <span className="muted">· {TERRAINS[p.terrain].name}</span></div>
      <div className="hc-owner" style={{ color: owner?.color ?? '#aaa' }}>{ownerName(state, p.ownerId)}{rel ? <span className="muted"> · {rel}</span> : ''}</div>
      <div className="hc-row"><span>People</span><b>{fmt(p.population)}</b></div>
      <div className="hc-row"><span>Unrest</span><b style={{ color: unrestColor(p.unrest) }}>{Math.round(p.unrest)}</b></div>
      <div className="hc-row"><span>Garrison</span><b>{armySize(p.garrison)}</b></div>
      <div className="hc-army muted">{describeArmy(p.garrison)}{p.buildings.walls ? ` · walls ${p.buildings.walls}` : ''}</div>
    </div>
  )
}
