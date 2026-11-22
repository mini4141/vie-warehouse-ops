// Babylon digital-twin scene. Imports are per-module so the bundler can tree-shake @babylonjs/core.
import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera'
import { Engine } from '@babylonjs/core/Engines/engine'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Matrix, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder'
import { CreateLineSystem } from '@babylonjs/core/Meshes/Builders/linesBuilder'
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import '@babylonjs/core/Meshes/thinInstanceMesh'
import '@babylonjs/core/Culling/ray' // side effect required by scene.createPickingRay
import { Scene } from '@babylonjs/core/scene'
import type { Layout } from '@/api/types'
import { useUiStore, type CameraMode } from '@/app/uiStore'
import { perf } from '@/lib/perf'
import { STATUS_CODES, STATUS_HEX } from '@/lib/status'
import { STRIDE } from '@/telemetry/types'
import { useTelemetryStore } from '@/telemetry/store'

const SAMPLE_MS = 200
const ROBOT_Y = 0.3
const PICK_RADIUS = 1.4
const TWO_PI = Math.PI * 2

const mat = (scene: Scene, hex: string, emissive = 0.15) => {
  const m = new StandardMaterial(hex, scene)
  m.diffuseColor = Color3.FromHexString(hex)
  m.specularColor = Color3.Black()
  m.emissiveColor = Color3.FromHexString(hex).scale(emissive)
  return m
}

export interface TwinHandle {
  dispose: () => void
}

export function createTwin(canvas: HTMLCanvasElement, layout: Layout, robotIds: string[]): TwinHandle {
  const t0 = performance.now()
  const engine = new Engine(canvas, true, { stencil: false, powerPreference: 'high-performance' })
  const scene = new Scene(engine)
  scene.skipPointerMovePicking = true
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim() || '#0b0f14'
  scene.clearColor = Color4.FromHexString(`${bg}ff`)
  new HemisphericLight('sun', new Vector3(0.3, 1, 0.2), scene).intensity = 0.95

  const cx = layout.width / 2
  const cz = layout.height / 2
  const camera = new ArcRotateCamera('cam', -Math.PI / 2, 0.01, 70, new Vector3(cx, 0, cz), scene)
  camera.lowerRadiusLimit = 8
  camera.upperRadiusLimit = 120
  camera.lowerBetaLimit = 0.01
  camera.upperBetaLimit = Math.PI / 2.05
  camera.wheelPrecision = 12
  camera.panningSensibility = 60
  camera.attachControl(canvas, true)

  const freeze = (m: Mesh) => {
    m.isPickable = false
    m.freezeWorldMatrix()
    m.material?.freeze()
  }

  // Static world
  const floor = CreateGround('floor', { width: layout.width, height: layout.height }, scene)
  floor.position.set(cx, 0, cz)
  floor.material = mat(scene, '#141c26', 0.6)
  freeze(floor)

  const lines: Vector3[][] = []
  for (let x = 0; x <= layout.width; x += 5) lines.push([new Vector3(x, 0.01, 0), new Vector3(x, 0.01, layout.height)])
  for (let z = 0; z <= layout.height; z += 5) lines.push([new Vector3(0, 0.01, z), new Vector3(layout.width, 0.01, z)])
  const grid = CreateLineSystem('grid', { lines }, scene)
  grid.color = Color3.FromHexString('#2a3a50')
  freeze(grid)

  const rack = CreateBox('rack', { size: 1 }, scene)
  rack.material = mat(scene, '#3d4b60', 0.3)
  const rackM = new Float32Array(layout.racks.length * 16)
  layout.racks.forEach((r, i) => {
    const m = Matrix.Scaling(r.w, r.h, r.d).multiply(Matrix.Translation(r.x, r.h / 2, r.y))
    m.copyToArray(rackM, i * 16)
  })
  rack.thinInstanceSetBuffer('matrix', rackM, 16, true)
  rack.alwaysSelectAsActiveMesh = true
  freeze(rack)

  for (const s of layout.stations) {
    const b = CreateBox(s.id, { width: 3.5, height: 0.15, depth: 2.2 }, scene)
    b.position.set(s.x, 0.08, s.y)
    b.material = mat(scene, s.kind === 'pick' ? '#22c55e' : '#f97316', 0.4)
    freeze(b)
  }
  for (const c of layout.chargers) {
    const cyl = CreateCylinder(c.id, { diameter: 1.4, height: 0.12 }, scene)
    cyl.position.set(c.x, 0.06, c.y)
    cyl.material = mat(scene, '#fbbf24', 0.5)
    freeze(cyl)
  }

  // Robots: one mesh, one draw call, per-instance matrix + color
  const n = robotIds.length
  const robots = CreateBox('robots', { width: 1.4, height: 0.6, depth: 1.0 }, scene)
  const robotMat = new StandardMaterial('robots', scene)
  robotMat.diffuseColor = Color3.White()
  robotMat.specularColor = Color3.Black()
  robotMat.emissiveColor = new Color3(0.12, 0.12, 0.12)
  robots.material = robotMat
  robots.isPickable = false
  robots.alwaysSelectAsActiveMesh = true
  const matrices = new Float32Array(n * 16)
  for (let i = 0; i < n; i++) matrices[i * 16] = matrices[i * 16 + 5] = matrices[i * 16 + 10] = matrices[i * 16 + 15] = 1
  const colors = new Float32Array(n * 4)
  const palette = STATUS_CODES.map((s) => Color3.FromHexString(STATUS_HEX[s]))
  const lastStatus = new Int8Array(n).fill(-1)
  robots.thinInstanceSetBuffer('matrix', matrices, 16, false)
  robots.thinInstanceSetBuffer('color', colors, 4, false)

  const ring = CreateTorus('selection', { diameter: 2.2, thickness: 0.15, tessellation: 24 }, scene)
  ring.material = mat(scene, '#ffe600', 1)
  ring.isPickable = false
  ring.isVisible = false

  // UI state mirrored into plain locals so the render loop never touches stores' subscriptions
  const idxById = new Map(robotIds.map((id, i) => [id, i]))
  let selectedIdx = -1
  const hidden = new Uint8Array(STATUS_CODES.length)
  let mode: CameraMode = 'iso'
  const applyMode = (m: CameraMode) => {
    mode = m
    camera.target.set(cx, 0, cz)
    if (m === 'top') { camera.alpha = -Math.PI / 2; camera.beta = 0.01; camera.radius = 62 }
    else { camera.alpha = -Math.PI / 2.6; camera.beta = Math.PI / 3.1; camera.radius = m === 'follow' ? 22 : 74 }
  }
  const syncUi = (s: ReturnType<typeof useUiStore.getState>, force = false) => {
    selectedIdx = s.selectedRobotId ? (idxById.get(s.selectedRobotId) ?? -1) : -1
    hidden.fill(0)
    for (const h of s.hiddenStatuses) hidden[STATUS_CODES.indexOf(h)] = 1
    if (force || s.cameraMode !== mode) applyMode(s.cameraMode)
  }
  syncUi(useUiStore.getState(), true)
  const unsubUi = useUiStore.subscribe((s) => syncUi(s))

  scene.onBeforeRenderObservable.add(() => {
    const s = useTelemetryStore.getState()
    const { prev, curr } = s
    const count = Math.min(s.count, n)
    const alpha = Math.min(1, Math.max(0, (performance.now() - s.currAt) / SAMPLE_MS))
    let colorDirty = false
    for (let i = 0; i < count; i++) {
      const o = i * STRIDE
      const x = prev[o] + (curr[o] - prev[o]) * alpha
      const y = prev[o + 1] + (curr[o + 1] - prev[o + 1]) * alpha
      let dh = curr[o + 2] - prev[o + 2]
      dh -= TWO_PI * Math.round(dh / TWO_PI)
      const h = prev[o + 2] + dh * alpha
      const st = curr[o + 4] | 0
      const sc = hidden[st] ? 0 : 1
      const c = Math.cos(h) * sc
      const sn = Math.sin(h) * sc
      const b = i * 16
      matrices[b] = c
      matrices[b + 2] = sn
      matrices[b + 8] = -sn
      matrices[b + 10] = c
      matrices[b + 5] = sc
      matrices[b + 12] = x
      matrices[b + 13] = ROBOT_Y
      matrices[b + 14] = y
      if (lastStatus[i] !== st) {
        lastStatus[i] = st
        const col = palette[st] ?? palette[5]
        colors[i * 4] = col.r
        colors[i * 4 + 1] = col.g
        colors[i * 4 + 2] = col.b
        colors[i * 4 + 3] = 1
        colorDirty = true
      }
    }
    robots.thinInstanceBufferUpdated('matrix')
    if (colorDirty) robots.thinInstanceBufferUpdated('color')

    if (selectedIdx >= 0 && selectedIdx < count) {
      const o = selectedIdx * STRIDE
      const x = prev[o] + (curr[o] - prev[o]) * alpha
      const y = prev[o + 1] + (curr[o + 1] - prev[o + 1]) * alpha
      ring.isVisible = true
      ring.position.x = x
      ring.position.y = ROBOT_Y + 0.1
      ring.position.z = y
      if (mode === 'follow') {
        const tg = camera.target
        tg.x = x
        tg.z = y
      }
    } else {
      ring.isVisible = false
    }
    perf.fps = engine.getFps()
    perf.robots = count
  })

  // Click-pick: ray -> floor plane -> nearest visible robot (cheap, no GPU picking)
  let down: { x: number; y: number; t: number } | null = null
  const onDown = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY, t: performance.now() } }
  const onUp = (e: PointerEvent) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4 || performance.now() - down.t > 500) return
    const k = canvas.width / canvas.clientWidth
    const ray = scene.createPickingRay(e.offsetX * k, e.offsetY * k, Matrix.Identity(), camera)
    if (Math.abs(ray.direction.y) < 1e-6) return
    const t = (ROBOT_Y - ray.origin.y) / ray.direction.y
    const wx = ray.origin.x + ray.direction.x * t
    const wz = ray.origin.z + ray.direction.z * t
    const { curr, count } = useTelemetryStore.getState()
    let best = -1
    let bd = PICK_RADIUS
    for (let i = 0; i < Math.min(count, n); i++) {
      if (hidden[curr[i * STRIDE + 4] | 0]) continue
      const d = Math.hypot(curr[i * STRIDE] - wx, curr[i * STRIDE + 1] - wz)
      if (d < bd) { bd = d; best = i }
    }
    useUiStore.getState().selectRobot(best >= 0 ? robotIds[best] : null)
  }
  canvas.addEventListener('pointerdown', onDown)
  canvas.addEventListener('pointerup', onUp)

  // Test hook (Playwright): CSS-pixel canvas position of robot i, so e2e can click a real robot.
  const proj = new Vector3()
  window.__woc = {
    robotScreenPos: (i) => {
      const { curr } = useTelemetryStore.getState()
      proj.set(curr[i * STRIDE], ROBOT_Y, curr[i * STRIDE + 1])
      const p = Vector3.Project(proj, Matrix.Identity(), scene.getTransformMatrix(), camera.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()))
      const k = canvas.clientWidth / canvas.width
      return { x: p.x * k, y: p.y * k }
    },
  }

  const ro = new ResizeObserver(() => engine.resize())
  ro.observe(canvas)
  engine.runRenderLoop(() => scene.render())
  perf.sceneSetupMs = performance.now() - t0

  return {
    dispose: () => {
      delete window.__woc
      ro.disconnect()
      unsubUi()
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      engine.stopRenderLoop()
      scene.dispose()
      engine.dispose()
    },
  }
}
