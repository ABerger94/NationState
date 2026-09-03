import type { GameState, PolicyCategory, TechKey } from '../engine/types'
import { canChangePolicy, type Action } from '../engine/actions'
import { CONQUEST_SHARE, MAX_TURNS, PERSONALITIES, POLICIES, TECHS, TECH_ORDER, TRADE_PRICES } from '../engine/data'
import { armyPower, armySize, fmt, fmtSigned, nationArmy, ownedProvinces, playerNation, totalPopulation } from '../engine/helpers'
import { nationBudget, nationScore } from '../engine/economy'
import { availableTechs } from '../engine/ai'
import { provinceOutput } from '../engine/economy'
import { suggestBuilding } from '../engine/yields'
import { useState } from 'react'
import { Bar, stabilityColor } from './common'

interface Props { state: GameState; dispatch: (a: Action) => void; onFocus?: (id: number) => void }

export function NationPanel({ state, dispatch, onFocus }: Props) {
  const player = playerNation(state)
  const budget = nationBudget(state, player)
  const [tradeAmount, setTradeAmount] = useState(100)
  const avail = availableTechs(player)
  const current = player.research ? TECHS[player.research] : null
  const turnsLeft = current && budget.science > 0 ? Math.ceil((current.cost - player.researchProgress) / budget.science) : null
  const ranking = state.nations.filter((n) => n.alive).map((n) => ({
    n, provinces: ownedProvinces(state, n.id).length, pop: totalPopulation(state, n.id),
    army: armySize(nationArmy(state, n.id)), power: Math.round(armyPower(nationArmy(state, n.id))), score: nationScore(state, n),
  })).sort((a, b) => b.score - a.score)

  const conquest = ownedProvinces(state, player.id).length / state.provinces.length
  const myRank = ranking.findIndex((r) => r.n.isPlayer) + 1
  const categories: PolicyCategory[] = ['economy', 'military', 'society']

  return (
    <div>
      <h3>Victory</h3>
      <div className="card">
        <div className="row between small"><span>Conquest: {ownedProvinces(state, player.id).length} of {Math.ceil(state.provinces.length * CONQUEST_SHARE)} provinces needed</span><b>{Math.round((conquest / CONQUEST_SHARE) * 100)}%</b></div>
        <Bar value={conquest} max={CONQUEST_SHARE} color="var(--accent)" />
        <div className="row between small" style={{ marginTop: 8 }}><span>Score: rank {myRank} of {ranking.length}</span><span className="muted">{MAX_TURNS - state.turn} turns remain</span></div>
        <div className="muted small">Win by holding {Math.round(CONQUEST_SHARE * 100)}% of the map, destroying every rival, or leading the score at turn {MAX_TURNS}.</div>
      </div>

      <h3>Edicts</h3>
      <p className="muted small">One edict per sphere shapes how your realm works. The first choice in each sphere is free; changing it later costs 60 gold and needs five turns between changes.</p>
      {categories.map((cat) => {
        const current = player.policies[cat]
        const check = canChangePolicy(state, cat)
        const defs = POLICIES[cat] as Record<string, { name: string; description: string }>
        return (
          <div key={cat} className="edict-group">
            <div className="edict-cat">{cat}{current === null && <span className="warn"> · none chosen</span>}</div>
            <div className="edict-options">
              {Object.keys(defs).map((key) => {
                const active = current === key
                return (
                  <button key={key} className={'edict' + (active ? ' active' : '')} disabled={!active && !check.ok} title={active ? 'Current edict' : check.reason} onClick={() => !active && dispatch({ type: 'SET_POLICY', category: cat, value: key as never })}>
                    <b>{defs[key].name}</b>
                    <span className="muted small">{defs[key].description}</span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}

      <h3>Ledger</h3>
      <p className="muted small">Output of every province per turn. Tap a row to go there. The last column is the best next production build.</p>
      <div className="ledger-wrap">
        <table className="tbl ledger">
          <thead><tr><th>Province</th><th className="num">People</th><th className="num">Food</th><th className="num">Wood</th><th className="num">Iron</th><th className="num">Gold</th><th className="num">Sci</th><th>Next</th></tr></thead>
          <tbody>
            {ownedProvinces(state, player.id).sort((a, b) => b.population - a.population).map((p) => {
              const o = provinceOutput(state, p)
              const s = suggestBuilding(state, player, p)
              return (
                <tr key={p.id} className="clickable" onClick={() => onFocus?.(p.id)}>
                  <td>{p.isCapital ? '★ ' : ''}{p.name}</td>
                  <td className="num">{fmt(p.population)}</td>
                  <td className="num">{o.food.toFixed(1)}</td>
                  <td className="num">{o.wood.toFixed(1)}</td>
                  <td className="num">{o.iron.toFixed(1)}</td>
                  <td className="num">{o.gold.toFixed(1)}</td>
                  <td className="num">{o.science}</td>
                  <td className="small muted">{s ? ({ farm: 'Farm', lumberMill: 'Mill', mine: 'Mine', market: 'Market', university: 'Univ.' } as Record<string, string>)[s.key] ?? s.key : '—'}</td>
                </tr>
              )
            })}
            <tr className="total"><td><b>Total</b></td><td className="num"><b>{fmt(totalPopulation(state, player.id))}</b></td><td className="num"><b>{budget.income.food.toFixed(1)}</b></td><td className="num"><b>{budget.income.wood.toFixed(1)}</b></td><td className="num"><b>{budget.income.iron.toFixed(1)}</b></td><td className="num"><b>{budget.income.gold.toFixed(1)}</b></td><td className="num"><b>{budget.science}</b></td><td></td></tr>
          </tbody>
        </table>
      </div>

      <h3>Treasury</h3>
      <table className="tbl">
        <thead><tr><th></th><th className="num">Income</th><th className="num">Upkeep</th><th className="num">Net</th></tr></thead>
        <tbody>
          {(['gold', 'food', 'wood', 'iron'] as const).map((k) => (
            <tr key={k}>
              <td style={{ textTransform: 'capitalize' }}>{k}</td>
              <td className="num ok">{fmtSigned(budget.income[k])}</td>
              <td className="num bad">{budget.upkeep[k] ? '-' + fmt(budget.upkeep[k]) : '—'}</td>
              <td className={'num ' + (budget.net[k] >= 0 ? 'ok' : 'bad')}><b>{fmtSigned(budget.net[k])}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small" style={{ marginTop: 6 }}>
        {budget.luxuries > 0 && <>{budget.luxuries} luxury {budget.luxuries === 1 ? 'good' : 'goods'} soothe unrest by {budget.luxuries} per turn everywhere. </>}Troops cost {fmt(budget.unitGold)} gold and buildings {fmt(budget.buildingGold)} gold per turn. {fmt(totalPopulation(state, player.id))} people eat {fmt(budget.foodConsumption)} food per turn. Food storage caps at {budget.foodCap}.
      </p>

      <h3>Market</h3>
      <p className="muted small">Foreign merchants buy surplus and sell what you lack, at a poor rate. Selling never fills food storage beyond its cap.</p>
      <div className="row" style={{ marginBottom: 6 }}>
        <span className="muted small">Amount</span>
        <input type="number" min={10} step={10} value={tradeAmount} onChange={(e) => setTradeAmount(Math.max(1, parseInt(e.target.value, 10) || 1))} />
      </div>
      <table className="tbl">
        <tbody>
          {(['food', 'wood', 'iron'] as const).map((k) => {
            const price = TRADE_PRICES[k]
            const have = Math.floor(player.resources[k])
            const buyCost = Math.ceil(tradeAmount * price.buy)
            return (
              <tr key={k}>
                <td style={{ textTransform: 'capitalize' }}>{k} <span className="muted small">({have})</span></td>
                <td className="num">
                  <button className="btn small" disabled={have < tradeAmount} onClick={() => dispatch({ type: 'TRADE', resource: k, amount: tradeAmount, direction: 'sell' })}>Sell for {Math.floor(tradeAmount * price.sell)}g</button>
                </td>
                <td className="num">
                  <button className="btn small" disabled={player.resources.gold < buyCost} onClick={() => dispatch({ type: 'TRADE', resource: k, amount: tradeAmount, direction: 'buy' })}>Buy for {buyCost}g</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h3>Taxation</h3>
      <div className="row between"><span>Tax rate</span><b>{player.taxRate}%</b></div>
      <input type="range" min={0} max={50} step={5} value={player.taxRate} onChange={(e) => dispatch({ type: 'SET_TAX', rate: parseInt(e.target.value, 10) })} />
      <p className="muted small">Above 20% raises unrest and lowers stability; below 20% calms the provinces but starves the treasury.</p>

      <h3>Stability</h3>
      <div className="row between"><span style={{ color: stabilityColor(budget.stability) }}><b>{budget.stability}</b> / 100</span><span className="muted small">war weariness {Math.round(player.warWeariness)}</span></div>
      <Bar value={budget.stability} color={stabilityColor(budget.stability)} />
      <p className="muted small">Stability scales tax income, population growth and troop morale. It falls with unrest, war weariness and heavy taxes; temples and Philosophy raise it.</p>

      <h3>Research</h3>
      {current ? (
        <div className="card">
          <div className="row between"><b>{current.name}</b><span className="muted small">{Math.floor(player.researchProgress)} / {current.cost}{turnsLeft !== null ? ` · ${turnsLeft} turn${turnsLeft === 1 ? '' : 's'}` : ''}</span></div>
          <Bar value={player.researchProgress} max={current.cost} color="var(--info)" />
          <div className="muted small">{current.description}</div>
        </div>
      ) : <p className="warn small">No research selected. Pick a technology below.</p>}
      <table className="tbl">
        <tbody>
          {TECH_ORDER.map((t: TechKey) => {
            const def = TECHS[t]
            const known = player.techs.includes(t)
            const can = avail.includes(t)
            return (
              <tr key={t} style={{ opacity: known || can ? 1 : 0.5 }}>
                <td><b>{def.name}</b> <span className="muted small">{def.cost} sci{def.requires ? ` · needs ${TECHS[def.requires].name}` : ''}</span><div className="muted small">{def.description}</div></td>
                <td className="num">
                  {known ? <span className="ok small">Known</span> : can ? (
                    <button className="btn small" disabled={player.research === t} onClick={() => dispatch({ type: 'SET_RESEARCH', tech: t })}>{player.research === t ? 'Current' : 'Research'}</button>
                  ) : <span className="muted small">Locked</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <h3>World ranking</h3>
      <table className="tbl">
        <thead><tr><th>Nation</th><th className="num">Prov.</th><th className="num">People</th><th className="num">Army</th><th className="num">Score</th></tr></thead>
        <tbody>
          {ranking.map((r) => (
            <tr key={r.n.id}>
              <td><span className="swatch" style={{ background: r.n.color, marginRight: 6 }} />{r.n.name}{!r.n.isPlayer && <span className="muted small"> · {PERSONALITIES[r.n.personality].label}</span>}</td>
              <td className="num">{r.provinces}</td>
              <td className="num">{fmt(r.pop)}</td>
              <td className="num" title={`strength ${r.power}`}>{r.army}</td>
              <td className="num"><b>{r.score}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
