import type { RobotStatus } from '@/api/types'
import { getWorld } from './mock/world'
import type { Counts, TelemetrySource } from './types'

/** Same interface as WsSource, but frames come from the in-browser simulator. */
export class MockSource implements TelemetrySource {
  onFrame: TelemetrySource['onFrame'] = () => {}
  onEvent: TelemetrySource['onEvent'] = () => {}
  onCounts: TelemetrySource['onCounts'] = () => {}
  onState: TelemetrySource['onState'] = () => {}
  onStats: TelemetrySource['onStats'] = () => {}
  private timer: ReturnType<typeof setInterval> | undefined
  private off: (() => void) | undefined

  connect() {
    const world = getWorld()
    this.onState('mock')
    this.off = world.onEvent((e) => this.onEvent(e))
    let n = 0
    this.timer = setInterval(() => {
      world.tick()
      this.onFrame(world.frame(), Date.now())
      if (++n % 10 === 0) {
        const s = world.summary()
        const counts: Counts = { online: s.online, total: s.total, byStatus: s.byStatus as Record<RobotStatus, number> }
        this.onCounts(counts)
        this.onStats(5)
      }
    }, 200)
  }

  disconnect() {
    clearInterval(this.timer)
    this.off?.()
  }
}
