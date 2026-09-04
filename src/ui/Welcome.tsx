import { isMobileNow } from './useIsMobile'

const MOBILE_STEPS = [
  { glyph: '⬢', title: 'The map', text: 'Your realm is blue with a beacon over the capital. Tap a hex to select it. Drag with one finger to pan, pinch to zoom, two fingers to rotate.' },
  { glyph: '⚑', title: 'Armies', text: 'Recruit troops, then raise an army from the garrison. Tap the army to command it, then tap a blue tile to march or a red one to attack.' },
  { glyph: '☰', title: 'Tabs', text: 'Along the bottom. Tap one to open it; tap it again to hide the panel and see the map. Goals holds your objectives and advisor.' },
  { glyph: '◈', title: 'Objectives', text: 'In the Goals tab. Three goals at a time, each paying gold. Follow them and you will learn the game as you go.' },
  { glyph: '↵', title: 'End turn', text: 'Top right. The world moves, then you get a short report of what happened to you.' },
]

const STEPS = [
  { glyph: '◈', title: 'Objectives and Advisor', text: 'Top left. Your next three goals, each paying gold, and an advisor who warns you before things go wrong.' },
  { glyph: '⬢', title: 'The map', text: 'Your realm is blue with a beacon over the capital. Click any hex to select it. Left-drag pans, right-drag rotates, scroll zooms.' },
  { glyph: '⚑', title: 'Armies', text: 'Recruit troops, then raise an army from the garrison. Click the army to command it, then click a blue tile to march or a red one to attack.' },
  { glyph: '☰', title: 'Panels', text: 'Right side. Province details, your nation\'s treasury, research and edicts, diplomacy, military and the chronicle.' },
  { glyph: '↵', title: 'End turn', text: 'Top right, or press Enter. Sieges grind on, armies eat, and the world moves. Then you get a short report.' },
]

export function Welcome({ onClose }: { onClose: () => void }) {
  const steps = isMobileNow() ? MOBILE_STEPS : STEPS
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal welcome" onClick={(e) => e.stopPropagation()}>
        <div className="eyebrow">Welcome, ruler</div>
        <h2>Five things to know</h2>
        <ol className="welcome-steps">
          {steps.map((s) => (
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
