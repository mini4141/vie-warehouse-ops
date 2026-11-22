import { memo } from 'react'
import { BatteryBar } from '@/components/BatteryBar'
import { StatusBadge } from '@/components/StatusBadge'
import { useRobotBattery, useRobotPosition, useRobotStatus } from '@/telemetry/hooks'

// Each cell subscribes to its own robot only; the table above never re-renders at telemetry rate.
export const LiveStatus = memo(function LiveStatus({ idx }: { idx: number }) {
  return <StatusBadge status={useRobotStatus(idx)} />
})

export const LiveBattery = memo(function LiveBattery({ idx }: { idx: number }) {
  return <BatteryBar value={useRobotBattery(idx)} />
})

export const LivePosition = memo(function LivePosition({ idx }: { idx: number }) {
  return <span className="tabular-nums text-muted">{useRobotPosition(idx)}</span>
})
