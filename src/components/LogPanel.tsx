import { useState } from 'react'
import type { GameState, LogKind } from '../engine/types'

const KINDS: Array<{ key: LogKind | 'all'; label: string }> = [
  { key: 'all', label: 'All' }, { key: 'war', label: 'War' }, { key: 'battle', label: 'Battles' },
  { key: 'diplomacy', label: 'Diplomacy' }, { key: 'economy', label: 'Economy' }, { key: 'event', label: 'Events' }, { key: 'info', label: 'Info' },
]
const COLORS: Record<LogKind, string> = { war: 'var(--danger)', battle: 'var(--warn)', diplomacy: 'var(--info)', economy: 'var(--ok)', event: 'var(--accent)', info: 'var(--muted)' }

export function LogPanel({ state }: { state: GameState }) {
  const [filter, setFilter] = useState<LogKind | 'all'>('all')
  const entries = state.log.filter((e) => filter === 'all' || e.kind === filter).slice().reverse()
  return (
    <div>
      <div className="chips">
        {KINDS.map((k) => <button key={k.key} className={'chip' + (filter === k.key ? ' active' : '')} onClick={() => setFilter(k.key)}>{k.label}</button>)}
      </div>
      {entries.map((e) => (
        <div key={e.id} className="log-entry">
          <span className="turn">T{e.turn}</span>
          <span style={{ color: COLORS[e.kind], marginRight: 6 }}>●</span>
          {e.text}
        </div>
      ))}
    </div>
  )
}
