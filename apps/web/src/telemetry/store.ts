import { create } from 'zustand'
import type { WocEvent } from '@/api/types'
import { STRIDE, type ConnectionState, type Counts } from './types'

const EVENT_CAP = 300

/**
 * Low-rate fields (connection, counts, events) are normal reactive state.
 * The typed arrays and timestamps below are mutated in place by `applyFrame`; they are read by the
 * Babylon render loop via getState() and by throttled/per-row selectors, never by wire-rate renders.
 */
export interface TelemetryState {
  connection: ConnectionState
  counts: Counts | null
  events: WocEvent[]
  latencyMs: number
  prev: Float32Array
  curr: Float32Array
  prevAt: number
  currAt: number
  count: number
  setConnection: (c: ConnectionState) => void
  setCounts: (c: Counts) => void
  pushEvent: (e: WocEvent) => void
  applyFrame: (buf: Float32Array, serverT: number) => void
}

export const useTelemetryStore = create<TelemetryState>()((set, get) => ({
  connection: 'connecting',
  counts: null,
  events: [],
  latencyMs: 0,
  prev: new Float32Array(0),
  curr: new Float32Array(0),
  prevAt: 0,
  currAt: 0,
  count: 0,
  setConnection: (connection) => set({ connection }),
  setCounts: (counts) => set({ counts }),
  pushEvent: (e) => set((s) => ({ events: [e, ...s.events].slice(0, EVENT_CAP) })),
  applyFrame: (buf, serverT) => {
    const s = get()
    const now = performance.now()
    // Intentional in-place mutation: no set() so nothing re-renders at wire rate.
    s.prev = s.curr.length === buf.length ? s.curr : buf
    s.prevAt = s.curr.length === buf.length ? s.currAt : now - 200
    s.curr = buf
    s.currAt = now
    s.count = buf.length / STRIDE
    const lat = Math.max(0, Date.now() - serverT)
    s.latencyMs = s.latencyMs === 0 ? lat : s.latencyMs * 0.8 + lat * 0.2
  },
}))

export const robotX = (s: TelemetryState, i: number) => s.curr[i * STRIDE] ?? 0
export const robotY = (s: TelemetryState, i: number) => s.curr[i * STRIDE + 1] ?? 0
export const robotBattery = (s: TelemetryState, i: number) => Math.round(s.curr[i * STRIDE + 3] ?? 0)
export const robotStatusCode = (s: TelemetryState, i: number) => s.curr[i * STRIDE + 4] ?? 5
