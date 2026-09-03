import { MAP_MODES, type MapMode } from '../engine/yields'

export function MapModes({ mode, onChange }: { mode: MapMode; onChange: (m: MapMode) => void }) {
  const current = MAP_MODES.find((m) => m.key === mode)!
  return (
    <div className="mapmodes" role="tablist" aria-label="Map mode">
      {MAP_MODES.map((m) => (
        <button key={m.key} role="tab" aria-selected={mode === m.key} className={'mapmode' + (mode === m.key ? ' active' : '')} style={mode === m.key ? { borderColor: m.color, color: m.color } : undefined} onClick={() => onChange(m.key)} title={m.key === 'realm' ? 'Who owns what' : m.key === 'unrest' ? 'Unrest in each province' : `${m.label} yield per 1,000 people`}>
          <span className="mm-glyph" aria-hidden>{m.glyph}</span>
          <span className="mm-label">{m.label}</span>
        </button>
      ))}
      {mode !== 'realm' && <span className="mm-hint">{mode === 'unrest' ? 'Brighter red is angrier' : `Brighter is richer ${current.label.toLowerCase()} land`}</span>}
    </div>
  )
}
