import { useState } from 'react'
import type { GameState } from '../engine/types'
import type { Action } from '../engine/actions'
import { PERSONALITIES } from '../engine/data'
import { armyPower, bordersNation, nationArmy, ownedProvinces, playerNation } from '../engine/helpers'
import { atWar, warScore } from '../engine/diplomacy'
import { relationColor, relationLabel } from './common'

interface Props { state: GameState; dispatch: (a: Action) => void }

export function DiplomacyPanel({ state, dispatch }: Props) {
  const player = playerNation(state)
  const [gift, setGift] = useState(100)
  const others = state.nations.filter((n) => !n.isPlayer)
  const myPower = armyPower(nationArmy(state, player.id))

  return (
    <div>
      <p className="muted small">
        Wars can only be fought across shared borders. Declaring war angers every other nation; allies of your target will join against you. Gifts of gold buy goodwill; alliances need a relation of 60 or more.
      </p>
      {player.allies.length > 0 && <p className="small">Allies: <b>{player.allies.map((a) => state.nations[a].name).join(', ')}</b> (max 2)</p>}
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="muted small">Gift size</span>
        <select value={gift} onChange={(e) => setGift(parseInt(e.target.value, 10))}>
          {[50, 100, 200, 300].map((g) => <option key={g} value={g}>{g} gold (+{Math.min(25, Math.round(g / 10))})</option>)}
        </select>
      </div>
      {others.map((n) => {
        if (!n.alive) return (
          <div key={n.id} className="card" style={{ opacity: 0.5 }}>
            <b><span className="swatch" style={{ background: n.color, marginRight: 6 }} />{n.name}</b> <span className="muted small">— destroyed</span>
          </div>
        )
        const rel = player.relations[n.id] ?? 0
        const war = atWar(player, n)
        const ally = player.allies.includes(n.id)
        const offer = player.peaceOffersFrom.includes(n.id)
        const power = armyPower(nationArmy(state, n.id))
        const borders = bordersNation(state, player.id, n.id)
        const score = war ? warScore(state, player.id, n.id) : 0
        return (
          <div key={n.id} className="card">
            <div className="row between">
              <b><span className="swatch" style={{ background: n.color, marginRight: 6 }} />{n.name}</b>
              <span className="muted small">{PERSONALITIES[n.personality].label}</span>
            </div>
            <div className="row between small" style={{ marginTop: 4 }}>
              <span>Relations <b style={{ color: relationColor(rel) }}>{rel} · {relationLabel(rel)}</b></span>
              <span>{war ? <b className="bad">AT WAR</b> : ally ? <b className="ok">ALLIED</b> : <span className="muted">at peace</span>}</span>
            </div>
            <div className="muted small">
              {ownedProvinces(state, n.id).length} provinces · military strength {Math.round(power)} ({power > myPower * 1.3 ? 'stronger than us' : power < myPower * 0.75 ? 'weaker than us' : 'comparable to us'})
              {borders ? ' · shares a border' : ' · no shared border'}
              {n.allies.length > 0 && ` · allied with ${n.allies.map((a) => state.nations[a].name).join(', ')}`}
              {n.wars.filter((w) => w !== player.id).length > 0 && ` · fighting ${n.wars.filter((w) => w !== player.id).map((w) => state.nations[w].name).join(', ')}`}
            </div>
            {war && <div className="small" style={{ marginTop: 4 }}>War score <b className={score > 0 ? 'ok' : 'bad'}>{Math.round(score)}</b>{offer && <span className="ok"> · they offer peace!</span>}</div>}
            <div className="row" style={{ marginTop: 8 }}>
              {war ? (
                <>
                  {offer && <button className="btn primary small" onClick={() => dispatch({ type: 'ACCEPT_PEACE', target: n.id })}>Accept peace</button>}
                  <button className="btn small" onClick={() => dispatch({ type: 'PROPOSE_PEACE', target: n.id })}>Propose peace</button>
                </>
              ) : (
                <>
                  <button className="btn danger small" disabled={!borders} title={borders ? '' : 'No shared border'} onClick={() => dispatch({ type: 'DECLARE_WAR', target: n.id })}>Declare war</button>
                  {ally ? (
                    <button className="btn small" onClick={() => dispatch({ type: 'BREAK_ALLIANCE', target: n.id })}>Break alliance</button>
                  ) : (
                    <button className="btn small" disabled={rel < 60 || player.allies.length >= 2} title={rel < 60 ? 'Needs relations of 60+' : player.allies.length >= 2 ? 'You already have two allies' : ''} onClick={() => dispatch({ type: 'PROPOSE_ALLIANCE', target: n.id })}>Propose alliance</button>
                  )}
                </>
              )}
              <button className="btn small" disabled={player.resources.gold < gift} onClick={() => dispatch({ type: 'SEND_GIFT', target: n.id, amount: gift })}>Send {gift} gold</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
