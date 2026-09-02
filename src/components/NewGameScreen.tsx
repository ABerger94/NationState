import { useState } from 'react'
import type { Difficulty } from '../engine/types'
import { DIFFICULTIES } from '../engine/data'

interface Props { onStart: (o: { seed: number; playerName: string; difficulty: Difficulty }) => void }

export function NewGameScreen({ onStart }: Props) {
  const [name, setName] = useState('Kingdom of Aldmere')
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1_000_000))
  const [difficulty, setDifficulty] = useState<Difficulty>('normal')
  return (
    <div className="newgame">
      <div className="box">
        <h1>NationState</h1>
        <p className="muted">Lead a fledgling realm through a century and a half of growth, intrigue and war. Feed your people, fill your treasury, raise armies, and outlast five rival nations.</p>
        <div className="grid">
          <label className="field">Nation name
            <input type="text" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">World seed
            <div className="row">
              <input type="number" value={seed} onChange={(e) => setSeed(parseInt(e.target.value, 10) || 1)} style={{ width: 140 }} />
              <button className="btn small" onClick={() => setSeed(Math.floor(Math.random() * 1_000_000))}>Random</button>
            </div>
          </label>
        </div>
        <label className="field">Difficulty</label>
        <div className="diff" style={{ marginTop: 6 }}>
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
            <button key={d} className={'btn' + (difficulty === d ? ' primary' : '')} onClick={() => setDifficulty(d)} title={DIFFICULTIES[d].description}>{DIFFICULTIES[d].label}</button>
          ))}
        </div>
        <p className="muted small" style={{ marginTop: 6 }}>{DIFFICULTIES[difficulty].description}</p>
        <div className="row" style={{ margin: '18px 0' }}>
          <button className="btn primary big" onClick={() => onStart({ seed, playerName: name, difficulty })}>Found the nation</button>
        </div>
        <h3>How to play</h3>
        <ul className="rules">
          <li><b>Provinces</b> are hexes. Click one to inspect it, build in it, recruit from it, or attack from it.</li>
          <li><b>Population</b> grows when fed and content, and it is your tax base and your recruiting pool. Every unit levies people from its province.</li>
          <li><b>Food</b> is eaten every turn. Run out and famine kills people and sparks unrest.</li>
          <li><b>Gold</b> comes from taxes. Raise the rate for money now at the cost of unrest later.</li>
          <li><b>Unrest</b> above 85 risks rebellion. Temples, garrisons, low taxes and time calm a province.</li>
          <li><b>Battles</b> are fought in rounds. Terrain, walls, siege engines, technology and morale all matter. Read the odds before you attack.</li>
          <li><b>War</b> needs a shared border and a declaration. Peace comes when the enemy thinks it is losing, or is tired of fighting.</li>
          <li><b>Win</b> by holding 60% of the map, destroying every rival, or having the highest score when turn 150 ends.</li>
        </ul>
      </div>
    </div>
  )
}
