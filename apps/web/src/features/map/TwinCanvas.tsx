import { useEffect, useRef } from 'react'
import type { Layout } from '@/api/types'
import { createTwin } from './twinScene'

/** Owns the canvas + engine lifecycle only; everything per-frame lives in twinScene. */
export function TwinCanvas({ layout, robotIds }: { layout: Layout; robotIds: string[] }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const twin = createTwin(ref.current!, layout, robotIds)
    return () => twin.dispose()
  }, [layout, robotIds])
  return <canvas ref={ref} data-testid="twin-canvas" className="block h-full w-full touch-none outline-none" />
}
