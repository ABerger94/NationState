import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { reducer, attackTargets, type Action } from './engine/actions'
import type { Army, GameState } from './engine/types'
import { loadGame, saveGame } from './engine/persistence'
import { armySize, playerNation, yearOf } from './engine/helpers'
import { WorldMap, type Focus } from './three/WorldMap'
import type { Fx } from './three/Effects'
import { TopBar } from './ui/TopBar'
import { Toasts, type Toast } from './ui/Toasts'
import { Advisor } from './ui/Advisor'
import { Legend } from './ui/Legend'
import { QuickBar, bestSourceFor } from './ui/QuickBar'
import { Objectives } from './ui/Objectives'
import { Chevron } from './ui/icons'
import { getAdvice, type Advice } from './advisor'
import { audio } from './audio'
import { ProvincePanel } from './components/ProvincePanel'
import { NationPanel } from './components/NationPanel'
import { DiplomacyPanel } from './components/DiplomacyPanel'
import { MilitaryPanel } from './components/MilitaryPanel'
import { LogPanel } from './components/LogPanel'
import { NewGameScreen } from './components/NewGameScreen'
import { BattleModal, ConfirmModal, EventModal, GameOverModal, HelpModal, TurnReportModal } from './components/Modals'
import { Welcome } from './ui/Welcome'
import { GoalsPanel } from './ui/GoalsPanel'
import { MapModes } from './ui/MapModes'
import type { MapMode } from './engine/yields'
import { useIsMobile } from './ui/useIsMobile'

const INTRO_KEY = 'nationstate-intro-seen'

/** Scrolls the side panel so a section heading sits at the top, without touching any other scroll container. */
export function scrollPanelTo(id: string) {
  const el = document.getElementById(id)
  const panel = el?.closest('.panel') as HTMLElement | null
  if (!el || !panel) return
  const top = el.getBoundingClientRect().top - panel.getBoundingClientRect().top + panel.scrollTop - 8
  panel.scrollTo({ top, behavior: 'smooth' })
}
function introSeen(): boolean { try { return localStorage.getItem(INTRO_KEY) === '1' } catch { return false } }

type Tab = 'province' | 'nation' | 'diplomacy' | 'military' | 'log' | 'goals'
const TABS: Array<{ key: Tab; label: string; glyph: string }> = [
  { key: 'province', label: 'Province', glyph: '⬢' }, { key: 'nation', label: 'Nation', glyph: '♛' }, { key: 'diplomacy', label: 'Diplomacy', glyph: '⚖' },
  { key: 'military', label: 'Military', glyph: '⚔' }, { key: 'log', label: 'Chronicle', glyph: '✎' },
]
const GOALS_TAB = { key: 'goals' as Tab, label: 'Goals', glyph: '◈' }

export default function App() {
  const [state, dispatch] = useReducer(reducer, null, loadGame)
  const [selected, setSelected] = useState<number | null>(null)
  const [attackTarget, setAttackTarget] = useState<number | null>(null)
  const [attackPreset, setAttackPreset] = useState<number | null>(null)
  const isMobile = useIsMobile()
  const [tab, setTab] = useState<Tab>('province')
  const [panelOpen, setPanelOpen] = useState(() => !(typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches))
  const [battleId, setBattleId] = useState<number | null>(null)
  const [showReport, setShowReport] = useState(false)
  const [confirmNew, setConfirmNew] = useState(false)
  const [transferTarget, setTransferTarget] = useState<number | null>(null)
  const [dismissedGameOver, setDismissedGameOver] = useState(false)
  const [focus, setFocus] = useState<Focus | null>(null)
  const [fx, setFx] = useState<Fx[]>([])
  const [toasts, setToasts] = useState<Toast[]>([])
  const [yearOverlay, setYearOverlay] = useState<number | null>(null)
  const [muted, setMuted] = useState(audio.muted)
  const [busy, setBusy] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [mapMode, setMapMode] = useState<MapMode>('realm')
  const [showIntro, setShowIntro] = useState(() => !introSeen())

  const fxId = useRef(1)
  const toastId = useRef(1)
  const pendingAttack = useRef<{ fxId: number; from: number; to: number; army: Army } | null>(null)
  const expectBattle = useRef(false)
  const prevState = useRef<GameState | null>(state)
  const idleCursor = useRef(0)

  useEffect(() => { saveGame(state) }, [state])

  const addFx = useCallback((f: Omit<Extract<Fx, { kind: 'march' }>, 'id' | 'start'> | Omit<Extract<Fx, { kind: 'clash' }>, 'id' | 'start'>) => {
    const id = fxId.current++
    setFx((list) => [...list, { ...f, id, start: performance.now() } as Fx])
    return id
  }, [])

  const pushToasts = useCallback((items: Array<{ kind: Toast['kind']; text: string }>) => {
    const created = items.map((t) => ({ ...t, id: toastId.current++ }))
    setToasts((list) => [...list, ...created].slice(-6))
    for (const t of created) setTimeout(() => setToasts((list) => list.filter((x) => x.id !== t.id)), 7000)
  }, [])

  const focusOn = useCallback((id: number) => {
    setSelected(id)
    setAttackTarget(null)
    setFocus({ id, nonce: Date.now() })
    if (isMobile) setPanelOpen(false)
  }, [isMobile])

  const openSection = useCallback((section: 'build' | 'recruit' | 'attack' | 'move') => {
    setTab('province')
    setPanelOpen(true)
    setTimeout(() => scrollPanelTo('sec-' + section), 60)
  }, [])

  // React to state transitions: new battles, new turns, objectives, game over.
  useEffect(() => {
    const prev = prevState.current
    prevState.current = state
    if (!state) return
    const player = playerNation(state)
    const newWorld = !prev || prev.seed !== state.seed
    if (newWorld) {
      setSelected(player.capitalId)
      setAttackTarget(null)
      setTab('province')
      setDismissedGameOver(false)
      setFocus(isMobile ? { id: player.capitalId, nonce: Date.now() } : null)
      if (isMobile) setPanelOpen(false)
    } else if (selected === null || selected >= state.provinces.length) {
      setSelected(player.capitalId)
    }

    if (prev && !newWorld && state.objectives.length > prev.objectives.length) {
      const fresh = state.log.filter((e) => e.turn === state.turn && e.text.startsWith('Objective complete')).slice(-(state.objectives.length - prev.objectives.length))
      pushToasts(fresh.map((e) => ({ kind: 'event' as const, text: e.text })))
      audio.play('coin')
    }

    if (expectBattle.current) {
      expectBattle.current = false
      setBusy(false)
      const last = state.battles[state.battles.length - 1]
      if (last && last.turn === state.turn && last.attackerId === player.id) {
        const winnerColor = last.winner === 'attacker' ? player.color : (last.defenderId === null ? '#c8c8c8' : state.nations[last.defenderId].color)
        addFx({ kind: 'clash', at: last.provinceId, color: winnerColor, duration: 1000 })
        audio.play('clash')
        setTimeout(() => setBattleId(last.id), 700)
      }
    }

    if (prev && !newWorld && state.turn !== prev.turn) {
      const prevTurn = state.turn - 1
      const battles = state.battles.filter((b) => b.turn === prevTurn && !(b.attackerId === player.id && b.kind === 'battle'))
      battles.forEach((b, i) => setTimeout(() => {
        const color = b.winner === 'attacker'
          ? (b.attackerId === null ? '#e0b341' : state.nations[b.attackerId].color)
          : (b.defenderId === null ? '#c8c8c8' : state.nations[b.defenderId].color)
        addFx({ kind: 'clash', at: b.provinceId, color, duration: 900 })
        if (b.involvesPlayer) audio.play('clash')
      }, 300 + i * 160))
      const entries = state.log.filter((e) => e.turn === prevTurn && e.kind !== 'info' && e.important)
      pushToasts(entries.slice(-5).map((e) => ({ kind: e.kind, text: e.text })))
      const noteworthy = state.lastTurnBattles.length > 0 || entries.length > 0
      const prevPlayer = prev.nations.find((n) => n.isPlayer)!
      if (player.wars.some((w) => !prevPlayer.wars.includes(w))) audio.play('war')
      else if (prevPlayer.wars.some((w) => !player.wars.includes(w))) audio.play('peace')
      if (state.gameOver && !prev.gameOver) audio.play(state.winner === player.id ? 'victory' : 'defeat')
      setTimeout(() => {
        setYearOverlay(null)
        if (noteworthy && !state.gameOver) setShowReport(true)
        else if (state.pendingEvent) audio.play('event')
      }, 950)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  const onFxDone = useCallback((id: number) => {
    setFx((list) => list.filter((f) => f.id !== id))
    const pa = pendingAttack.current
    if (pa && pa.fxId === id) {
      pendingAttack.current = null
      expectBattle.current = true
      dispatch({ type: 'ATTACK', from: pa.from, to: pa.to, army: pa.army })
    }
  }, [])

  const startAttack = useCallback((from: number, to: number, army: Army) => {
    if (pendingAttack.current) return
    audio.play('march')
    setBusy(true)
    setAttackTarget(null)
    setAttackPreset(null)
    const id = addFx({ kind: 'march', from, to, color: '#3d8bff', duration: 1200 })
    pendingAttack.current = { fxId: id, from, to, army }
  }, [addFx])

  const act = useCallback((a: Action) => {
    switch (a.type) {
      case 'ATTACK': startAttack(a.from, a.to, a.army); return
      case 'BUILD': audio.play('build'); break
      case 'RECRUIT': audio.play('recruit'); break
      case 'TRADE': case 'SEND_GIFT': audio.play('coin'); break
      case 'DECLARE_WAR': audio.play('war'); break
      case 'ACCEPT_PEACE': audio.play('peace'); break
      default: audio.play('click')
    }
    dispatch(a)
  }, [startAttack])

  const endTurn = useCallback(() => {
    if (!state || state.pendingEvent || state.gameOver || pendingAttack.current) return
    audio.play('endTurn')
    setTransferTarget(null)
    setAttackTarget(null)
    setYearOverlay(yearOf(state) + 1)
    dispatch({ type: 'END_TURN' })
  }, [state])

  const targets = useMemo(() => (state && selected !== null ? attackTargets(state, selected) : []), [state, selected])
  const advice = useMemo(() => (state ? getAdvice(state) : []), [state])
  const idleArmies = useMemo(() => {
    if (!state) return []
    const player = playerNation(state)
    return state.provinces.filter((p) => p.ownerId === player.id && p.lockedTurn !== state.turn && armySize(p.garrison) - p.garrison.militia >= 2 && attackTargets(state, p.id).length > 0).map((p) => p.id)
  }, [state])

  const nextArmy = useCallback(() => {
    if (!idleArmies.length) return
    idleCursor.current = (idleCursor.current + 1) % idleArmies.length
    focusOn(idleArmies[idleCursor.current])
    setTab('province')
  }, [idleArmies, focusOn])

  const onMapSelect = useCallback((id: number) => {
    if (!state) return
    if (selected !== null && targets.includes(id)) {
      setAttackTarget(id)
      audio.play('click')
      return
    }
    setSelected(id)
    setAttackTarget(null)
    setTab('province')
    if (isMobile) setPanelOpen(false)
    audio.play('click')
  }, [state, selected, targets, isMobile])

  const anyModal = battleId !== null || showReport || confirmNew || showHelp || showIntro || !!state?.pendingEvent || (state?.gameOver && !dismissedGameOver)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return
      if (e.key === 'Escape') {
        if (showHelp) setShowHelp(false)
        else if (battleId !== null) setBattleId(null)
        else if (showReport) setShowReport(false)
        else if (confirmNew) setConfirmNew(false)
        else if (attackTarget !== null) setAttackTarget(null)
        return
      }
      if (e.key === '?') { setShowHelp((h) => !h); return }
      if (anyModal) return
      if (e.key === 'Enter') { e.preventDefault(); endTurn() }
      else if (e.key >= '1' && e.key <= '5') { setTab(TABS[parseInt(e.key, 10) - 1].key); setPanelOpen(true) }
      else if (e.key === '6' && isMobile) { setTab('goals'); setPanelOpen(true) }
      else if ((e.key === 'h' || e.key === 'H') && state) focusOn(playerNation(state).capitalId)
      else if (e.key === 'n' || e.key === 'N') nextArmy()
      else if (e.key === 'm' || e.key === 'M') setMapMode((m) => { const keys: MapMode[] = ['realm', 'food', 'wood', 'iron', 'gold', 'unrest']; return keys[(keys.indexOf(m) + 1) % keys.length] })
      else if (e.key === 'Tab') { e.preventDefault(); setPanelOpen((o) => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [anyModal, battleId, showReport, confirmNew, showHelp, attackTarget, endTurn, focusOn, nextArmy, state, isMobile])

  if (!state) {
    return <NewGameScreen onStart={(o) => { audio.play('build'); dispatch({ type: 'NEW_GAME', ...o }) }} />
  }

  const player = playerNation(state)
  const province = selected !== null ? state.provinces[selected] : null
  const battle = battleId !== null ? state.battles.find((b) => b.id === battleId) ?? null : null
  const highlight = transferTarget !== null ? [transferTarget] : []
  const hasPeaceOffer = player.peaceOffersFrom.length > 0
  const warnings = advice.filter((a) => a.level === 'danger' || a.level === 'warn').length

  const onAdvice = (a: Advice) => {
    if (a.provinceId !== undefined) focusOn(a.provinceId)
    if (a.tab) { setTab(a.tab); setPanelOpen(true) }
    else if (isMobile) setPanelOpen(false)
  }

  return (
    <div className="app">
      <WorldMap
        state={state} selected={selected} targets={targets} highlight={highlight} focus={focus}
        attackTarget={attackTarget}
        fx={fx} onFxDone={onFxDone} interactive compact={isMobile} mapMode={mapMode}
        onSelect={onMapSelect}
      />
      <TopBar
        state={state} busy={busy} muted={muted} idleArmies={idleArmies.length} warnings={warnings}
        onEndTurn={endTurn} onNewGame={() => setConfirmNew(true)}
        onToggleMute={() => { const m = !muted; audio.setMuted(m); setMuted(m); if (!m) audio.play('click') }}
        onHome={() => focusOn(player.capitalId)} onNextArmy={nextArmy}
        onHelp={() => setShowHelp(true)} onIntro={() => setShowIntro(true)}
      />

      <div className="hud">
      <MapModes mode={mapMode} onChange={(m) => { setMapMode(m); audio.play('click') }} />
      <aside className={'side' + (panelOpen ? '' : ' closed')}>
        <button className="side-handle" onClick={() => setPanelOpen(!panelOpen)} title="Toggle panel (Tab)"><Chevron className={panelOpen ? '' : 'flip'} /></button>
        <div className="tabs">
          {(isMobile ? [...TABS, GOALS_TAB] : TABS).map((t, i) => (
            <button
              key={t.key} className={'tab' + (tab === t.key ? ' active' : '')} title={`${t.label} (${i + 1})`}
              onClick={() => {
                if (isMobile && panelOpen && tab === t.key) { setPanelOpen(false); return }
                setTab(t.key)
                setPanelOpen(true)
              }}
            >
              <span className="tab-glyph" aria-hidden>{t.glyph}</span>
              <span className="tab-label">{t.label}</span>
              {t.key === 'diplomacy' && hasPeaceOffer && <span className="dot" title="Peace offer pending" />}
              {t.key === 'nation' && (!player.research || player.policies.economy === null) && <span className="dot" title="Research or edicts need attention" />}
              {t.key === 'goals' && warnings > 0 && <span className="dot" title="Advisor warnings" />}
            </button>
          ))}
        </div>
        <div className="panel">
          {tab === 'province' && (
            <ProvincePanel
              state={state} province={province} dispatch={act} onSelect={focusOn} onFocus={focusOn}
              transferTarget={transferTarget} setTransferTarget={setTransferTarget}
              attackPreset={attackPreset} onDiplomacy={() => setTab('diplomacy')}
            />
          )}
          {tab === 'nation' && <NationPanel state={state} dispatch={act} onFocus={focusOn} />}
          {tab === 'diplomacy' && <DiplomacyPanel state={state} dispatch={act} />}
          {tab === 'military' && <MilitaryPanel state={state} onSelect={(id) => { focusOn(id); setTab('province') }} onShowBattle={setBattleId} />}
          {tab === 'log' && <LogPanel state={state} />}
          {tab === 'goals' && <GoalsPanel state={state} advice={advice} onAdvice={onAdvice} onFocusNation={(id) => { focusOn(state.nations[id].capitalId); setPanelOpen(false) }} />}
        </div>
      </aside>

      {!isMobile && (
        <>
          <div className="hud-left">
            <Objectives state={state} />
            <Advisor advice={advice} onAction={onAdvice} />
          </div>
          <Legend state={state} onFocusNation={(id) => focusOn(state.nations[id].capitalId)} />
        </>
      )}
      <QuickBar
        state={state} selected={selected} attackTarget={attackTarget}
        onAttack={(from, to, army) => startAttack(from, to, army)}
        onCancelAttack={() => setAttackTarget(null)}
        onCustomise={(target) => { setAttackPreset(target); setAttackTarget(null); openSection('attack') }}
        onSection={openSection}
        onDiplomacy={() => { setTab('diplomacy'); setPanelOpen(true) }}
        onFocus={focusOn}
        onPickSource={(target) => { const src = bestSourceFor(state, target); if (src !== null) { setSelected(src); setAttackTarget(target) } }}
      />
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((l) => l.filter((t) => t.id !== id))} />
      </div>

      {showIntro && <Welcome onClose={() => { setShowIntro(false); try { localStorage.setItem(INTRO_KEY, '1') } catch { /* ignore */ } }} />}
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      {yearOverlay !== null && (
        <div className="year-overlay" key={yearOverlay}><div className="year-text">Year {yearOverlay}</div><div className="year-sub">The seasons turn</div></div>
      )}

      {state.gameOver && !dismissedGameOver && (
        <GameOverModal state={state} onContinue={() => setDismissedGameOver(true)} onNewGame={() => { dispatch({ type: 'QUIT' }); setDismissedGameOver(false) }} />
      )}
      {battle && <BattleModal report={battle} onClose={() => setBattleId(null)} />}
      {showReport && !battle && !state.gameOver && (
        <TurnReportModal state={state} onClose={() => { setShowReport(false); if (state.pendingEvent) audio.play('event') }} onShowBattle={(id) => setBattleId(id)} onFocus={focusOn} />
      )}
      {state.pendingEvent && !showReport && !battle && !state.gameOver && yearOverlay === null && (
        <EventModal state={state} onChoose={(i) => { audio.play('click'); dispatch({ type: 'RESOLVE_EVENT', choice: i }) }} onFocus={focusOn} />
      )}
      {confirmNew && (
        <ConfirmModal text="Abandon the current game and start a new one? The current save will be erased." onYes={() => { setConfirmNew(false); dispatch({ type: 'QUIT' }) }} onNo={() => setConfirmNew(false)} />
      )}
    </div>
  )
}
