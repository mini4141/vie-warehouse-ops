import type { TelemetrySource, WorkerIn, WorkerOut } from './types'

export class WsSource implements TelemetrySource {
  onFrame: TelemetrySource['onFrame'] = () => {}
  onEvent: TelemetrySource['onEvent'] = () => {}
  onCounts: TelemetrySource['onCounts'] = () => {}
  onState: TelemetrySource['onState'] = () => {}
  onStats: TelemetrySource['onStats'] = () => {}
  private worker: Worker | null = null

  connect() {
    const worker = new Worker(new URL('./telemetry.worker.ts', import.meta.url), { type: 'module' })
    this.worker = worker
    worker.onmessage = (e: MessageEvent<WorkerOut>) => {
      const m = e.data
      if (m.type === 'frame') this.onFrame(m.buf, m.t)
      else if (m.type === 'event') this.onEvent(m.event)
      else if (m.type === 'counts') this.onCounts(m.counts)
      else if (m.type === 'state') this.onState(m.state)
      else this.onStats(m.msgsPerSec)
    }
    const proto = location.protocol === 'https:' ? 'wss' : 'ws'
    const msg: WorkerIn = { type: 'connect', url: `${proto}://${location.host}/ws/telemetry` }
    worker.postMessage(msg)
  }

  disconnect() {
    this.worker?.postMessage({ type: 'disconnect' } satisfies WorkerIn)
    this.worker?.terminate()
    this.worker = null
  }
}
