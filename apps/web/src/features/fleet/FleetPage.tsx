import { useQuery } from '@tanstack/react-query'
import { createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, useReactTable, type SortingState } from '@tanstack/react-table'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client'
import type { Robot, RobotStatus } from '@/api/types'
import { useUiStore } from '@/app/uiStore'
import { ScreenSkeleton } from '@/components/Skeleton'
import { formatRelative } from '@/lib/format'
import { STATUS_CODES } from '@/lib/status'
import { cn } from '@/lib/utils'
import { LiveBattery, LivePosition, LiveStatus } from './LiveCells'

interface Row extends Robot {
  idx: number
}
const col = createColumnHelper<Row>()
const GRID = 'grid grid-cols-[80px_90px_110px_170px_90px_130px_minmax(100px,1fr)] items-center gap-3 px-4'

// `?rows=1000` pads the list with synthetic rows to exercise virtualization.
const extraRows = () => Number(new URLSearchParams(location.search).get('rows') ?? 0)

export default function FleetPage() {
  const { t } = useTranslation()
  const selectRobot = useUiStore((s) => s.selectRobot)
  const density = useUiStore((s) => s.density)
  const { data } = useQuery({ queryKey: ['robots', 'table'], queryFn: api.robots, refetchInterval: 5000 })
  const [sorting, setSorting] = useState<SortingState>([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<RobotStatus | ''>('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const rows = useMemo<Row[]>(() => {
    if (!data) return []
    const padded = [...data]
    for (let i = data.length; i < extraRows(); i++) padded.push({ ...data[i % data.length], id: `R-${String(i + 1).padStart(4, '0')}` })
    return padded
      .map((r, idx) => ({ ...r, idx }))
      .filter((r) => (!status || r.status === status) && (!search || r.id.toLowerCase().includes(search.toLowerCase())))
  }, [data, search, status])

  const columns = useMemo(
    () => [
      col.accessor('id', { header: t('fleet.col.id'), cell: (c) => <span className="font-medium">{c.getValue()}</span> }),
      col.accessor('kind', { header: t('fleet.col.kind'), cell: (c) => t(`kind.${c.getValue()}`) }),
      col.accessor('status', { header: t('fleet.col.status'), cell: (c) => <LiveStatus idx={c.row.original.idx} /> }),
      col.accessor('battery', { header: t('fleet.col.battery'), cell: (c) => <LiveBattery idx={c.row.original.idx} /> }),
      col.accessor((r) => r.taskId ?? '', { id: 'task', header: t('fleet.col.task'), cell: (c) => c.getValue() || '—' }),
      col.display({ id: 'position', header: t('fleet.col.position'), cell: (c) => <LivePosition idx={c.row.original.idx} /> }),
      col.accessor('lastSeen', { header: t('fleet.col.lastSeen'), cell: (c) => formatRelative(c.getValue()) }),
    ],
    [t],
  )

  const table = useReactTable({ data: rows, columns, state: { sorting }, onSortingChange: setSorting, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() })
  const tableRows = table.getRowModel().rows
  const rowH = density === 'compact' ? 28 : 40
  const virt = useVirtualizer({ count: tableRows.length, getScrollElement: () => scrollRef.current, estimateSize: () => rowH, overscan: 10 })

  if (!data) return <ScreenSkeleton />
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('fleet.search')}
          aria-label={t('fleet.search')}
          className="h-9 w-64 rounded-md border border-border bg-panel px-3 text-sm"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as RobotStatus | '')}
          aria-label={t('fleet.col.status')}
          className="h-9 rounded-md border border-border bg-panel px-2 text-sm"
        >
          <option value="">{t('common.all')}</option>
          {STATUS_CODES.map((s) => (
            <option key={s} value={s}>
              {t(`status.${s}`)}
            </option>
          ))}
        </select>
        <span className="text-sm text-muted" data-testid="row-count">
          {t('fleet.rows', { count: tableRows.length })}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-panel">
        {table.getHeaderGroups().map((hg) => (
          <div key={hg.id} className={cn(GRID, 'h-10 border-b border-border text-xs text-muted')} role="row">
            {hg.headers.map((h) => {
              const dir = h.column.getIsSorted()
              return (
                <button key={h.id} onClick={h.column.getToggleSortingHandler()} className="flex min-w-0 items-center gap-1 text-left uppercase">
                  <span className="truncate">{flexRender(h.column.columnDef.header, h.getContext())}</span>
                  {dir === 'asc' && <ArrowUp className="size-3" />}
                  {dir === 'desc' && <ArrowDown className="size-3" />}
                </button>
              )
            })}
          </div>
        ))}
        {tableRows.length === 0 ? (
          <p className="p-4 text-sm text-muted">{t('fleet.empty')}</p>
        ) : (
          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" data-testid="fleet-scroll">
            <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
              {virt.getVirtualItems().map((v) => {
                const row = tableRows[v.index]
                return (
                  <div
                    key={row.id}
                    role="row"
                    data-testid="fleet-row"
                    onClick={() => selectRobot(row.original.id)}
                    className={cn(GRID, 'absolute top-0 left-0 w-full cursor-pointer border-b border-border text-sm hover:bg-panel2')}
                    style={{ height: v.size, transform: `translateY(${v.start}px)` }}
                  >
                    {row.getVisibleCells().map((c) => (
                      <div key={c.id} className="min-w-0 truncate">
                        {flexRender(c.column.columnDef.cell, c.getContext())}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
