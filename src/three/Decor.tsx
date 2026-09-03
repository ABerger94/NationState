import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import type { GameState, Province, ResourceKind, UnitKey } from '../engine/types'
import { BUILDING_ORDER } from '../engine/data'
import { armySize } from '../engine/helpers'
import { GEO, mat } from './materials'
import { hexCorner, tilePosition, tileRand } from './hexmath'

const tmp = new THREE.Object3D()
const tmpC = new THREE.Color()

interface Inst { x: number; y: number; z: number; sx: number; sy: number; sz: number; ry: number; color: string }

function Instanced({ items, geometry, roughness = 0.9, castShadow = true }: { items: Inst[]; geometry: THREE.BufferGeometry; roughness?: number; castShadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = ref.current
    if (!m) return
    items.forEach((it, i) => {
      tmp.position.set(it.x, it.y, it.z)
      tmp.rotation.set(0, it.ry, 0)
      tmp.scale.set(it.sx, it.sy, it.sz)
      tmp.updateMatrix()
      m.setMatrixAt(i, tmp.matrix)
      m.setColorAt(i, tmpC.set(it.color))
    })
    m.count = items.length
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [items])
  if (!items.length) return null
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, Math.max(1, items.length)]} castShadow={castShadow} receiveShadow frustumCulled={false}>
      <meshStandardMaterial roughness={roughness} flatShading />
    </instancedMesh>
  )
}

const CANOPY = ['#2f6b3a', '#3b7d45', '#4b8f4e', '#356f3c', '#5a9a52']
const AUTUMN = ['#8a7a3a', '#a0862f', '#6f7f3a']

/** Trees, peaks and boulders. Depends only on the seed and terrain, so it is computed once per world. */
export function StaticDecor({ state, heights }: { state: GameState; heights: number[] }) {
  const data = useMemo(() => {
    const canopy: Inst[] = []
    const trunk: Inst[] = []
    const peak: Inst[] = []
    const snow: Inst[] = []
    const rock: Inst[] = []
    for (const p of state.provinces) {
      const rnd = tileRand(state.seed, p.id, 3)
      const [cx, cz] = tilePosition(p.col, p.row)
      const top = heights[p.id]
      const trees = p.terrain === 'forest' ? 11 : p.terrain === 'hills' ? 3 : p.terrain === 'plains' ? (rnd() < 0.55 ? 2 : 0) : p.terrain === 'coast' ? (rnd() < 0.35 ? 1 : 0) : 2
      const palette = p.terrain === 'hills' ? AUTUMN.concat(CANOPY.slice(0, 2)) : CANOPY
      for (let i = 0; i < trees; i++) {
        const a = rnd() * Math.PI * 2
        const r = 0.3 + rnd() * 0.36
        const s = 0.75 + rnd() * 0.55
        const x = cx + Math.cos(a) * r
        const z = cz + Math.sin(a) * r
        canopy.push({ x, y: top + 0.1 * s + 0.16 * s, z, sx: 0.26 * s, sy: 0.34 * s, sz: 0.26 * s, ry: rnd() * Math.PI, color: palette[Math.floor(rnd() * palette.length)] })
        trunk.push({ x, y: top + 0.05 * s, z, sx: 0.06 * s, sy: 0.1 * s, sz: 0.06 * s, ry: 0, color: '#5a3d24' })
      }
      if (p.terrain === 'mountains') {
        const a = rnd() * Math.PI * 2
        const r = 0.3
        const x = cx + Math.cos(a) * r
        const z = cz + Math.sin(a) * r
        const h = 0.8 + rnd() * 0.3
        peak.push({ x, y: top + h / 2, z, sx: 0.9, sy: h, sz: 0.9, ry: rnd() * Math.PI, color: '#7d7f84' })
        snow.push({ x, y: top + h - 0.16, z, sx: 0.34, sy: 0.32, sz: 0.34, ry: rnd() * Math.PI, color: '#f2f4f7' })
        for (let i = 0; i < 2; i++) {
          const a2 = a + Math.PI * (0.6 + rnd() * 0.8)
          const r2 = 0.45 + rnd() * 0.15
          const h2 = 0.35 + rnd() * 0.25
          peak.push({ x: cx + Math.cos(a2) * r2, y: top + h2 / 2, z: cz + Math.sin(a2) * r2, sx: 0.45, sy: h2, sz: 0.45, ry: rnd() * Math.PI, color: '#6f7176' })
        }
      }
      if (p.terrain === 'hills') {
        for (let i = 0; i < 2; i++) {
          const a = rnd() * Math.PI * 2
          const r = 0.4 + rnd() * 0.2
          rock.push({ x: cx + Math.cos(a) * r, y: top + 0.02, z: cz + Math.sin(a) * r, sx: 0.5 + rnd() * 0.3, sy: 0.22, sz: 0.4 + rnd() * 0.3, ry: rnd() * Math.PI, color: '#a89162' })
        }
      }
      if (p.terrain === 'coast') {
        for (let i = 0; i < 2; i++) {
          const a = rnd() * Math.PI * 2
          rock.push({ x: cx + Math.cos(a) * 0.7, y: top + 0.02, z: cz + Math.sin(a) * 0.7, sx: 0.12, sy: 0.1, sz: 0.1, ry: rnd() * Math.PI, color: '#8d8d8d' })
        }
      }
    }
    return { canopy, trunk, peak, snow, rock }
  }, [state.seed, state.provinces, heights])

  return (
    <group>
      <Instanced items={data.canopy} geometry={GEO.cone} />
      <Instanced items={data.trunk} geometry={GEO.cyl} castShadow={false} />
      <Instanced items={data.peak} geometry={GEO.cone} roughness={1} />
      <Instanced items={data.snow} geometry={GEO.cone} roughness={0.6} castShadow={false} />
      <Instanced items={data.rock} geometry={GEO.sphere} roughness={1} />
    </group>
  )
}

function Prop({ geometry, color, x, y, z, sx, sy, sz, ry = 0, opts }: { geometry: THREE.BufferGeometry; color: string; x: number; y: number; z: number; sx: number; sy: number; sz: number; ry?: number; opts?: Parameters<typeof mat>[1] }) {
  return <mesh geometry={geometry} material={mat(color, opts)} position={[x, y + sy / 2, z]} scale={[sx, sy, sz]} rotation={[0, ry, 0]} castShadow receiveShadow />
}

const BUILDING_STYLE: Record<string, { geo: THREE.BufferGeometry; color: string; s: [number, number, number]; roof?: { color: string; h: number } }> = {
  farm: { geo: GEO.box, color: '#dcc65a', s: [0.26, 0.03, 0.26] },
  lumberMill: { geo: GEO.box, color: '#8a5a33', s: [0.16, 0.13, 0.16], roof: { color: '#5a3a22', h: 0.08 } },
  mine: { geo: GEO.cone, color: '#4b4b50', s: [0.24, 0.16, 0.24] },
  market: { geo: GEO.box, color: '#b07cd8', s: [0.2, 0.09, 0.14], roof: { color: '#f0e6ff', h: 0.05 } },
  granary: { geo: GEO.cyl, color: '#c9a55e', s: [0.15, 0.22, 0.15], roof: { color: '#8a6a3a', h: 0.08 } },
  barracks: { geo: GEO.box, color: '#a83a3a', s: [0.22, 0.12, 0.16], roof: { color: '#5a1e1e', h: 0.06 } },
  university: { geo: GEO.box, color: '#4d7fd6', s: [0.18, 0.2, 0.18], roof: { color: '#e9f0ff', h: 0.07 } },
  temple: { geo: GEO.box, color: '#ece7d9', s: [0.16, 0.12, 0.16], roof: { color: '#e0b341', h: 0.13 } },
}

const UNIT_HEIGHT: Record<UnitKey, number> = { militia: 0.1, infantry: 0.13, archers: 0.12, cavalry: 0.16, siege: 0.14 }

function resourceProps(kind: ResourceKind, cx: number, cz: number, top: number, rnd: () => number, keyStart: number): JSX.Element[] {
  const nodes: JSX.Element[] = []
  let key = keyStart
  const a = Math.PI / 2 + (rnd() - 0.5) * 0.4
  const r = kind === 'fish' ? 0.86 : 0.64
  const bx = cx + Math.cos(a) * r
  const bz = cz + Math.sin(a) * r
  const spread = (i: number, n: number, rad = 0.09) => [bx + Math.cos((i / n) * Math.PI * 2) * rad, bz + Math.sin((i / n) * Math.PI * 2) * rad]
  switch (kind) {
    case 'horses':
      for (let i = 0; i < 2; i++) {
        const [x, z] = spread(i, 2, 0.1)
        const ry = rnd() * Math.PI
        nodes.push(<Prop key={key++} geometry={GEO.box} color="#7a4a26" x={x} y={top + 0.05} z={z} sx={0.14} sy={0.07} sz={0.06} ry={ry} />)
        nodes.push(<Prop key={key++} geometry={GEO.box} color="#5a3618" x={x + Math.cos(ry) * 0.08} y={top + 0.09} z={z - Math.sin(ry) * 0.08} sx={0.05} sy={0.06} sz={0.04} ry={ry} />)
        for (let l = 0; l < 2; l++) nodes.push(<Prop key={key++} geometry={GEO.box} color="#5a3618" x={x + (l ? 0.04 : -0.04)} y={top} z={z} sx={0.02} sy={0.05} sz={0.05} ry={ry} />)
      }
      break
    case 'gems':
      for (let i = 0; i < 3; i++) { const [x, z] = spread(i, 3, 0.07); nodes.push(<Prop key={key++} geometry={GEO.cone} color="#c77dff" x={x} y={top} z={z} sx={0.09} sy={0.14 + rnd() * 0.08} sz={0.09} ry={rnd() * Math.PI} opts={{ emissive: '#7a2fd6', emissiveIntensity: 0.6, roughness: 0.2 }} />) }
      break
    case 'spices':
      for (let i = 0; i < 4; i++) { const [x, z] = spread(i, 4, 0.09); nodes.push(<Prop key={key++} geometry={GEO.sphere} color={i % 2 ? '#ff7f3f' : '#d94a1e'} x={x} y={top} z={z} sx={0.09} sy={0.08} sz={0.09} />) }
      break
    case 'wine':
      for (let i = 0; i < 3; i++) {
        const [x, z] = spread(i, 3, 0.09)
        nodes.push(<Prop key={key++} geometry={GEO.box} color="#3f7a3a" x={x} y={top} z={z} sx={0.05} sy={0.1} sz={0.16} />)
        nodes.push(<Prop key={key++} geometry={GEO.sphere} color="#8e2a5b" x={x} y={top + 0.08} z={z} sx={0.06} sy={0.06} sz={0.06} />)
      }
      break
    case 'fish':
      for (let i = 0; i < 2; i++) {
        const [x, z] = spread(i, 2, 0.12)
        nodes.push(<Prop key={key++} geometry={GEO.box} color="#7a4a26" x={x} y={top - 0.02} z={z} sx={0.16} sy={0.04} sz={0.07} ry={a} />)
        nodes.push(<Prop key={key++} geometry={GEO.cone} color="#f2f2f2" x={x} y={top + 0.02} z={z} sx={0.1} sy={0.16} sz={0.02} ry={a} />)
      }
      break
    case 'ore':
      for (let i = 0; i < 3; i++) { const [x, z] = spread(i, 3, 0.08); nodes.push(<Prop key={key++} geometry={GEO.sphere} color="#4a5058" x={x} y={top} z={z} sx={0.1} sy={0.08} sz={0.1} opts={{ metalness: 0.5, roughness: 0.4 }} />) }
      break
    case 'timber':
      for (let i = 0; i < 3; i++) nodes.push(<Prop key={key++} geometry={GEO.box} color="#6b4423" x={bx} y={top + i * 0.05} z={bz + (i === 1 ? 0 : i === 0 ? -0.04 : 0.04)} sx={0.22} sy={0.05} sz={0.05} />)
      break
    case 'fertile':
      nodes.push(<Prop key={key++} geometry={GEO.box} color="#e3c95a" x={bx} y={top} z={bz} sx={0.24} sy={0.03} sz={0.2} />)
      for (let i = 0; i < 3; i++) nodes.push(<Prop key={key++} geometry={GEO.cone} color="#f0d878" x={bx - 0.07 + i * 0.07} y={top + 0.03} z={bz} sx={0.04} sy={0.1} sz={0.04} />)
      break
  }
  return nodes
}

/** Everything on a tile that changes with play: houses, buildings, walls, banner, tower and troops. */
export function TileProps({ p, state, top }: { p: Province; state: GameState; top: number }) {
  const owner = p.ownerId === null ? null : state.nations[p.ownerId]
  const color = owner?.color ?? '#8a8378'
  const units = armySize(p.garrison)
  const buildingsKey = BUILDING_ORDER.map((b) => p.buildings[b]).join('')
  const houses = Math.min(6, Math.floor(p.population / 3200))
  const soldierKey = (Object.keys(p.garrison) as UnitKey[]).map((k) => `${k}${p.garrison[k]}`).join('')

  const content = useMemo(() => {
    const [cx, cz] = tilePosition(p.col, p.row)
    const rnd = tileRand(state.seed, p.id, 11)
    const nodes: JSX.Element[] = []
    let key = 0
    const isMountain = p.terrain === 'mountains'
    const mountainDir = isMountain ? tileRand(state.seed, p.id, 3)() * Math.PI * 2 : 0

    // Houses ring
    for (let i = 0; i < houses; i++) {
      const a = (i / Math.max(3, houses)) * Math.PI * 2 + rnd() * 0.4 + (isMountain ? mountainDir + Math.PI : 0)
      const r = 0.26 + rnd() * 0.06
      const x = cx + Math.cos(a) * r
      const z = cz + Math.sin(a) * r
      const s = 0.09 + rnd() * 0.03
      nodes.push(<Prop key={key++} geometry={GEO.box} color="#e2d5b5" x={x} y={top} z={z} sx={s} sy={s} sz={s} ry={rnd() * Math.PI} />)
      nodes.push(<Prop key={key++} geometry={GEO.cone} color="#9a4a3a" x={x} y={top + s} z={z} sx={s * 1.5} sy={s * 0.9} sz={s * 1.5} ry={rnd() * Math.PI} />)
    }
    // Buildings in outer slots
    let slot = 0
    for (const b of BUILDING_ORDER) {
      const lvl = p.buildings[b]
      if (!lvl || b === 'walls') continue
      const style = BUILDING_STYLE[b]
      const copies = Math.min(lvl, 2)
      for (let c = 0; c < copies; c++) {
        const a = ((slot % 8) / 8) * Math.PI * 2 + Math.PI / 8 + (isMountain ? mountainDir + Math.PI * 0.55 : 0)
        const r = 0.5 + (slot >= 8 ? 0.12 : 0)
        const x = cx + Math.cos(a) * r
        const z = cz + Math.sin(a) * r
        const grow = 1 + (lvl - 1) * 0.12
        nodes.push(<Prop key={key++} geometry={style.geo} color={style.color} x={x} y={top} z={z} sx={style.s[0] * grow} sy={style.s[1] * grow} sz={style.s[2] * grow} ry={-a} />)
        if (style.roof) nodes.push(<Prop key={key++} geometry={GEO.cone} color={style.roof.color} x={x} y={top + style.s[1] * grow} z={z} sx={style.s[0] * grow * 1.35} sy={style.roof.h * grow} sz={style.s[2] * grow * 1.35} ry={-a} />)
        slot++
      }
    }
    // Walls
    if (p.buildings.walls > 0) {
      const wr = 0.78
      const h = 0.07 + 0.06 * p.buildings.walls
      for (let k = 0; k < 6; k++) {
        const [ax, az] = hexCorner(k, wr)
        const [bx, bz] = hexCorner(k + 1, wr)
        nodes.push(<Prop key={key++} geometry={GEO.box} color="#9c9a94" x={cx + (ax + bx) / 2} y={top} z={cz + (az + bz) / 2} sx={wr} sy={h} sz={0.06} ry={-Math.atan2(bz - az, bx - ax)} />)
        nodes.push(<Prop key={key++} geometry={GEO.cyl} color="#84827c" x={cx + ax} y={top} z={cz + az} sx={0.1} sy={h + 0.05} sz={0.1} />)
      }
    }
    // Centre piece: tower for capitals, banner for owned land, cairn for independents
    const ox = isMountain ? Math.cos(mountainDir + Math.PI) * 0.18 : 0
    const oz = isMountain ? Math.sin(mountainDir + Math.PI) * 0.18 : 0
    if (owner) {
      if (p.isCapital) {
        nodes.push(<Prop key={key++} geometry={GEO.cyl} color="#d9d0bd" x={cx + ox} y={top} z={cz + oz} sx={0.22} sy={0.5} sz={0.22} />)
        nodes.push(<Prop key={key++} geometry={GEO.cone} color={color} x={cx + ox} y={top + 0.5} z={cz + oz} sx={0.3} sy={0.22} sz={0.3} />)
        nodes.push(<Prop key={key++} geometry={GEO.cyl} color="#2b2b2b" x={cx + ox} y={top + 0.7} z={cz + oz} sx={0.02} sy={0.3} sz={0.02} />)
        nodes.push(<Prop key={key++} geometry={GEO.box} color={color} x={cx + ox + 0.09} y={top + 0.88} z={cz + oz} sx={0.18} sy={0.1} sz={0.012} opts={{ emissive: color, emissiveIntensity: 0.25 }} />)
      } else {
        nodes.push(<Prop key={key++} geometry={GEO.cyl} color="#2b2b2b" x={cx + ox} y={top} z={cz + oz} sx={0.02} sy={0.55} sz={0.02} />)
        nodes.push(<Prop key={key++} geometry={GEO.box} color={color} x={cx + ox + 0.09} y={top + 0.42} z={cz + oz} sx={0.18} sy={0.1} sz={0.012} opts={{ emissive: color, emissiveIntensity: 0.25 }} />)
      }
    } else {
      nodes.push(<Prop key={key++} geometry={GEO.cone} color="#7d7568" x={cx + ox} y={top} z={cz + oz} sx={0.16} sy={0.14} sz={0.16} />)
    }
    if (p.resource) nodes.push(...resourceProps(p.resource, cx, cz, top, rnd, key)), key += 40
    if (owner?.isPlayer && p.isCapital) {
      nodes.push(
        <mesh key={key++} position={[cx + ox, top + 2.1, cz + oz]}>
          <cylinderGeometry args={[0.1, 0.34, 3.2, 12, 1, true]} />
          <meshBasicMaterial color={color} transparent opacity={0.16} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>,
      )
    }
    // Troops
    if (units > 0) {
      const figures = Math.min(9, Math.ceil(units / 2))
      const kinds = (Object.keys(p.garrison) as UnitKey[]).filter((k) => p.garrison[k] > 0)
      const baseA = -Math.PI / 2
      for (let i = 0; i < figures; i++) {
        const row = Math.floor(i / 3)
        const col = i % 3
        const a = baseA + (col - 1) * 0.22
        const r = 0.68 - row * 0.13
        const x = cx + Math.cos(a) * r
        const z = cz + Math.sin(a) * r
        const kind = kinds[i % kinds.length]
        const h = UNIT_HEIGHT[kind]
        nodes.push(<Prop key={key++} geometry={GEO.cyl} color={color} x={x} y={top} z={z} sx={0.07} sy={h} sz={0.07} />)
        nodes.push(<Prop key={key++} geometry={GEO.sphere} color="#e8c9a0" x={x} y={top + h} z={z} sx={0.06} sy={0.06} sz={0.06} />)
        if (kind === 'cavalry') nodes.push(<Prop key={key++} geometry={GEO.box} color="#6b4a2f" x={x} y={top} z={z + 0.02} sx={0.07} sy={0.06} sz={0.16} />)
        if (kind === 'siege') nodes.push(<Prop key={key++} geometry={GEO.box} color="#7a5a3a" x={x} y={top} z={z} sx={0.12} sy={0.05} sz={0.16} />)
      }
    }
    return nodes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.id, p.col, p.row, p.terrain, p.resource, state.seed, top, buildingsKey, houses, p.isCapital, color, owner === null, owner?.isPlayer, units, soldierKey])

  return <group>{content}</group>
}
