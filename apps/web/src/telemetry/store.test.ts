import { beforeEach, describe, expect, it } from 'vitest'
import { useTelemetryStore } from './store'

describe('telemetryStore', () => {
  beforeEach(() => useTelemetryStore.setState({ events: [], count: 0, latencyMs: 0 }))

  it('applyFrame rotates prev/curr in place without notifying subscribers', () => {
    let notified = 0
    const unsub = useTelemetryStore.subscribe(() => notified++)
    const a = new Float32Array([1, 2, 0, 50, 1])
    const b = new Float32Array([2, 3, 0, 49, 1])
    useTelemetryStore.getState().applyFrame(a, Date.now())
    useTelemetryStore.getState().applyFrame(b, Date.now())
    const s = useTelemetryStore.getState()
    expect(s.curr).toBe(b)
    expect(s.prev).toBe(a)
    expect(s.count).toBe(1)
    expect(notified).toBe(0)
    unsub()
  })

  it('caps the event list', () => {
    for (let i = 0; i < 350; i++) {
      useTelemetryStore.getState().pushEvent({ id: i, ts: '', severity: 'info', code: 'X', robotId: null, orderId: null, params: {} })
    }
    expect(useTelemetryStore.getState().events).toHaveLength(300)
    expect(useTelemetryStore.getState().events[0].id).toBe(349)
  })
})
