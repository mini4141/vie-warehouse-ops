import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api } from '@/api/client'
import type { RobotStatus } from '@/api/types'
import { EventStream } from '@/components/EventStream'
import { KpiTile } from '@/components/KpiTile'
import { ScreenSkeleton } from '@/components/Skeleton'
import { formatNumber, formatPercent, formatTime } from '@/lib/format'
import { STATUS_CODES, STATUS_HEX } from '@/lib/status'
import { useEventFeed } from '@/lib/useEventFeed'
import { useTelemetryStore } from '@/telemetry/store'

export default function DashboardPage() {
  const { t } = useTranslation()
  // Polling (summary) and push (counts, events) side by side.
  const { data } = useQuery({ queryKey: ['summary'], queryFn: api.summary, refetchInterval: 5000 })
  const counts = useTelemetryStore((s) => s.counts)
  const { events } = useEventFeed(8)
  if (!data) return <ScreenSkeleton />

  const online = counts?.online ?? data.online
  const total = counts?.total ?? data.total
  const byStatus = counts?.byStatus ?? data.byStatus
  const donut = STATUS_CODES.map((s) => ({ status: s, value: byStatus[s] ?? 0 }))
  const util = data.series.map((p) => p.utilization)

  return (
    <div className="space-y-4 p-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiTile label={t('kpi.online')} value={`${formatNumber(online)} / ${formatNumber(total)}`} />
        <KpiTile label={t('kpi.utilization')} value={formatPercent(data.utilization)} spark={util} />
        <KpiTile label={t('kpi.ordersInProgress')} value={formatNumber(data.ordersInProgress)} />
        <KpiTile label={t('kpi.linesPerMin')} value={formatNumber(data.linesPerMin)} spark={data.series.map((p) => p.linesPerMin)} />
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <section className="rounded-lg border border-border bg-panel p-4 xl:col-span-2">
          <h2 className="mb-2 text-sm font-medium text-muted">{t('dashboard.throughput')}</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <LineChart data={data.series}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis dataKey="ts" tickFormatter={formatTime} stroke="var(--muted)" fontSize={11} minTickGap={40} />
                <YAxis stroke="var(--muted)" fontSize={11} width={32} />
                <Tooltip
                  labelFormatter={(v) => formatTime(String(v))}
                  contentStyle={{ background: 'var(--panel)', border: '1px solid var(--border)', color: 'var(--fg)' }}
                />
                <Line type="monotone" dataKey="linesPerMin" name={t('kpi.linesPerMin')} stroke="var(--accent)" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="rounded-lg border border-border bg-panel p-4">
          <h2 className="mb-2 text-sm font-medium text-muted">{t('dashboard.statusMix')}</h2>
          <div className="flex items-center gap-4">
            <div className="h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                <PieChart>
                  <Pie data={donut} dataKey="value" nameKey="status" innerRadius={48} outerRadius={80} stroke="none" isAnimationActive={false}>
                    {donut.map((d) => (
                      <Cell key={d.status} fill={STATUS_HEX[d.status as RobotStatus]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="min-w-0 flex-1 space-y-1 text-sm">
              {donut.map((d) => (
                <li key={d.status} className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ background: STATUS_HEX[d.status] }} />
                  <span className="min-w-0 flex-1 truncate">{t(`status.${d.status}`)}</span>
                  <span className="tabular-nums">{d.value}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
      <section className="rounded-lg border border-border bg-panel">
        <h2 className="border-b border-border p-3 text-sm font-medium text-muted">{t('dashboard.latestEvents')}</h2>
        <EventStream events={events} />
      </section>
    </div>
  )
}
