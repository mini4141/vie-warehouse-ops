import * as Tabs from '@radix-ui/react-tabs'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client'
import type { OrderStatus, Priority } from '@/api/types'
import { ScreenSkeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { OrderDrawer } from './OrderDrawer'

const TABS: (OrderStatus | 'all')[] = ['all', 'in_progress', 'queued', 'completed', 'short', 'cancelled']
const PRIORITY_CLASS: Record<Priority, string> = {
  low: 'bg-slate-500/20 text-slate-300',
  normal: 'bg-sky-500/20 text-sky-300',
  high: 'bg-red-500/25 text-red-300',
}
const GRID = 'grid grid-cols-[90px_minmax(120px,1fr)_90px_minmax(140px,1.2fr)_150px_110px] items-center gap-3 px-4'

export default function OrdersPage() {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const [tab, setTab] = useState<OrderStatus | 'all'>('all')
  const [open, setOpen] = useState<string | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  // Refetch every 5 s: orders are a long-running workflow, not a push stream.
  const { data } = useQuery({
    queryKey: ['orders', tab],
    queryFn: () => api.orders(tab === 'all' ? undefined : tab),
    refetchInterval: 5000,
    placeholderData: (prev) => prev,
  })
  const demo = useMutation({ mutationFn: api.demoOrder, onSuccess: () => void qc.invalidateQueries({ queryKey: ['orders'] }) })
  const items = data?.items ?? []
  const virt = useVirtualizer({ count: items.length, getScrollElement: () => scrollRef.current, estimateSize: () => 44, overscan: 10 })

  if (!data) return <ScreenSkeleton />
  const total = Object.values(data.counts).reduce((a, b) => a + b, 0)

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <Tabs.Root value={tab} onValueChange={(v) => setTab(v as OrderStatus | 'all')}>
          <Tabs.List className="flex flex-wrap gap-1" aria-label={t('nav.orders')}>
            {TABS.map((s) => (
              <Tabs.Trigger
                key={s}
                value={s}
                className={cn('rounded-md px-3 py-1.5 text-sm hover:bg-panel2 data-[state=active]:bg-accent data-[state=active]:text-accent-fg')}
              >
                {s === 'all' ? t('common.all') : t(`orderStatus.${s}`)}
                <span className="ml-2 text-xs opacity-70 tabular-nums">{s === 'all' ? total : data.counts[s]}</span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>
        <Button onClick={() => demo.mutate()} disabled={demo.isPending}>
          <Plus className="size-4" />
          {t('orders.demo')}
        </Button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-panel">
        <div className={cn(GRID, 'h-10 border-b border-border text-xs text-muted uppercase')}>
          {(['id', 'customer', 'priority', 'progress', 'due', 'status'] as const).map((c) => (
            <span key={c} className="truncate">
              {t(`orders.col.${c}`)}
            </span>
          ))}
        </div>
        {items.length === 0 ? (
          <p className="p-4 text-sm text-muted">{t('orders.empty')}</p>
        ) : (
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
            <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
              {virt.getVirtualItems().map((v) => {
                const o = items[v.index]
                return (
                  <div
                    key={o.id}
                    role="row"
                    data-testid="order-row"
                    tabIndex={0}
                    onClick={() => setOpen(o.id)}
                    onKeyDown={(e) => e.key === 'Enter' && setOpen(o.id)}
                    className={cn(GRID, 'absolute top-0 left-0 w-full cursor-pointer border-b border-border text-sm hover:bg-panel2')}
                    style={{ height: v.size, transform: `translateY(${v.start}px)` }}
                  >
                    <span className="font-medium">{o.id}</span>
                    <span className="min-w-0 truncate">{o.customer}</span>
                    <span className={cn('w-fit rounded px-2 py-0.5 text-xs', PRIORITY_CLASS[o.priority])}>{t(`priority.${o.priority}`)}</span>
                    <div className="flex items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-panel2">
                        <div className="h-full bg-accent" style={{ width: `${(o.linesDone / o.lineCount) * 100}%` }} />
                      </div>
                      <span className="text-xs text-muted tabular-nums">{`${o.linesDone}/${o.lineCount}`}</span>
                    </div>
                    <span className="truncate text-muted">{formatDateTime(o.dueAt)}</span>
                    <span className="truncate">{t(`orderStatus.${o.status}`)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
      <OrderDrawer orderId={open} onClose={() => setOpen(null)} />
    </div>
  )
}
