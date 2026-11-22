import type { RobotStatus } from '@/api/types'

export const STATUS_CODES: readonly RobotStatus[] = ['idle', 'moving', 'picking', 'charging', 'fault', 'offline']

// Hex for Babylon (and charts); the render loop never touches CSS.
export const STATUS_HEX: Record<RobotStatus, string> = {
  idle: '#94a3b8',
  moving: '#38bdf8',
  picking: '#a78bfa',
  charging: '#fbbf24',
  fault: '#f87171',
  offline: '#4b5563',
}

export const STATUS_BADGE_CLASS: Record<RobotStatus, string> = {
  idle: 'bg-slate-500/20 text-slate-300',
  moving: 'bg-sky-500/20 text-sky-300',
  picking: 'bg-violet-500/20 text-violet-300',
  charging: 'bg-amber-500/20 text-amber-300',
  fault: 'bg-red-500/25 text-red-300',
  offline: 'bg-gray-500/20 text-gray-400',
}
