import { describe, expect, it } from 'vitest'
import { decodeRobots, parseMessage } from './decode'
import { STRIDE } from './types'

describe('decodeRobots', () => {
  it('writes rows at idx * stride', () => {
    const buf = decodeRobots([[1, 10, 20, 0.5, 80, 1]], null)
    expect(buf.length).toBe(2 * STRIDE)
    expect(Array.from(buf.slice(STRIDE))).toEqual([10, 20, 0.5, 80, 1].map((v) => Math.fround(v)))
  })

  it('keeps untouched robots from the previous full state (diff frames)', () => {
    const first = decodeRobots([[0, 1, 2, 0, 90, 0], [1, 3, 4, 0, 70, 1]], null)
    const next = decodeRobots([[1, 5, 6, 0, 69, 1]], first)
    expect(next[0]).toBe(1)
    expect(next[STRIDE]).toBe(5)
    expect(first[STRIDE]).toBe(3) // base is not mutated
  })
})

describe('parseMessage', () => {
  it('accepts known types and rejects the rest', () => {
    expect(parseMessage('{"type":"counts","online":1,"total":2,"byStatus":{}}')?.type).toBe('counts')
    expect(parseMessage('{"type":"nope"}')).toBeNull()
  })
})
