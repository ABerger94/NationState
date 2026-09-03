import * as THREE from 'three'
import { HEX_R } from './hexmath'

const cache = new Map<string, THREE.MeshStandardMaterial>()

export interface MatOpts {
  roughness?: number
  metalness?: number
  emissive?: string
  emissiveIntensity?: number
  transparent?: boolean
  opacity?: number
  side?: THREE.Side
}

/** Shared, cached flat-shaded materials so hundreds of props reuse a handful of GPU programs. */
export function mat(color: string, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const key = color + JSON.stringify(o)
  let m = cache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.roughness ?? 0.85,
      metalness: o.metalness ?? 0,
      emissive: o.emissive ?? '#000000',
      emissiveIntensity: o.emissiveIntensity ?? 0,
      transparent: o.transparent ?? false,
      opacity: o.opacity ?? 1,
      side: o.side ?? THREE.FrontSide,
      flatShading: true,
    })
    cache.set(key, m)
  }
  return m
}

function ring(inner: number, outer: number): THREE.RingGeometry {
  const g = new THREE.RingGeometry(inner, outer, 6)
  g.rotateZ(Math.PI / 6)
  g.rotateX(-Math.PI / 2)
  return g
}

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  cone: new THREE.ConeGeometry(0.5, 1, 6),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 8),
  sphere: new THREE.SphereGeometry(0.5, 10, 8),
  hex: new THREE.CylinderGeometry(HEX_R * 0.985, HEX_R * 0.985, 1, 6, 1),
  ring: ring(0.82, 0.96),
  ringWide: ring(0.6, 0.96),
  plane: new THREE.PlaneGeometry(1, 1),
}
