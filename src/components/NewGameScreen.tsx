import { useMemo, useState } from 'react'
import type { Difficulty } from '../engine/types'
import { DIFFICULTIES, MAP_SIZES, type MapSize } from '../engine/data'
import { createGame } from '../engine/world'
import { WorldMap } from '../three/WorldMap'

interface Props { onStart: (o: { seed: number; playerName: string; difficulty: Difficulty; size: MapSize }) => void }

const NAMES = ['Kingdom of Aldmere', 'Republic of Tessaly', 'Empire of Varn', 'Duchy of Corvane', 'Realm of Ithil', 'Sultanate of Qesh']

export function NewGameScreen({ onStart }: Props) {
  const [name, setName] = useState(() => NAMES[Math.floor(Math.random() * NAMES.length)])
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000))
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  const [size, setSize] = useState<MapSize>('small')
  const preview = useMemo(() => createGame({ seed, playerName: 'Preview', difficulty: 'normal', size }), [seed, size])
  return (
    <div className="newgame">
      <WorldMap state={preview} selected={null} targets={[]} highlight={[]} focus={null} fx={[]} onFxDone={() => {}} onSelect={() => {}} interactive={false} autoRotate showLabels={false} />
      <div className="newgame-veil" />
      <div className="box">
        <div className="eyebrow">A game of realms</div>
        <h1>NationState</h1>
        <p className="lede">Lead a fledgling realm through a century and a half of growth, intrigue and war. Feed your people, fill your treasury, raise armies, and outlast five rival nations.</p>
        <div className="grid">
          <label className="field">Nation name
            <input type="text" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">World seed
            <div className="row">
              <input type="number" value={seed} onChange={(e) => setSeed(parseInt(e.target.value, 10) || 1)} style={{ width: 150 }} />
              <button className="btn small" onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}>Reroll world</button>
            </div>
          </label>
        </div>
        <div className="field-label">World size</div>
        <div className="diff">
          {(Object.keys(MAP_SIZES) as MapSize[]).map((k) => (
            <button key={k} className={'btn' + (size === k ? ' primary' : '')} onClick={() => setSize(k)}>{MAP_SIZES[k].label}</button>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 6 }}>{MAP_SIZES[size].description}</p>

        <div className="field-label">Difficulty</div>
        <div className="diff">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
            <button key={d} className={'btn' + (difficulty === d ? ' primary' : '')} onClick={() => setDifficulty(d)}>{DIFFICULTIES[d].label}</button>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 6 }}>{DIFFICULTIES[difficulty].description}</p>
        <button className="btn primary big found" onClick={() => onStart({ seed, playerName: name, difficulty, size })}>Found the nation</button>
        <details className="rules-details">
          <summary>How to play</summary>
          <ul className="rules">
            <li><b>Provinces</b> are hexes. Click one to inspect, build, recruit or attack. Left-drag pans, right-drag rotates, scroll zooms.</li>
            <li><b>Population</b> grows when fed and content. It is your tax base and your recruiting pool.</li>
            <li><b>Food</b> is eaten every turn. Run out and famine kills people and sparks unrest.</li>
            <li><b>Gold</b> comes from taxes. Raise the rate for money now at the cost of unrest later.</li>
            <li><b>Unrest</b> above 85 risks rebellion. Temples, garrisons, low taxes and time calm a province.</li>
            <li><b>Battles</b> run in rounds. Terrain, walls, siege engines, technology and morale all matter. Read the odds first.</li>
            <li><b>War</b> needs a shared border and a declaration. Peace comes when the enemy thinks it is losing or grows weary.</li>
            <li><b>Win</b> by holding 60% of the map, destroying every rival, or topping the score at turn 150.</li>
          </ul>
        </details>
      </div>
    </div>
  )
}
