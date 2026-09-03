import type { Army } from '../engine/types'
import { UNITS, UNIT_ORDER } from '../engine/data'
import { clamp, emptyArmy } from '../engine/helpers'

export function Bar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  const pct = clamp((value / max) * 100, 0, 100)
  return (
    <div className="bar" title={`${Math.round(value)} / ${max}`}>
      <div style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

export function stabilityColor(v: number): string {
  if (v >= 65) return 'var(--ok)'
  if (v >= 40) return 'var(--warn)'
  return 'var(--danger)'
}

export function unrestColor(v: number): string {
  if (v < 30) return 'var(--ok)'
  if (v < 65) return 'var(--warn)'
  return 'var(--danger)'
}

export function relationColor(v: number): string {
  if (v >= 40) return 'var(--ok)'
  if (v > -20) return 'var(--muted)'
  return 'var(--danger)'
}

export function relationLabel(v: number): string {
  if (v >= 70) return 'Devoted'
  if (v >= 40) return 'Friendly'
  if (v >= 10) return 'Cordial'
  if (v > -10) return 'Neutral'
  if (v > -40) return 'Wary'
  if (v > -70) return 'Hostile'
  return 'Hateful'
}

export function ArmyPicker({ max, value, onChange }: { max: Army; value: Army; onChange: (a: Army) => void }) {
  const kinds = UNIT_ORDER.filter((k) => max[k] > 0)
  if (!kinds.length) return <p className="muted small">No troops available.</p>
  return (
    <div>
      <div className="army-picker">
        {kinds.map((k) => (
          <label key={k}>
            <span>{UNITS[k].name}</span>
            <input
              type="number" min={0} max={max[k]} value={value[k]}
              onChange={(e) => onChange({ ...value, [k]: clamp(parseInt(e.target.value, 10) || 0, 0, max[k]) })}
            />
            <span className="muted small">/ {max[k]}</span>
          </label>
        ))}
      </div>
      <div className="row">
        <button className="btn small" onClick={() => onChange({ ...max })}>All</button>
        <button className="btn small" onClick={() => onChange({ ...max, militia: 0 })}>All but militia</button>
        <button className="btn small" onClick={() => onChange(emptyArmy())}>None</button>
      </div>
    </div>
  )
}

export function ArmyTable({ army }: { army: Army }) {
  const kinds = UNIT_ORDER.filter((k) => army[k] > 0)
  if (!kinds.length) return <span className="muted">none</span>
  return <span>{kinds.map((k) => `${army[k]} ${UNITS[k].name}`).join(' · ')}</span>
}
