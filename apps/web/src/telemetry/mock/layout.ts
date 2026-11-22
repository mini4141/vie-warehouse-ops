import type { Layout, Point } from '@/api/types'

// Mirrors apps/api/app/sim/layout.py: keep the two in sync (the API is the source of truth).
export const AISLE_YS = [7.5, 12.5, 17.5, 22.5, 27.5, 32.5, 37.5]
export const CROSS_XS = [2, 16.25, 29.75, 43.25, 58]
const BLOCK_W = 11
const BLOCK_GAP = 2.5
const BLOCK_X0 = 4

export function buildLayout(): Layout {
  const racks: Layout['racks'] = []
  for (let pair = 0; pair < 6; pair++) {
    const y0 = 9 + 5 * pair
    for (const dy of [0.5, 1.5]) {
      for (let b = 0; b < 4; b++) {
        racks.push({ x: BLOCK_X0 + b * (BLOCK_W + BLOCK_GAP) + BLOCK_W / 2, y: y0 + dy, w: BLOCK_W, d: 1, h: 3 })
      }
    }
  }
  return {
    width: 60,
    height: 40,
    racks,
    stations: [
      { id: 'S-P1', x: 10, y: 3.5, kind: 'pick' },
      { id: 'S-P2', x: 22, y: 3.5, kind: 'pick' },
      { id: 'S-K1', x: 38, y: 3.5, kind: 'pack' },
      { id: 'S-K2', x: 50, y: 3.5, kind: 'pack' },
    ],
    chargers: Array.from({ length: 6 }, (_, i) => ({ id: `C-${i + 1}`, x: 8 + 9 * i, y: 1, })),
  }
}

/** Pick slots sit on an aisle line in front of a rack block. */
export function locationLabel(aisle: number, x: number) {
  const bay = Math.min(12, Math.max(1, Math.ceil((x / 60) * 12)))
  return `${String.fromCharCode(65 + aisle)}-${String(bay).padStart(2, '0')}-${1 + (Math.floor(x * 3) % 4)}`
}

/** Manhattan route along aisles: to the nearest aisle line, along it to a cross aisle, then to the goal. */
export function route(a: Point, b: Point): Point[] {
  const toAisle = (p: Point): Point => {
    // Open floor (stations/chargers) or mid cross-aisle: snap to the nearest aisle line first.
    const y = p.y > 6.5 ? AISLE_YS.reduce((best, c) => (Math.abs(p.y - c) < Math.abs(p.y - best) ? c : best)) : AISLE_YS[0]
    return Math.abs(y - p.y) < 0.01 ? p : { x: p.x, y }
  }
  const a1 = toAisle(a)
  const b1 = toAisle(b)
  const pts: Point[] = []
  if (a1 !== a) pts.push(a1)
  if (Math.abs(a1.y - b1.y) < 0.01) {
    pts.push({ x: b1.x, y: b1.y })
  } else {
    const xc = CROSS_XS.reduce((best, c) => (Math.abs(a1.x - c) + Math.abs(b1.x - c) < Math.abs(a1.x - best) + Math.abs(b1.x - best) ? c : best))
    pts.push({ x: xc, y: a1.y }, { x: xc, y: b1.y }, { x: b1.x, y: b1.y })
  }
  if (b1 !== b) pts.push(b)
  return pts
}
