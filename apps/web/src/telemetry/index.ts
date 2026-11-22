import { perf } from '@/lib/perf'
import { MockSource } from './MockSource'
import { useTelemetryStore } from './store'
import type { TelemetrySource } from './types'
import { WsSource } from './WsSource'

export const DATA_SOURCE: 'mock' | 'live' = import.meta.env.VITE_DATA_SOURCE === 'mock' ? 'mock' : 'live'

let source: TelemetrySource | null = null

/** Wires a source to the store. Idempotent so React StrictMode double-mounts are harmless. */
export function startTelemetry() {
  if (source) return
  const store = useTelemetryStore.getState()
  source = DATA_SOURCE === 'mock' ? new MockSource() : new WsSource()
  source.onFrame = (buf, t) => store.applyFrame(buf, t)
  source.onEvent = (e) => store.pushEvent(e)
  source.onCounts = (c) => store.setCounts(c)
  source.onState = (s) => store.setConnection(s)
  source.onStats = (n) => { perf.wsMsgs = n }
  source.connect()
}

export function stopTelemetry() {
  source?.disconnect()
  source = null
}
