import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { reducer, attackTargets, type Action } from './engine/actions'
import { loadGame, saveGame } from './engine/persistence'
import { playerNation } from './engine/helpers'
import { Header } from './components/Header'
import { HexMap, MapLegend } from './components/HexMap'
import { ProvincePanel } from './components/ProvincePanel'
import { NationPanel } from './components/NationPanel'
import { DiplomacyPanel } from './components/DiplomacyPanel'
import { MilitaryPanel } from './components/MilitaryPanel'
import { LogPanel } from './components/LogPanel'
import { NewGameScreen } from './components/NewGameScreen'
import { BattleModal, ConfirmModal, EventModal, GameOverModal, TurnReportModal } from './components/Modals'

type Tab = 'province' | 'nation' | 'diplomacy' | 'military' | 'log'
const TABS: Array<{ key: Tab; label: string }> = [
  { key: 'province', label: 'Province' }, { key: 'nation', label: 'Nation' }, { key: 'diplomacy', label: 'Diplomacy' },
  { key: 'military', label: 'Military' }, { key: 'log', label: 'Chronicle' },
]

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, loadGame)
  const [selected, setSelected] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('province')
  const [battleId, setBattleId] = useState<number | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)
  const [transferTarget, setTransferTarget] = useState<number | null>(null)
  const [dismissedGameOver, setDismissedGameOver] = useState(false)
  const expectBattle = useRef(false)
  const expectTurn = useRef(false)
  const lastTurn = useRef(state?.turn ?? 0)

  useEffect(() => { saveGame(state) }, [state])

  useEffect(() => {
    if (!state) return
    if (selected === null || selected >= state.provinces.length) setSelected(playerNation(state).capitalId)
    if (expectBattle.current) {
      expectBattle.current = false
      const last = state.battles[state.battles.length - 1]
      if (last && last.turn === state.turn) setBattleId(last.id)
    }
    if (expectTurn.current && state.turn !== lastTurn.current) {
      expectTurn.current = false
      const prevTurn = state.turn - 1
      const noteworthy = state.lastTurnBattles.length > 0 || state.log.some((e) => e.turn === prevTurn && e.kind !== 'info')
      if (noteworthy) setShowReport(true)
    }
    lastTurn.current = state.turn
  }, [state, selected])

  const act = (a: Action) => {
    if (a.type === 'ATTACK') expectBattle.current = true
    dispatch(a)
  }

  const targets = useMemo(() => (state && selected !== null ? attackTargets(state, selected) : []), [state, selected])

  if (!state) {
    return <NewGameScreen onStart={(o) => { setSelected(null); setDismissedGameOver(false); dispatch({ type: 'NEW_GAME', ...o }) }} />
  }

  const player = playerNation(state)
  const province = selected !== null ? state.provinces[selected] : null
  const battle = battleId !== null ? state.battles.find((b) => b.id === battleId) ?? null : null
  const highlight = transferTarget !== null ? [transferTarget] : []
  const hasPeaceOffer = player.peaceOffersFrom.length > 0

  const endTurn = () => {
    expectTurn.current = true
    setTransferTarget(null)
    dispatch({ type: 'END_TURN' })
  }

  return (
    <div className="app">
      <Header state={state} onEndTurn={endTurn} onNewGame={() => setConfirmNew(true)} />
      <div className="main">
        <div className="map-wrap">
          <HexMap state={state} selected={selected} onSelect={(id) => { setSelected(id); setTab('province') }} targets={targets} highlight={highlight} />
          <MapLegend state={state} />
        </div>
        <aside className="side">
          <div className="tabs">
            {TABS.map((t) => (
              <button key={t.key} className={'tab' + (tab === t.key ? ' active' : '')} onClick={() => setTab(t.key)}>
                {t.label}
                {t.key === 'diplomacy' && hasPeaceOffer && <span className="dot" title="Peace offer pending" />}
                {t.key === 'nation' && !player.research && <span className="dot" title="No research selected" />}
              </button>
            ))}
          </div>
          <div className="panel">
            {tab === 'province' && <ProvincePanel state={state} province={province} dispatch={act} onSelect={setSelected} transferTarget={transferTarget} setTransferTarget={setTransferTarget} />}
            {tab === 'nation' && <NationPanel state={state} dispatch={act} />}
            {tab === 'diplomacy' && <DiplomacyPanel state={state} dispatch={act} />}
            {tab === 'military' && <MilitaryPanel state={state} onSelect={(id) => { setSelected(id); setTab('province') }} onShowBattle={setBattleId} />}
            {tab === 'log' && <LogPanel state={state} />}
          </div>
        </aside>
      </div>

      {state.gameOver && !dismissedGameOver && (
        <GameOverModal state={state} onContinue={() => setDismissedGameOver(true)} onNewGame={() => { dispatch({ type: 'QUIT' }); setDismissedGameOver(false) }} />
      )}
      {battle && <BattleModal report={battle} onClose={() => setBattleId(null)} />}
      {showReport && !battle && !state.gameOver && (
        <TurnReportModal state={state} onClose={() => setShowReport(false)} onShowBattle={(id) => setBattleId(id)} />
      )}
      {state.pendingEvent && !showReport && !battle && !state.gameOver && (
        <EventModal state={state} onChoose={(i) => dispatch({ type: 'RESOLVE_EVENT', choice: i })} />
      )}
      {confirmNew && (
        <ConfirmModal text="Abandon the current game and start a new one? The current save will be erased." onYes={() => { setConfirmNew(false); dispatch({ type: 'QUIT' }) }} onNo={() => setConfirmNew(false)} />
      )}
    </div>
  )
}
