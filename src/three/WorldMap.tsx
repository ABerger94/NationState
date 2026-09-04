import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import type { GameState } from '../engine/types'
import { Borders, Tile } from './Tiles'
import { StaticDecor, TileProps } from './Decor'
import { Effects, type Fx } from './Effects'
import { LabelLOD, Labels } from './Labels'
import { MAP_D, MAP_W, tileHeight, tilePosition } from './hexmath'
import { mapModeTile, type MapMode } from '../engine/yields'
import { Armies } from './Armies'

export interface Focus { id: number; nonce: number }

interface Props {
  state: GameState
  selected: number | null
  targets: number[]
  highlight: number[]
  attackTarget?: number | null
  focus: Focus | null
  fx: Fx[]
  onFxDone: (id: number) => void
  onSelect: (id: number) => void
  onHover?: (id: number | null) => void
  interactive: boolean
  autoRotate?: boolean
  showLabels?: boolean
  /** Phone layout: start close to the player's capital instead of framing the whole map. */
  compact?: boolean
  mapMode?: MapMode
  selectedArmy?: number | null
  onSelectArmy?: (id: number) => void
}

const skyMaterial = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: {
    top: { value: new THREE.Color('#0b1428') },
    mid: { value: new THREE.Color('#2f4d78') },
    bottom: { value: new THREE.Color('#c58b5e') },
  },
  vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 top; uniform vec3 mid; uniform vec3 bottom; varying vec3 vP;
    void main(){ float h = normalize(vP).y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.55)) : mix(mid, bottom, pow(-h, 0.9)); gl_FragColor = vec4(c, 1.0); }`,
})

function Sky() {
  return (
    <mesh material={skyMaterial} frustumCulled={false}>
      <sphereGeometry args={[120, 24, 16]} />
    </mesh>
  )
}

function Water() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      { uTime: { value: 0 }, deep: { value: new THREE.Color('#1c4f74') }, shallow: { value: new THREE.Color('#3389ad') } },
    ]),
    vertexShader: `varying vec3 vW;
#include <fog_pars_vertex>
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vW = wp.xyz;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`,
    fragmentShader: `uniform float uTime; uniform vec3 deep; uniform vec3 shallow; varying vec3 vW;
#include <fog_pars_fragment>
void main(){
  float w1 = sin(vW.x * 1.7 + uTime * 0.9) * sin(vW.z * 1.4 - uTime * 0.7);
  float w2 = sin((vW.x + vW.z) * 2.6 - uTime * 1.3);
  float w = w1 * 0.6 + w2 * 0.4;
  float crest = smoothstep(0.9, 1.0, w);
  float shore = 0.0;
  vec3 c = mix(deep, shallow, 0.5 + 0.5 * w * 0.45) + crest * 0.1 + shore;
  gl_FragColor = vec4(c, 0.96);
#include <fog_fragment>
}`,
  }), [])
  useFrame(({ clock }) => { material.uniforms.uTime.value = clock.getElapsedTime() })
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} material={material} receiveShadow>
      <planeGeometry args={[160, 160]} />
    </mesh>
  )
}

function Clouds() {
  const group = useRef<THREE.Group>(null)
  const clouds = useMemo(() => Array.from({ length: 8 }, (_, i) => ({
    x: -20 + i * 5.5, z: -9 + ((i * 7) % 17), y: 7.5 + (i % 3) * 0.9, speed: 0.25 + (i % 4) * 0.08,
    puffs: [[0, 0, 0, 1.2], [0.8, 0.1, 0.3, 0.9], [-0.7, 0.05, -0.2, 0.8], [0.2, 0.25, -0.5, 0.7]] as Array<[number, number, number, number]>,
  })), [])
  useFrame((_, dt) => {
    if (!group.current) return
    group.current.children.forEach((c, i) => {
      c.position.x += clouds[i].speed * dt
      if (c.position.x > 24) c.position.x = -24
    })
  })
  return (
    <group ref={group}>
      {clouds.map((c, i) => (
        <group key={i} position={[c.x, c.y, c.z]}>
          {c.puffs.map(([px, py, pz, s], j) => (
            <mesh key={j} position={[px, py, pz]} scale={[s * 1.3, s * 0.5, s * 0.8]} castShadow>
              <sphereGeometry args={[0.6, 12, 10]} />
              <meshStandardMaterial color="#f4f6fb" roughness={1} transparent opacity={0.72} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function CameraRig({ focus, autoRotate, interactive, initialTarget }: { focus: Focus | null; autoRotate: boolean; interactive: boolean; initialTarget: [number, number, number] }) {
  const controls = useRef<OrbitControlsImpl>(null)
  const goal = useRef<THREE.Vector3 | null>(null)
  const { camera } = useThree()
  useEffect(() => {
    if (!focus) return
    goal.current = focusPositions.get(focus.id) ?? null
  }, [focus])
  useFrame((_, dt) => {
    const c = controls.current
    if (!c) return
    if (goal.current) {
      const before = c.target.clone()
      c.target.lerp(goal.current, Math.min(1, dt * 5))
      camera.position.add(c.target.clone().sub(before))
      if (c.target.distanceTo(goal.current) < 0.03) goal.current = null
    }
    const limX = MAP_W / 2 + 1
    const limZ = MAP_D / 2 + 1
    const cx = THREE.MathUtils.clamp(c.target.x, -limX, limX)
    const cz = THREE.MathUtils.clamp(c.target.z, -limZ, limZ)
    if (cx !== c.target.x || cz !== c.target.z) {
      camera.position.x += cx - c.target.x
      camera.position.z += cz - c.target.z
      c.target.x = cx
      c.target.z = cz
    }
    c.update()
  })
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      target={initialTarget}
      enableDamping
      dampingFactor={0.1}
      minDistance={4}
      maxDistance={28}
      minPolarAngle={0.2}
      maxPolarAngle={1.32}
      autoRotate={autoRotate}
      autoRotateSpeed={0.35}
      enablePan={interactive}
      enableRotate={interactive}
      enableZoom={interactive}
      screenSpacePanning={false}
      mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
      touches={{ ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE }}
    />
  )
}

const focusPositions = new Map<number, THREE.Vector3>()

export function WorldMap({ state, selected, targets, highlight, attackTarget = null, focus, fx, onFxDone, onSelect, onHover, interactive, autoRotate = false, showLabels = true, compact = false, mapMode = 'realm', selectedArmy = null, onSelectArmy }: Props) {
  const [hovered, setHoveredState] = useState<number | null>(null)
  const setHovered = useCallback((id: number | null) => { setHoveredState(id); onHover?.(id) }, [onHover])
  const initialTarget = useMemo<[number, number, number]>(() => {
    if (compact) {
      const cap = state.provinces[state.nations.find((n) => n.isPlayer)?.capitalId ?? 0]
      const [x, z] = tilePosition(cap.col, cap.row)
      return [x, 0, z]
    }
    return interactive ? [2.2, 0, 0.6] : [0, 0, 0]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactive, compact, state.seed])
  const initialCamera = useMemo<[number, number, number]>(() => compact ? [initialTarget[0], 11.5, initialTarget[2] + 6] : interactive ? [2.2, 15.6, 14.4] : [0, 11, 12], [compact, interactive, initialTarget])
  const heights = useMemo(() => state.provinces.map((p) => tileHeight(p.terrain, state.seed, p.id)), [state.seed, state.provinces.length])
  const positions = useMemo(() => state.provinces.map((p, i) => {
    const [x, z] = tilePosition(p.col, p.row)
    focusPositions.set(p.id, new THREE.Vector3(x, heights[i], z))
    return [x, heights[i], z] as [number, number, number]
  }), [state.provinces, heights])
  const playerId = state.nations.findIndex((n) => n.isPlayer)
  const modeTiles = useMemo(() => state.provinces.map((p) => mapModeTile(state, p, mapMode)), [state, mapMode])
  const besieged = useMemo(() => state.armies.filter((a) => a.siege).map((a) => a.siege!.provinceId), [state.armies])

  return (
    <div className="scene">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: initialCamera, fov: 42, near: 0.1, far: 300 }}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
        onCreated={({ gl }) => { gl.shadowMap.type = THREE.PCFSoftShadowMap }}
      >
        <Sky />
        <fog attach="fog" args={['#2f4d78', 24, 70]} />
        <ambientLight intensity={0.42} />
        <hemisphereLight args={['#a8c8ff', '#4a3a2a', 0.55]} />
        <directionalLight
          position={[9, 15, 7]} intensity={1.8} color="#fff1dc" castShadow
          shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.02}
          shadow-camera-left={-15} shadow-camera-right={15} shadow-camera-top={12} shadow-camera-bottom={-12} shadow-camera-near={1} shadow-camera-far={45}
        />
        <Water />
        <Clouds />
        <group>
          {state.provinces.map((p) => (
            <Tile
              key={p.id} p={p} state={state} height={heights[p.id]}
              selected={selected === p.id} hovered={hovered === p.id}
              target={targets.includes(p.id)} highlight={highlight.includes(p.id)} armed={attackTarget === p.id}
              modeColor={modeTiles[p.id]?.color ?? null} besieged={besieged.includes(p.id)}
              interactive={interactive} onSelect={onSelect} onHover={setHovered}
            />
          ))}
        </group>
        <Borders state={state} heights={heights} />
        <StaticDecor state={state} heights={heights} />
        {state.provinces.map((p) => <TileProps key={p.id} p={p} state={state} top={heights[p.id]} />)}
        <Armies state={state} heights={heights} selectedArmy={selectedArmy} onSelectArmy={onSelectArmy ?? (() => {})} interactive={interactive} />
        {showLabels && <Labels state={state} heights={heights} playerId={playerId} modeLabels={mapMode === 'realm' ? null : modeTiles.map((m) => m?.label ?? '')} modeColor={mapMode === 'realm' ? null : mapMode} />}
        <Effects fx={fx} positions={positions} onDone={onFxDone} />
        <CameraRig focus={focus} autoRotate={autoRotate} interactive={interactive} initialTarget={initialTarget} />
        {showLabels && <LabelLOD />}
      </Canvas>
    </div>
  )
}
