import type { GameState, Nation, Province } from '../engine/types'
import type { Action } from '../engine/actions'
import { BUILDINGS, RESOURCES, TERRAINS } from '../engine/data'
import { buildingCost, canBuild, provinceOutput } from '../engine/economy'
import { YIELD_BUILDING, YIELD_KEYS, buildingGain, describeGain, landQuality, suggestBuilding, yieldPer1k, type YieldKey } from '../engine/yields'
import { Coin, Flask, Iron, Wheat, Wood } from '../ui/icons'

const ICON: Record<YieldKey, React.ReactNode> = { food: <Wheat />, wood: <Wood />, iron: <Iron />, gold: <Coin />, science: <Flask /> }
const QUALITY_LABEL = { rich: 'Rich', fair: 'Fair', poor: 'Poor' }

interface Props { state: GameState; province: Province; player: Nation; mine: boolean; dispatch: (a: Action) => void }

/** Per-resource output, land quality and what the matching building would add. */
export function YieldsPanel({ state, province: p, player, mine, dispatch }: Props) {
  const out = provinceOutput(state, p)
  const per1k = yieldPer1k(state, p)
  const quality = landQuality(p)
  const suggestion = mine ? suggestBuilding(state, player, p) : null
  const t = TERRAINS[p.terrain]
  return (
    <div className="yields">
      <table className="tbl yields-tbl">
        <thead><tr><th>Yield</th><th className="num">Per turn</th><th className="num" title="Output per 1,000 people, so provinces can be compared">Per 1k</th><th>Land</th><th>Improve with</th></tr></thead>
        <tbody>
          {YIELD_KEYS.map((k) => {
            const b = YIELD_BUILDING[k]
            const lvl = p.buildings[b]
            const gain = mine && lvl < BUILDINGS[b].max ? buildingGain(state, p, b) : null
            const q = k === 'food' || k === 'wood' || k === 'iron' ? quality[k] : null
            const owned = p.ownerId !== null
            if ((k === 'gold' || k === 'science') && !owned) return null
            return (
              <tr key={k}>
                <td><span className={'yield-name y-' + k}>{ICON[k]} {k}</span></td>
                <td className="num"><b>{out[k].toFixed(1)}</b></td>
                <td className="num muted">{per1k[k].toFixed(1)}</td>
                <td>{q ? <span className={'quality ' + q}>{QUALITY_LABEL[q]}</span> : <span className="muted">—</span>}</td>
                <td>
                  <span className="muted small">{BUILDINGS[b].name} {lvl}/{BUILDINGS[b].max}</span>
                  {gain && gain.yields[k] !== undefined && <span className="gain"> +{gain.yields[k]!.toFixed(1)}</span>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="muted small land-note">
        {t.name}: {t.food}/{t.wood}/{t.iron} food/wood/iron per 1,000 people{t.gold ? `, +${t.gold} trade gold` : ''}.
        {p.resource && <> <span style={{ color: RESOURCES[p.resource].color }}>{RESOURCES[p.resource].glyph} {RESOURCES[p.resource].name}</span>: {RESOURCES[p.resource].description}</>}
        {p.devastation > 0.02 && <span className="bad"> Devastation cuts output by {Math.round(p.devastation * 60)}%.</span>}
      </div>
      {suggestion && (
        <div className="suggestion">
          <div>
            <div className="eyebrow">Recommended</div>
            <b>{BUILDINGS[suggestion.key].name}</b> <span className="muted small">for {buildingCost(player, suggestion.key).gold} gold</span>
            <div className="small ok">{describeGain(suggestion.gain.yields)}{suggestion.gain.note ? <span className="muted"> · {suggestion.gain.note}</span> : ''}</div>
          </div>
          {(() => { const c = canBuild(state, player, p, suggestion.key); return <button className="btn primary small" disabled={!c.ok} title={c.reason} onClick={() => dispatch({ type: 'BUILD', provinceId: p.id, building: suggestion.key })}>Build</button> })()}
        </div>
      )}
    </div>
  )
}
