import { useSyncExternalStore } from 'react'
import { useTelemetryStore, robotBattery, robotStatusCode, robotX, robotY, type TelemetryState } from './store'
import { STATUS_CODES } from '@/lib/status'
import type { RobotStatus } from '@/api/types'

const THROTTLE_MS = 500 // 2 Hz ceiling for anything React renders from telemetry
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | undefined

function subscribe(cb: () => void) {
  listeners.add(cb)
  timer ??= setInterval(() => listeners.forEach((l) => l()), THROTTLE_MS)
  return () => {
    listeners.delete(cb)
    if (listeners.size === 0 && timer) {
      clearInterval(timer)
      timer = undefined
    }
  }
}

/** Reads a primitive from the mutable telemetry arrays at ≤2 Hz; re-renders only when the value changes. */
export function useTelemetryValue<T extends number | string | boolean>(selector: (s: TelemetryState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(useTelemetryStore.getState()))
}

/** Per-row live cells: each subscribes to its own robot's values, so the table never re-renders. */
export const useRobotStatus = (idx: number): RobotStatus =>
  STATUS_CODES[useTelemetryValue((s) => robotStatusCode(s, idx))] ?? 'offline'
export const useRobotBattery = (idx: number) => useTelemetryValue((s) => robotBattery(s, idx))
export const useRobotPosition = (idx: number) =>
  useTelemetryValue((s) => `${robotX(s, idx).toFixed(1)}, ${robotY(s, idx).toFixed(1)}`)
