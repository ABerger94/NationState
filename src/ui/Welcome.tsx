const STEPS = [
  { glyph: '◈', title: 'Objectives and Advisor', text: 'Top left. Your next three goals, each paying gold, and an advisor who warns you before things go wrong.' },
  { glyph: '⬢', title: 'The map', text: 'Your realm is blue with a beacon over the capital. Click any hex to select it. Left-drag pans, right-drag rotates, scroll zooms.' },
  { glyph: '⚑', title: 'Action bar', text: 'Bottom centre. Build, recruit, move or attack from the selected province. Click a red-ringed neighbour to line up an attack.' },
  { glyph: '☰', title: 'Panels', text: 'Right side. Province details, your nation\'s treasury, research and edicts, diplomacy, military and the chronicle.' },
  { glyph: '↵', title: 'End turn', text: 'Top right, or press Enter. The world moves, then you get a short report of what happened to you.' },
]

export function Welcome({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal welcome" onClick={(e) => e.stopPropagation()}>
        <div className="eyebrow">Welcome, ruler</div>
        <h2>Five things to know</h2>
        <ol className="welcome-steps">
          {STEPS.map((s) => (
            <li key={s.title}>
              <span className="welcome-glyph">{s.glyph}</span>
              <div><b>{s.title}</b><div className="muted">{s.text}</div></div>
            </li>
          ))}
        </ol>
        <p className="muted small">Win by holding 60% of the map, destroying every rival, or leading the score at turn 150. Press ? any time for the full guide, or open it from the menu.</p>
        <div className="row end"><button className="btn primary big" onClick={onClose}>Begin your reign</button></div>
      </div>
    </div>
  )
}
