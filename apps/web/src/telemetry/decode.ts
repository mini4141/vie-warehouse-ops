import type { WocEvent } from '@/api/types'
import { STRIDE, type Counts } from './types'

type RobotRow = [idx: number, x: number, y: number, heading: number, battery: number, status: number]

export type WireMessage =
  | { type: 'robots'; t: number; r: RobotRow[] }
  | { type: 'event'; event: WocEvent }
  | ({ type: 'counts' } & Counts)

/**
 * Applies a (possibly partial) robots frame on top of the previous full state and returns a fresh
 * buffer. Rows carry the robot index, so frames never contain strings.
 */
export function decodeRobots(rows: RobotRow[], base: Float32Array | null): Float32Array {
  let needed = base ? base.length / STRIDE : 0
  for (const row of rows) if (row[0] + 1 > needed) needed = row[0] + 1
  const out = new Float32Array(needed * STRIDE)
  if (base) out.set(base)
  for (const [idx, x, y, heading, battery, status] of rows) {
    const o = idx * STRIDE
    out[o] = x
    out[o + 1] = y
    out[o + 2] = heading
    out[o + 3] = battery
    out[o + 4] = status
  }
  return out
}

export function parseMessage(text: string): WireMessage | null {
  const msg = JSON.parse(text) as { type?: string }
  return msg.type === 'robots' || msg.type === 'event' || msg.type === 'counts' ? (msg as WireMessage) : null
}
