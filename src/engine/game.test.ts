import { describe, expect, it } from 'vitest'
import { createGame } from './world'
import { reducer } from './actions'
import { endTurn } from './turn'
import { resolveBattle } from './military'
import { armySize, emptyArmy, ownedProvinces, playerNation } from './helpers'
import { nationBudget, buildingCost } from './economy'
import type { GameState } from './types'

const newGame = (seed = 42) => createGame({ seed, playerName: 'Testland', difficulty: 'normal' })

describe('world generation', () => {
  it('is deterministic for a given seed', () => {
    expect(JSON.stringify(newGame(7))).toEqual(JSON.stringify(newGame(7)))
    expect(JSON.stringify(newGame(7))).not.toEqual(JSON.stringify(newGame(8)))
  })
  it('creates six nations with three provinces each', () => {
    const s = newGame()
    expect(s.nations).toHaveLength(6)
    for (const n of s.nations) expect(ownedProvinces(s, n.id)).toHaveLength(3)
    expect(s.provinces.every((p) => p.neighbors.length >= 2 && p.neighbors.length <= 6)).toBe(true)
  })
})

describe('battles', () => {
  it('an overwhelming attacker wins and takes losses', () => {
    const s = newGame()
    const p = s.provinces.find((q) => q.ownerId === null)!
    const r = resolveBattle(s, { attackerId: 0, defenderId: null, attacker: { ...emptyArmy(), infantry: 20, cavalry: 5 }, defender: { ...emptyArmy(), militia: 2 }, province: p, kind: 'battle' })
    expect(r.winner).toBe('attacker')
    expect(armySize(r.defenderEnd)).toBe(0)
    expect(r.rounds.length).toBeGreaterThan(0)
  })
  it('an empty garrison falls without a fight', () => {
    const s = newGame()
    const p = s.provinces.find((q) => q.ownerId === null)!
    const r = resolveBattle(s, { attackerId: 0, defenderId: null, attacker: { ...emptyArmy(), militia: 1 }, defender: emptyArmy(), province: p, kind: 'battle' })
    expect(r.winner).toBe('attacker')
    expect(r.rounds).toHaveLength(0)
  })
  it('a walled hill fort repels a weak assault', () => {
    const s = newGame()
    const p = s.provinces.find((q) => q.ownerId === null && q.terrain !== 'plains')!
    p.buildings.walls = 3
    const r = resolveBattle(s, { attackerId: 0, defenderId: null, attacker: { ...emptyArmy(), militia: 3 }, defender: { ...emptyArmy(), infantry: 6 }, province: p, kind: 'battle' })
    expect(r.winner).toBe('defender')
  })
})

describe('reducer', () => {
  it('building deducts cost and raises the level', () => {
    const s = newGame()
    const player = playerNation(s)
    const cap = s.provinces[player.capitalId]
    const cost = buildingCost(player, 'farm')
    const next = reducer(s, { type: 'BUILD', provinceId: cap.id, building: 'farm' }) as GameState
    expect(next.provinces[cap.id].buildings.farm).toBe(cap.buildings.farm + 1)
    // The first construction also completes the 'Lay the first stone' objective (+30 gold).
    expect(next.nations[0].resources.gold).toBe(player.resources.gold - cost.gold + 30)
  })
  it('rejects attacks on provinces you are not at war with', () => {
    const s = newGame()
    const player = playerNation(s)
    const border = ownedProvinces(s, 0).find((p) => p.neighbors.some((i) => s.provinces[i].ownerId !== null && s.provinces[i].ownerId !== 0))
    if (!border) return
    const target = border.neighbors.find((i) => s.provinces[i].ownerId !== null && s.provinces[i].ownerId !== 0)!
    const next = reducer(s, { type: 'ATTACK', from: border.id, to: target, army: { ...border.garrison } })
    expect(next).toBe(s)
    void player
  })
  it('conquers an independent province with a strong army', () => {
    const s = newGame()
    const player = playerNation(s)
    const cap = s.provinces[player.capitalId]
    cap.garrison.infantry = 30
    const target = cap.neighbors.find((i) => s.provinces[i].ownerId === null)!
    const next = reducer(s, { type: 'ATTACK', from: cap.id, to: target, army: { ...emptyArmy(), infantry: 30 } }) as GameState
    expect(next.provinces[target].ownerId).toBe(0)
    expect(next.provinces[target].lockedTurn).toBe(next.turn)
    expect(next.battles.at(-1)?.conquered).toBe(true)
  })
})

describe('trade', () => {
  it('sells surplus iron for gold and refuses overdrafts', () => {
    const s = newGame()
    const gold = s.nations[0].resources.gold
    const next = reducer(s, { type: 'TRADE', resource: 'iron', amount: 50, direction: 'sell' }) as GameState
    expect(next.nations[0].resources.iron).toBe(10)
    expect(next.nations[0].resources.gold).toBe(gold + 30)
    expect(reducer(next, { type: 'TRADE', resource: 'iron', amount: 50, direction: 'sell' })).toBe(next)
  })
})

describe('simulation', () => {
  it('runs 80 turns with a passive player without breaking invariants', () => {
    let s: GameState = newGame(1234)
    for (let i = 0; i < 80 && !s.gameOver; i++) {
      if (s.pendingEvent) s = reducer(s, { type: 'RESOLVE_EVENT', choice: 0 }) as GameState
      s = endTurn(s)
      for (const n of s.nations) {
        expect(n.resources.gold).toBeGreaterThanOrEqual(0)
        expect(n.resources.food).toBeGreaterThanOrEqual(0)
        if (n.alive) expect(ownedProvinces(s, n.id).length).toBeGreaterThan(0)
        else expect(ownedProvinces(s, n.id).length).toBe(0)
        for (const w of n.wars) expect(s.nations[w].wars).toContain(n.id)
      }
      for (const p of s.provinces) {
        expect(p.population).toBeGreaterThanOrEqual(300)
        expect(Object.values(p.garrison).every((v) => v >= 0)).toBe(true)
      }
    }
    const owned = s.provinces.filter((p) => p.ownerId !== null).length
    expect(owned).toBeGreaterThan(18)
    const budget = nationBudget(s, playerNation(s))
    expect(Number.isFinite(budget.net.gold)).toBe(true)
    const summary = s.nations.map((n) => `${n.name}: ${ownedProvinces(s, n.id).length} prov, gold ${Math.round(n.resources.gold)}, techs ${n.techs.length}, wars ${n.wars.length}, alive ${n.alive}`)
    console.log(`turn ${s.turn}\n` + summary.join('\n'))
    const wars = s.log.filter((e) => e.text.includes('declared war')).length
    const emptyAi = s.provinces.filter((p) => p.ownerId !== null && p.ownerId !== 0 && armySize(p.garrison) === 0).length
    console.log('battles kept:', s.battles.length, 'war declarations in log:', wars, 'empty AI garrisons:', emptyAi)
  })
})

describe('objectives, edicts and migration', () => {
  it('completes the first objective when a building is constructed and pays the reward', () => {
    const s = newGame()
    const player = playerNation(s)
    const cap = s.provinces[player.capitalId]
    const gold = player.resources.gold
    const next = reducer(s, { type: 'BUILD', provinceId: cap.id, building: 'farm' }) as GameState
    expect(next.objectives.map((o) => o.id)).toContain('build-1')
    expect(next.nations[0].resources.gold).toBe(gold - buildingCost(player, 'farm').gold + 30)
  })
  it('first edict is free, the second change costs gold and waits for the cooldown', () => {
    const s = newGame()
    const gold = s.nations[0].resources.gold
    const a = reducer(s, { type: 'SET_POLICY', category: 'economy', value: 'agrarian' }) as GameState
    expect(a.nations[0].policies.economy).toBe('agrarian')
    expect(a.nations[0].resources.gold).toBe(gold)
    const b = reducer(a, { type: 'SET_POLICY', category: 'economy', value: 'mercantile' }) as GameState
    expect(b.nations[0].policies.economy).toBe('mercantile')
    expect(b.nations[0].resources.gold).toBe(gold - 60)
    const c = reducer(b, { type: 'SET_POLICY', category: 'economy', value: 'industrious' })
    expect(c).toBe(b)
  })
  it('agrarian edict raises food and lowers gold', () => {
    const s = newGame()
    const before = nationBudget(s, playerNation(s))
    const a = reducer(s, { type: 'SET_POLICY', category: 'economy', value: 'agrarian' }) as GameState
    const after = nationBudget(a, playerNation(a))
    expect(after.income.food).toBeGreaterThan(before.income.food)
    expect(after.income.gold).toBeLessThan(before.income.gold)
  })
  it('generates map resources and migrates old saves', async () => {
    const s = newGame()
    expect(s.provinces.some((p) => p.resource !== null)).toBe(true)
    const { migrate } = await import('./persistence')
    const old = JSON.parse(JSON.stringify(s)) as GameState
    for (const n of old.nations) { delete (n as Partial<typeof n>).policies; delete (n as Partial<typeof n>).stats }
    delete (old as Partial<GameState>).objectives
    old.version = 1
    const m = migrate(old)
    expect(m.nations[0].policies.economy).toBeNull()
    expect(m.nations[0].stats.built).toBe(0)
    expect(m.objectives).toEqual([])
    expect(m.nations[0].color).toBe('#3d8bff')
  })
})

describe('yields', () => {
  it('reports what a farm adds and recommends a production building', async () => {
    const { buildingGain, suggestBuilding, yieldPer1k, landQuality, mapModeTile } = await import('./yields')
    const s = newGame()
    const player = playerNation(s)
    const cap = s.provinces[player.capitalId]
    const gain = buildingGain(s, cap, 'farm')
    expect(gain.yields.food ?? 0).toBeGreaterThan(0)
    const sug = suggestBuilding(s, player, cap)
    expect(sug).not.toBeNull()
    expect(['farm', 'lumberMill', 'mine', 'market', 'university']).toContain(sug!.key)
    const a = yieldPer1k(s, cap)
    const b = yieldPer1k(s, { ...cap, population: 5000 })
    expect(a.food).toBeCloseTo(b.food, 5)
    expect(['rich', 'fair', 'poor']).toContain(landQuality(cap).food)
    expect(mapModeTile(s, cap, 'realm')).toBeNull()
    expect(mapModeTile(s, cap, 'food')!.label).toMatch(/^\d+\.\d$/)
  })
})
