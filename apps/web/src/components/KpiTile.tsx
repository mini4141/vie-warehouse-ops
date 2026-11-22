import type { ReactNode } from 'react'
import { Line, LineChart, ResponsiveContainer } from 'recharts'

interface Props {
  label: string
  value: ReactNode
  sub?: ReactNode
  spark?: number[]
}

export function KpiTile({ label, value, sub, spark }: Props) {
  return (
    <div className="flex flex-col rounded-lg border border-border bg-panel p-4">
      <span className="text-sm text-muted">{label}</span>
      <span className="mt-1 text-3xl font-semibold tabular-nums">{value}</span>
      <div className="mt-1 flex h-8 items-end justify-between gap-2 text-xs text-muted">
        <span>{sub}</span>
        {spark && (
          <div className="h-8 w-24">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={spark.map((v) => ({ v }))}>
                <Line type="monotone" dataKey="v" stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
