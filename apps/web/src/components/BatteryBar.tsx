import { cn } from '@/lib/utils'

export function BatteryBar({ value }: { value: number }) {
  const color = value < 20 ? 'bg-err' : value < 50 ? 'bg-warn' : 'bg-ok'
  return (
    <div className="flex items-center gap-2" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-2 w-20 overflow-hidden rounded-full bg-panel2">
        <div className={cn('h-full', color)} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-muted tabular-nums">{value}%</span>
    </div>
  )
}
