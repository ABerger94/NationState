import type { BattleReport, GameState } from '../engine/types'
import { TERRAINS, UNITS, UNIT_ORDER } from '../engine/data'
import { armySize, playerNation } from '../engine/helpers'
import { nationScore } from '../engine/economy'

export function Modal({ children, onClose, wide }: { children: React.ReactNode; onClose?: () => void; wide?: boolean }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={'modal' + (wide ? ' wide' : '')} onClick={(e) => e.stopPropagation()}>{children}</div>
    </div>
  )
}

const EVENT_GLYPH: Record<string, string> = {
  plague: '☠', harvest: '❦', goldVein: '◆', bandits: '⚔', migrants: '☗', fire: '✹', festival: '♫', scholar: '✎', mercenaries: '⚑', borderDispute: '⚖',
}

export function EventModal({ state, onChoose, onFocus }: { state: GameState; onChoose: (i: number) => void; onFocus?: (id: number) => void }) {
  const ev = state.pendingEvent!
  const gold = playerNation(state).resources.gold
  return (
    <Modal>
      <div className="event-head">
        <div className="event-glyph">{EVENT_GLYPH[ev.id] ?? '✦'}</div>
        <div>
          <div className="eyebrow">Year {state.startYear + state.turn - 1}</div>
          <h2>{ev.title}</h2>
        </div>
      </div>
      <p className="event-text">{ev.text}</p>
      {ev.provinceId !== undefined && onFocus && <button className="btn small" onClick={() => onFocus(ev.provinceId!)}>Show {state.provinces[ev.provinceId].name} on the map</button>}
      <div className="choices">
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
      </div>
    </Modal>
  )
}

export function BattleModal({ report: b, onClose }: { report: BattleReport; onClose: () => void }) {
  const lost = (start: BattleReport['attackerStart'], end: BattleReport['attackerEnd']) => armySize(start) - armySize(end)
  const won = b.winner === 'attacker'
  const maxPower = Math.max(1, ...b.rounds.map((r) => Math.max(r.attackerPower, r.defenderPower)))
  return (
    <Modal onClose={onClose} wide>
      <div className="eyebrow">Turn {b.turn} · {TERRAINS[b.terrain].name}</div>
      <h2>{b.kind === 'rebellion' ? 'Uprising' : 'Battle'} of {b.provinceName}</h2>
      <p className="battle-summary">
        <b>{b.attackerName}</b> attacked <b>{b.defenderName}</b>.{' '}
        <span className={won ? 'warn' : 'ok'}>
          {won ? (b.kind === 'rebellion' ? 'The rebels prevailed and the province broke away.' : `${b.attackerName} carried the field${b.conquered ? ' and took the province' : ''}.`) : `${b.defenderName} held.`}
        </span>
      </p>
      <div className="battle-grid">
        <div>
          <table className="tbl">
            <thead><tr><th>Unit</th><th className="num">Atk start</th><th className="num">Atk end</th><th className="num">Def start</th><th className="num">Def end</th></tr></thead>
            <tbody>
              {UNIT_ORDER.filter((k) => b.attackerStart[k] || b.defenderStart[k]).map((k) => (
                <tr key={k}><td>{UNITS[k].name}</td><td className="num">{b.attackerStart[k]}</td><td className="num">{b.attackerEnd[k]}</td><td className="num">{b.defenderStart[k]}</td><td className="num">{b.defenderEnd[k]}</td></tr>
              ))}
              <tr><td><b>Losses</b></td><td className="num bad" colSpan={2}>-{lost(b.attackerStart, b.attackerEnd)}</td><td className="num bad" colSpan={2}>-{lost(b.defenderStart, b.defenderEnd)}</td></tr>
            </tbody>
          </table>
        </div>
        {b.rounds.length > 0 && (
          <div>
            <div className="rounds">
              {b.rounds.map((r) => (
                <div key={r.round} className="round">
                  <div className="round-label">Round {r.round}</div>
                  <div className="power-bars">
                    <div className="pb atk" style={{ width: `${(r.attackerPower / maxPower) * 100}%` }} title={`Attacker power ${r.attackerPower}`}><span>{r.attackerPower}</span></div>
                    <div className="pb def" style={{ width: `${(r.defenderPower / maxPower) * 100}%` }} title={`Defender power ${r.defenderPower}`}><span>{r.defenderPower}</span></div>
                  </div>
                  <div className="round-meta">
                    <span>losses <b className="bad">{r.attackerLosses}</b> / <b className="bad">{r.defenderLosses}</b></span>
                    <span>morale <b>{r.attackerMorale}</b> / <b>{r.defenderMorale}</b></span>
                  </div>
                </div>
              ))}
            </div>
            <p className="muted small">Gold bars are the attacker, blue the defender. A side routs when its morale drops below 30; attackers who cannot break the defence in eight rounds withdraw.</p>
          </div>
        )}
      </div>
      <div className="row end"><button className="btn primary" onClick={onClose}>Close</button></div>
    </Modal>
  )
}

export function TurnReportModal({ state, onClose, onShowBattle, onFocus }: { state: GameState; onClose: () => void; onShowBattle: (id: number) => void; onFocus?: (id: number) => void }) {
  const lastTurn = state.turn - 1
  const entries = state.log.filter((e) => e.turn === lastTurn && e.kind !== 'info' && e.important)
  const battles = state.battles.filter((b) => state.lastTurnBattles.includes(b.id))
  return (
    <Modal onClose={onClose}>
      <div className="eyebrow">Year {state.startYear + lastTurn - 1}</div>
      <h2>Turn {lastTurn} report</h2>
      {battles.length > 0 && (
        <>
          <h3>Battles involving us</h3>
          {battles.map((b) => (
            <div key={b.id} className="report-battle">
              <button className="btn choice" onClick={() => onShowBattle(b.id)}>
                <b>{b.provinceName}</b>: {b.attackerName} vs {b.defenderName}
                <span className="desc">{b.winner === 'attacker' ? `${b.attackerName} won${b.conquered ? ' and took the province' : ''}` : `${b.defenderName} held`}</span>
              </button>
              {onFocus && <button className="btn small" onClick={() => onFocus(b.provinceId)}>Locate</button>}
            </div>
          ))}
        </>
      )}
      <h3>Happenings</h3>
      {entries.length === 0 ? <p className="muted">A quiet turn.</p> : entries.map((e) => <div key={e.id} className={'log-entry kind-' + e.kind}><span className="toast-dot" />{e.text}</div>)}
      <div className="row end"><button className="btn primary" onClick={onClose}>Continue</button></div>
    </Modal>
  )
}

export function GameOverModal({ state, onNewGame, onContinue }: { state: GameState; onNewGame: () => void; onContinue: () => void }) {
  const player = playerNation(state)
  const won = state.winner === player.id
  const ranked = state.nations.map((n) => ({ n, s: nationScore(state, n) })).sort((a, b) => b.s - a.s)
  return (
    <Modal>
      <div className="eyebrow">{won ? 'Triumph' : 'The chronicle closes'}</div>
      <h2 className={won ? 'gold' : ''}>{won ? 'Victory!' : 'The end of an age'}</h2>
      <p>{state.gameOverReason}</p>
      <table className="tbl">
        <thead><tr><th>#</th><th>Nation</th><th className="num">Score</th></tr></thead>
        <tbody>{ranked.map((r, i) => <tr key={r.n.id}><td>{i + 1}</td><td><span className="swatch" style={{ background: r.n.color, marginRight: 6 }} />{r.n.name}{!r.n.alive && <span className="muted small"> (destroyed)</span>}</td><td className="num">{r.s}</td></tr>)}</tbody>
      </table>
      <div className="row end">
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
      <div className="row end">
        <button className="btn" onClick={onNo}>Cancel</button>
        <button className="btn danger" onClick={onYes}>Yes</button>
      </div>
    </Modal>
  )
}

export function HelpModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal onClose={onClose} wide>
      <div className="eyebrow">Guide</div>
      <h2>How to play NationState</h2>
      <div className="help-grid">
        <section>
          <h3>The goal</h3>
          <p>Hold 60% of the provinces, destroy every rival, or have the highest score when turn 150 ends. Score counts people, provinces, troops, technologies and gold.</p>
          <h3>Each turn</h3>
          <ol className="help-list">
            <li>Read the Advisor and your Objectives.</li>
            <li>Spend gold: build, recruit, or research.</li>
            <li>Move or attack with armies that have not acted. The shield counter in the top bar shows how many can still strike; press N to cycle them.</li>
            <li>Check diplomacy for offers and threats.</li>
            <li>Press Enter to end the turn.</li>
          </ol>
          <h3>Controls</h3>
          <ul className="help-list">
            <li>Click a hex to select it. Click one of your armies to command it, then click a blue tile to march or a red one to attack.</li>
            <li>Left-drag pans, right-drag rotates, scroll zooms. Two fingers on touch.</li>
            <li>Keys: Enter ends turn · 1-5 switch panels · H flies home · N next army · Tab hides the panel · Esc closes dialogs · ? opens this guide.</li>
          </ul>
        </section>
        <section>
          <h3>People and food</h3>
          <p>Population grows when fed and content. It is your tax base and your recruiting pool. Every unit levies 100 people. Food is eaten every turn; run out and famine kills people and stokes unrest. Farms raise food and capacity, granaries raise storage.</p>
          <h3>Gold and stability</h3>
          <p>Taxes come from population, markets and the tax rate. Higher taxes raise unrest; unrest, war weariness and heavy taxes lower stability; stability scales income, growth and morale. Temples, luxuries and the Tolerance edict calm the realm.</p>
          <h3>Garrisons and armies</h3>
          <p>Troops you recruit join a province's <b>garrison</b>, which defends that province and never leaves it. To attack you must <b>raise an army</b> from a garrison. Field armies march across the map on movement points, spending more in forest, hills and mountains, and they can only pass through your own and allied land. Merge them, split them, or stand them down back into a garrison.</p>
          <h3>Battle</h3>
          <p>Militia are cheap defenders. Infantry hold lines. Archers volley first and love forests. Cavalry dominate plains and fail in hills. Siege engines breach walls. Battles run in rounds; a side routs when morale drops below 30. Defenders fight as the garrison plus every friendly army standing there. Read the odds before you attack.</p>
          <h3>War and peace</h3>
          <p>Wars need a shared border and a declaration. Declaring war angers everyone and drags the target's allies in. Enemies accept peace when they are losing or weary. Gifts raise relations; alliances need relations of 60 or more.</p>
        </section>
      </div>
      <div className="row end"><button className="btn primary" onClick={onClose}>Close</button></div>
    </Modal>
  )
}
