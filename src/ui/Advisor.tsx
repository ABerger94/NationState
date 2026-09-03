import { useState } from 'react'
import type { Advice } from '../advisor'
import { Chevron, Lightbulb } from './icons'

export function Advisor({ advice, onAction, forceOpen = false }: { advice: Advice[]; onAction: (a: Advice) => void; forceOpen?: boolean }) {
  const [openState, setOpen] = useState(() => (typeof window === 'undefined' ? true : window.innerHeight >= 820))
  const open = forceOpen || openState
  if (!advice.length) return null
  const worst = advice[0].level
  return (
    <div className={'advisor' + (open ? '' : ' collapsed')}>
      <button className="advisor-head" onClick={() => setOpen(!open)}>
        <span className={'adv-dot ' + worst} />
        <Lightbulb />
        <span>Advisor</span>
        <span className="count">{advice.length}</span>
        <Chevron className={'chev' + (open ? ' open' : '')} />
      </button>
      {open && (
        <ul>
          {advice.map((a) => (
            <li key={a.id} className={'adv ' + a.level} onClick={() => onAction(a)} role={a.tab || a.provinceId !== undefined ? 'button' : undefined}>
              <span className="adv-dot" />
              <span>{a.text}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
