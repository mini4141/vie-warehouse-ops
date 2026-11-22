import type { RobotStatus, WocEvent } from '@/api/types'

/** Floats per robot in the shared frame buffer: x, y, heading, battery, status. */
export const STRIDE = 5

export type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'mock'

export interface Counts {
  online: number
  total: number
  byStatus: Record<RobotStatus, number>
}

/** Implemented by WsSource (worker) and MockSource (client-side generator). */
export interface TelemetrySource {
  onFrame: (buf: Float32Array, serverT: number) => void
  onEvent: (e: WocEvent) => void
  onCounts: (c: Counts) => void
  onState: (s: ConnectionState) => void
  onStats: (msgsPerSec: number) => void
  connect: () => void
  disconnect: () => void
}

// Messages worker -> main
export type WorkerOut =
  | { type: 'frame'; t: number; buf: Float32Array }
  | { type: 'event'; event: WocEvent }
  | { type: 'counts'; counts: Counts }
  | { type: 'state'; state: ConnectionState }
  | { type: 'stats'; msgsPerSec: number }

// Messages main -> worker
export type WorkerIn = { type: 'connect'; url: string } | { type: 'disconnect' }
