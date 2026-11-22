import { useQuery } from '@tanstack/react-query'
import { api } from './client'

/** Stable robot list; its order is the telemetry `idx`. */
export function useRobots() {
  return useQuery({ queryKey: ['robots'], queryFn: api.robots, staleTime: Infinity })
}

export function useRobotIndex(id: string | null): number {
  const { data } = useRobots()
  return id && data ? data.findIndex((r) => r.id === id) : -1
}
