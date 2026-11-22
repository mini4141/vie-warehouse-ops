// Client-side stand-in for the FastAPI simulator: same rules, simplified, seeded.
import type {
  DashboardSummary, KpiPoint, Layout, Order, OrderDetail, OrderStatus, OrdersResponse, Point, Priority,
  Robot, RobotCommand, RobotDetail, RobotStatus, Severity, Task, WocEvent,
} from '@/api/types'
import { STATUS_CODES } from '@/lib/status'
import { STRIDE } from '../types'
import { AISLE_YS, buildLayout, locationLabel, route } from './layout'

const TICK = 0.2
const CUSTOMERS = ['Acme Retail', 'Globex', 'Initech', 'Umbrella Foods', 'Stark Logistics', 'Wayne Supply', 'Hooli', 'Soylent']
const PRIORITIES: Priority[] = ['low', 'normal', 'normal', 'high']

type Phase = 'toPick' | 'picking' | 'toStation' | 'toCharger' | 'charging' | null

interface Sim {
  r: Robot
  route: Point[]
  ri: number
  phase: Phase
  paused: boolean
  faultUntil: number
  pickUntil: number
  lowFlag: boolean
  index: number
}
interface SimTask extends Task { handheld: boolean; confirmed: boolean }

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pad = (n: number, w: number) => String(n).padStart(w, '0')

export class MockWorld {
  layout: Layout = buildLayout()
  private rnd: () => number
  private simTime = 0
  private sims: Sim[] = []
  private tasks: SimTask[] = []
  private orders: Order[] = []
  private events: WocEvent[] = []
  private series: KpiPoint[] = []
  private lineStamps: number[] = []
  private nextOrderAt = 2
  private nextKpiAt = 5
  private eventSeq = 0
  private taskSeq = 0
  private orderSeq = 0
  private listeners = new Set<(e: WocEvent) => void>()

  constructor(seed = 42, robots = 200) {
    this.rnd = mulberry32(seed)
    for (let i = 0; i < robots; i++) {
      const aisle = Math.floor(this.rnd() * AISLE_YS.length)
      const r: Robot = {
        id: `R-${pad(i + 1, 3)}`,
        kind: i % 10 === 0 ? 'forklift' : 'amr',
        status: 'idle',
        battery: 40 + this.rnd() * 60,
        x: 2 + this.rnd() * 56,
        y: AISLE_YS[aisle],
        heading: 0,
        speed: 0,
        taskId: null,
        lastSeen: new Date().toISOString(),
      }
      this.sims.push({ r, route: [], ri: 0, phase: null, paused: false, faultUntil: 0, pickUntil: 0, lowFlag: false, index: i })
    }
    for (let i = 0; i < 4; i++) this.sims[Math.floor(this.rnd() * robots)].r.status = 'offline'
    this.seedHistory()
  }

  private seedHistory() {
    const now = Date.now()
    for (let i = 0; i < 60; i++) {
      const n = 1 + Math.floor(this.rnd() * 5)
      const created = now - (60 - i) * 90_000
      const id = `O-${pad(++this.orderSeq, 5)}`
      this.orders.push({
        id, customer: this.pick(CUSTOMERS), priority: this.pick(PRIORITIES),
        status: this.rnd() < 0.9 ? 'completed' : 'short', lineCount: n, linesDone: n,
        createdAt: new Date(created).toISOString(), dueAt: new Date(created + 20 * 60_000).toISOString(),
      })
      for (let l = 0; l < n; l++) {
        const aisle = Math.floor(this.rnd() * AISLE_YS.length)
        const x = 5 + this.rnd() * 50
        const st = this.pick(this.layout.stations)
        this.tasks.push({
          id: `T-${pad(++this.taskSeq, 5)}`, orderId: id, type: 'pick', status: 'done', robotId: `R-${pad(1 + Math.floor(this.rnd() * 200), 3)}`,
          from: { x, y: AISLE_YS[aisle] }, to: { x: st.x, y: st.y }, sku: `SKU-${1000 + Math.floor(this.rnd() * 9000)}`,
          qty: 1 + Math.floor(this.rnd() * 8), locationLabel: locationLabel(aisle, x), startedAt: new Date(created + 30_000).toISOString(),
          finishedAt: new Date(created + 120_000).toISOString(), handheld: false, confirmed: true,
        })
      }
    }
    for (let i = 0; i < 40; i++) {
      this.pushEvent(this.pick<[Severity, string]>([['info', 'ORDER_DONE'], ['warn', 'LOW_BATTERY'], ['info', 'ORDER_CREATED']]), {}, null, null, now - (40 - i) * 45_000)
    }
    for (let i = 0; i < 60; i++) {
      this.series.push({ ts: new Date(now - (60 - i) * 5000).toISOString(), linesPerMin: 8 + this.rnd() * 6, utilization: 0.3 + this.rnd() * 0.15 })
    }
  }

  private pick<T>(arr: T[]): T {
    return arr[Math.floor(this.rnd() * arr.length)]
  }

  private pushEvent(sev: [Severity, string], params: WocEvent['params'], robotId: string | null, orderId: string | null, ts = Date.now()) {
    const e: WocEvent = { id: ++this.eventSeq, ts: new Date(ts).toISOString(), severity: sev[0], code: sev[1], robotId, orderId, params }
    this.events.push(e)
    if (this.events.length > 500) this.events.shift()
    this.listeners.forEach((l) => l(e))
    return e
  }

  onEvent(cb: (e: WocEvent) => void) {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  // ---- simulation ----
  private createOrder(): Order {
    const n = 1 + Math.floor(this.rnd() * 5)
    const now = Date.now()
    const order: Order = {
      id: `O-${pad(++this.orderSeq, 5)}`, customer: this.pick(CUSTOMERS), priority: this.pick(PRIORITIES), status: 'queued',
      lineCount: n, linesDone: 0, createdAt: new Date(now).toISOString(), dueAt: new Date(now + (10 + this.rnd() * 20) * 60_000).toISOString(),
    }
    const stations = this.layout.stations
    for (let i = 0; i < n; i++) {
      const aisle = Math.floor(this.rnd() * AISLE_YS.length)
      const x = 5 + this.rnd() * 50
      const st = this.pick(stations)
      this.tasks.push({
        id: `T-${pad(++this.taskSeq, 5)}`, orderId: order.id, type: 'pick', status: 'pending', robotId: null,
        from: { x, y: AISLE_YS[aisle] }, to: { x: st.x, y: st.y }, sku: `SKU-${1000 + Math.floor(this.rnd() * 9000)}`,
        qty: 1 + Math.floor(this.rnd() * 8), locationLabel: locationLabel(aisle, x), startedAt: null, finishedAt: null,
        handheld: this.rnd() < 0.15, confirmed: false,
      })
    }
    this.orders.push(order)
    this.pushEvent(['info', 'ORDER_CREATED'], { lines: n }, null, order.id)
    return order
  }

  private setRoute(s: Sim, to: Point, phase: Phase) {
    s.route = route({ x: s.r.x, y: s.r.y }, to)
    s.ri = 0
    s.phase = phase
    s.r.status = 'moving'
  }

  private nearest<T extends Point>(list: T[], p: Point): T {
    return list.reduce((b, c) => (Math.hypot(c.x - p.x, c.y - p.y) < Math.hypot(b.x - p.x, b.y - p.y) ? c : b))
  }

  private assign() {
    for (const t of this.tasks) {
      if (t.status !== 'pending') continue
      let best: Sim | null = null
      let bd = Infinity
      for (const s of this.sims) {
        if (s.r.status !== 'idle' || s.paused || s.r.taskId || s.r.battery < 25) continue
        const d = Math.abs(s.r.x - t.from.x) + Math.abs(s.r.y - t.from.y)
        if (d < bd) { bd = d; best = s }
      }
      if (!best) return
      t.status = 'active'
      t.robotId = best.r.id
      t.startedAt = new Date().toISOString()
      best.r.taskId = t.id
      this.setRoute(best, t.from, 'toPick')
      const o = this.orders.find((x) => x.id === t.orderId)
      if (o && o.status === 'queued') o.status = 'in_progress'
    }
  }

  private advance(s: Sim): boolean {
    let dist = (s.r.kind === 'forklift' ? 1.2 : 1.5) * TICK
    while (dist > 0 && s.ri < s.route.length) {
      const p = s.route[s.ri]
      const dx = p.x - s.r.x
      const dy = p.y - s.r.y
      const d = Math.hypot(dx, dy)
      if (d > 1e-6) s.r.heading = Math.atan2(dy, dx)
      if (d <= dist) { s.r.x = p.x; s.r.y = p.y; dist -= d; s.ri++ } else { s.r.x += (dx / d) * dist; s.r.y += (dy / d) * dist; dist = 0 }
    }
    return s.ri >= s.route.length
  }

  tick() {
    this.simTime += TICK
    if (this.simTime >= this.nextOrderAt) { this.createOrder(); this.nextOrderAt = this.simTime + 3 }
    this.assign()
    for (const s of this.sims) this.step(s)
    if (this.simTime >= this.nextKpiAt) {
      this.nextKpiAt += 5
      const sum = this.summary()
      this.series = [...this.series.slice(-59), { ts: new Date().toISOString(), linesPerMin: sum.linesPerMin, utilization: sum.utilization }]
    }
  }

  private step(s: Sim) {
    const r = s.r
    if (r.status === 'offline') return
    if (r.battery < 20 && !s.lowFlag) {
      s.lowFlag = true
      this.pushEvent(['warn', 'LOW_BATTERY'], { battery: Math.round(r.battery) }, r.id, null)
    }
    if (r.status === 'fault') {
      if (this.simTime >= s.faultUntil) {
        r.status = s.phase === 'picking' ? 'picking' : 'moving'
        if (!s.phase) r.status = 'idle'
        this.pushEvent(['info', 'ROBOT_RECOVERED'], {}, r.id, null)
      }
      r.speed = 0
      return
    }
    if (s.paused) { r.speed = 0; return }
    r.speed = r.status === 'moving' ? (r.kind === 'forklift' ? 1.2 : 1.5) : 0
    if (r.status === 'moving') {
      r.battery = Math.max(0, r.battery - 0.15 * TICK)
      if (this.rnd() < (0.005 / 60) * TICK) return this.fault(s, 'motor')
      if (this.advance(s)) this.arrive(s)
    } else if (r.status === 'picking') {
      const t = this.tasks.find((x) => x.id === r.taskId)
      if (t && this.simTime >= s.pickUntil && (!t.handheld || t.confirmed)) this.setRoute(s, t.to, 'toStation')
    } else if (r.status === 'charging') {
      r.battery = Math.min(100, r.battery + 2 * TICK)
      if (r.battery >= 90) { r.status = 'idle'; s.phase = null; s.lowFlag = false }
    } else if (r.status === 'idle' && r.battery < 20) {
      this.setRoute(s, this.nearest(this.layout.chargers, r), 'toCharger')
    }
  }

  private arrive(s: Sim) {
    const r = s.r
    const t = this.tasks.find((x) => x.id === r.taskId)
    if (s.phase === 'toPick') { r.status = 'picking'; s.pickUntil = this.simTime + 2 } else if (s.phase === 'toStation' && t) {
      t.status = 'done'
      t.finishedAt = new Date().toISOString()
      r.taskId = null; r.status = 'idle'; s.phase = null
      this.lineStamps.push(Date.now())
      const o = this.orders.find((x) => x.id === t.orderId)
      if (o && ++o.linesDone >= o.lineCount) { o.status = 'completed'; this.pushEvent(['info', 'ORDER_DONE'], {}, r.id, o.id) }
    } else if (s.phase === 'toCharger') { r.status = 'charging'; s.phase = 'charging' }
  }

  private fault(s: Sim, reason: string) {
    s.r.status = 'fault'
    s.r.speed = 0
    s.faultUntil = this.simTime + 20
    return this.pushEvent(['error', 'ROBOT_FAULT'], { reason }, s.r.id, null)
  }

  injectFault(): WocEvent {
    const moving = this.sims.filter((s) => s.r.status === 'moving')
    return this.fault(this.pick(moving.length ? moving : this.sims.filter((s) => s.r.status !== 'offline')), 'motor')
  }

  // ---- REST-shaped reads (what MSW serves) ----
  private snap(s: Sim): Robot {
    return { ...s.r, battery: Math.round(s.r.battery), x: +s.r.x.toFixed(2), y: +s.r.y.toFixed(2), lastSeen: new Date().toISOString() }
  }
  robots(): Robot[] { return this.sims.map((s) => this.snap(s)) }
  private strip(t: SimTask): Task {
    const { handheld: _h, confirmed: _c, ...task } = t
    return task
  }
  robotDetail(id: string): RobotDetail {
    const s = this.sims.find((x) => x.r.id === id) ?? this.sims[0]
    const t = this.tasks.find((x) => x.id === s.r.taskId)
    return { ...this.snap(s), task: t ? this.strip(t) : null }
  }
  command(id: string, cmd: RobotCommand): Robot {
    const s = this.sims.find((x) => x.r.id === id) ?? this.sims[0]
    if (cmd === 'pause') { s.paused = true; s.r.speed = 0 } else if (cmd === 'resume') { s.paused = false } else {
      const t = this.tasks.find((x) => x.id === s.r.taskId)
      if (t) { t.status = 'pending'; t.robotId = null; s.r.taskId = null }
      s.paused = false
      this.setRoute(s, this.nearest(this.layout.chargers, s.r), 'toCharger')
    }
    this.pushEvent(['info', 'ROBOT_COMMAND'], { command: cmd }, id, null)
    return this.snap(s)
  }
  summary(): DashboardSummary {
    const byStatus = Object.fromEntries(STATUS_CODES.map((c) => [c, 0])) as Record<RobotStatus, number>
    for (const s of this.sims) byStatus[s.r.status]++
    const total = this.sims.length
    const online = total - byStatus.offline
    const cutoff = Date.now() - 60_000
    this.lineStamps = this.lineStamps.filter((t) => t > cutoff)
    return {
      online, total, byStatus, utilization: online ? (byStatus.moving + byStatus.picking) / online : 0,
      ordersInProgress: this.orders.filter((o) => o.status === 'in_progress').length,
      linesPerMin: this.lineStamps.length, series: this.series,
    }
  }
  ordersList(status?: OrderStatus): OrdersResponse {
    const counts = { queued: 0, in_progress: 0, completed: 0, short: 0, cancelled: 0 } as Record<OrderStatus, number>
    for (const o of this.orders) counts[o.status]++
    const items = this.orders.filter((o) => !status || o.status === status).slice(-200).reverse()
    return { items, counts }
  }
  orderDetail(id: string): OrderDetail {
    const o = this.orders.find((x) => x.id === id) ?? this.orders[0]
    return { ...o, tasks: this.tasks.filter((t) => t.orderId === o.id).map((t) => this.strip(t)) }
  }
  demoOrder(): Order { return this.createOrder() }
  eventsList(limit: number): WocEvent[] { return this.events.slice(-limit).reverse() }
  nextHandheld(): Task | null {
    const t = this.tasks.find((x) => x.handheld && x.status === 'active' && !x.confirmed) ?? this.tasks.find((x) => x.handheld && x.status !== 'done' && !x.confirmed)
    return t ? this.strip(t) : null
  }
  confirm(id: string) { const t = this.tasks.find((x) => x.id === id); if (t) t.confirmed = true }
  issue(id: string) { const t = this.tasks.find((x) => x.id === id); this.pushEvent(['warn', 'PICK_ISSUE'], { location: t?.locationLabel ?? '' }, t?.robotId ?? null, t?.orderId ?? null) }

  // ---- telemetry ----
  frame(): Float32Array {
    const out = new Float32Array(this.sims.length * STRIDE)
    this.sims.forEach((s, i) => {
      const o = i * STRIDE
      out[o] = s.r.x; out[o + 1] = s.r.y; out[o + 2] = s.r.heading; out[o + 3] = s.r.battery
      out[o + 4] = STATUS_CODES.indexOf(s.r.status)
    })
    return out
  }
}

let world: MockWorld | null = null
export const getWorld = () => (world ??= new MockWorld())
