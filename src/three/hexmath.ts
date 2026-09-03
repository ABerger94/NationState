import type { Terrain } from '../engine/types'
import { COLS, ROWS } from '../engine/data'

export const HEX_R = 1
export const HEX_W = Math.sqrt(3) * HEX_R
export const MAP_W = HEX_W * (COLS + 0.5)
export const MAP_D = 1.5 * HEX_R * (ROWS - 1) + 2 * HEX_R

/** World-space x/z of a tile centre (odd-r offset layout, pointy-top hexes, map centred on the origin). */
export function tilePosition(col: number, row: number): [number, number] {
  const x = HEX_W * (col + 0.5 * (row & 1)) + HEX_W / 2 - MAP_W / 2
  const z = 1.5 * HEX_R * row + HEX_R - MAP_D / 2
  return [x, z]
}

export const TERRAIN_HEIGHT: Record<Terrain, number> = { coast: 0.16, plains: 0.3, forest: 0.42, hills: 0.66, mountains: 1.0 }
export const TERRAIN_TOP: Record<Terrain, string> = { plains: '#8ab95f', forest: '#4f8a4b', hills: '#b39d63', mountains: '#8d8f93', coast: '#cfc08a' }
export const TERRAIN_SIDE: Record<Terrain, string> = { plains: '#6d5a3c', forest: '#5a4933', hills: '#7b6547', mountains: '#585a5e', coast: '#a48f63' }

export function makeRand(seed: number): () => number {
  let s = seed | 0
  return () => {
    s = (s + 0x6d2b79f5) | 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function tileRand(seed: number, id: number, salt = 0): () => number {
  return makeRand((seed ^ Math.imul(id + 1, 2654435761) ^ Math.imul(salt + 1, 40503)) | 0)
}

export function tileHeight(terrain: Terrain, seed: number, id: number): number {
  const r = tileRand(seed, id, 7)()
  return TERRAIN_HEIGHT[terrain] * (0.9 + 0.2 * r)
}

/** Corner k (0-5) of a pointy-top hex of radius r, as [x, z]. */
export function hexCorner(k: number, r = HEX_R): [number, number] {
  const a = Math.PI / 2 + (k * Math.PI) / 3
  return [r * Math.cos(a), r * Math.sin(a)]
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

export function mixHex(a: string, b: string, t: number): string {
  const ca = hexToRgb(a)
  const cb = hexToRgb(b)
  const c = ca.map((v, i) => Math.round(v + (cb[i] - v) * t))
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}
