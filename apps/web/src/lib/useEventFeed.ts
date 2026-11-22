import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from '@/api/client'
import type { WocEvent } from '@/api/types'
import { useTelemetryStore } from '@/telemetry/store'

/** REST history (initial load) merged with events pushed over the telemetry socket, newest first. */
export function useEventFeed(limit = 200): { events: WocEvent[]; isLoading: boolean } {
  const { data, isLoading } = useQuery({ queryKey: ['events'], queryFn: () => api.events(200), staleTime: Infinity })
  const live = useTelemetryStore((s) => s.events)
  const events = useMemo(() => {
    const seen = new Set<number>()
    const merged: WocEvent[] = []
    for (const e of [...live, ...(data ?? [])]) {
      if (seen.has(e.id)) continue
      seen.add(e.id)
      merged.push(e)
    }
    return merged.sort((a, b) => b.id - a.id).slice(0, limit)
  }, [live, data, limit])
  return { events, isLoading }
}
