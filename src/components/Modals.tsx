import type { BattleReport, GameState } from '../engine/types'
import { TERRAINS, UNITS, UNIT_ORDER } from '../engine/data'
import { armySize, playerNation } from '../engine/helpers'
import { nationScore } from '../engine/economy'

export function Modal({ children, onClose }: { children: React.ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}

export function EventModal({ state, onChoose }: { state: GameState; onChoose: (i: number) => void }) {
  const ev = state.pendingEvent!
  const gold = playerNation(state).resources.gold
  return (
    <Modal>
      <h2>{ev.title}</h2>
      <p>{ev.text}</p>
      {ev.choices.map((c, i) => {
        const m = /\((\d+) gold\)/.exec(c.label)
        const disabled = m ? gold < parseInt(m[1], 10) : false
        return (
          <button key={i} className="btn choice" disabled={disabled} onClick={() => onChoose(i)}>
            <b>{c.label}</b>
            <span className="desc">{c.description}{disabled ? ' (not enough gold)' : ''}</span>
          </button>
        )
      })}
    </Modal>
  )
}

export function BattleModal({ report: b, onClose }: { report: BattleReport; onClose: () => void }) {
  const lost = (start: BattleReport['attackerStart'], end: BattleReport['attackerEnd']) => armySize(start) - armySize(end)
  const won = b.winner === 'attacker'
  return (
    <Modal onClose={onClose}>
      <h2>{b.kind === 'rebellion' ? 'Uprising' : 'Battle'} of {b.provinceName}</h2>
      <p className="muted small">Turn {b.turn} · {TERRAINS[b.terrain].name}</p>
      <p>
        <b>{b.attackerName}</b> attacked <b>{b.defenderName}</b>.{' '}
        {won ? (b.kind === 'rebellion' ? 'The rebels prevailed and the province broke away.' : `${b.attackerName} carried the field${b.conquered ? ' and took the province' : ''}.`) : `${b.defenderName} held.`}
      </p>
      <table className="tbl">
        <thead><tr><th>Unit</th><th className="num">Attacker start</th><th className="num">Attacker end</th><th className="num">Defender start</th><th className="num">Defender end</th></tr></thead>
        <tbody>
          {UNIT_ORDER.filter((k) => b.attackerStart[k] || b.defenderStart[k]).map((k) => (
            <tr key={k}><td>{UNITS[k].name}</td><td className="num">{b.attackerStart[k]}</td><td className="num">{b.attackerEnd[k]}</td><td className="num">{b.defenderStart[k]}</td><td className="num">{b.defenderEnd[k]}</td></tr>
          ))}
          <tr><td><b>Losses</b></td><td className="num bad" colSpan={2}>-{lost(b.attackerStart, b.attackerEnd)}</td><td className="num bad" colSpan={2}>-{lost(b.defenderStart, b.defenderEnd)}</td></tr>
        </tbody>
      </table>
      {b.rounds.length > 0 && (
        <>
          <h3>Rounds</h3>
          <table className="tbl">
            <thead><tr><th>#</th><th className="num">Atk power</th><th className="num">Def power</th><th className="num">Atk losses</th><th className="num">Def losses</th><th className="num">Atk morale</th><th className="num">Def morale</th></tr></thead>
            <tbody>
              {b.rounds.map((r) => (
                <tr key={r.round}><td>{r.round}</td><td className="num">{r.attackerPower}</td><td className="num">{r.defenderPower}</td><td className="num">{r.attackerLosses}</td><td className="num">{r.defenderLosses}</td><td className="num">{r.attackerMorale}</td><td className="num">{r.defenderMorale}</td></tr>
              ))}
            </tbody>
          </table>
          <p className="muted small">A side routs when its morale drops below 30. Attackers who cannot break the defence within eight rounds withdraw.</p>
        </>
      )}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn primary" onClick={onClose}>Close</button></div>
    </Modal>
  )
}

export function TurnReportModal({ state, onClose, onShowBattle }: { state: GameState; onClose: () => void; onShowBattle: (id: number) => void }) {
  const lastTurn = state.turn - 1
  const entries = state.log.filter((e) => e.turn === lastTurn && e.kind !== 'info')
  const battles = state.battles.filter((b) => state.lastTurnBattles.includes(b.id))
  return (
    <Modal onClose={onClose}>
      <h2>Turn {lastTurn} report</h2>
      {battles.length > 0 && (
        <>
          <h3>Battles involving us</h3>
          {battles.map((b) => (
            <button key={b.id} className="btn choice" onClick={() => onShowBattle(b.id)}>
              <b>{b.provinceName}</b>: {b.attackerName} vs {b.defenderName}
              <span className="desc">{b.winner === 'attacker' ? `${b.attackerName} won${b.conquered ? ' and took the province' : ''}` : `${b.defenderName} held`}</span>
            </button>
          ))}
        </>
      )}
      <h3>Happenings</h3>
      {entries.length === 0 ? <p className="muted">A quiet turn.</p> : entries.map((e) => <div key={e.id} className="log-entry">{e.text}</div>)}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}><button className="btn primary" onClick={onClose}>Continue</button></div>
    </Modal>
  )
}

export function GameOverModal({ state, onNewGame, onContinue }: { state: GameState; onNewGame: () => void; onContinue: () => void }) {
  const player = playerNation(state)
  const won = state.winner === player.id
  const ranked = state.nations.map((n) => ({ n, s: nationScore(state, n) })).sort((a, b) => b.s - a.s)
  return (
    <Modal>
      <h2>{won ? 'Victory!' : 'The end of an age'}</h2>
      <p>{state.gameOverReason}</p>
      <table className="tbl">
        <thead><tr><th>#</th><th>Nation</th><th className="num">Score</th></tr></thead>
        <tbody>{ranked.map((r, i) => <tr key={r.n.id}><td>{i + 1}</td><td><span className="swatch" style={{ background: r.n.color, marginRight: 6 }} />{r.n.name}{!r.n.alive && <span className="muted small"> (destroyed)</span>}</td><td className="num">{r.s}</td></tr>)}</tbody>
      </table>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
        <button className="btn" onClick={onContinue}>Look at the map</button>
        <button className="btn primary" onClick={onNewGame}>New game</button>
      </div>
    </Modal>
  )
}

export function ConfirmModal({ text, onYes, onNo }: { text: string; onYes: () => void; onNo: () => void }) {
  return (
    <Modal onClose={onNo}>
      <p>{text}</p>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <button className="btn" onClick={onNo}>Cancel</button>
        <button className="btn danger" onClick={onYes}>Yes</button>
      </div>
    </Modal>
  )
}
