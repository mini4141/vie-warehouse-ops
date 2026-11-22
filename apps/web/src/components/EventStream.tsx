import { useVirtualizer } from '@tanstack/react-virtual'
import { AlertTriangle, Info, OctagonAlert } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { Severity, WocEvent } from '@/api/types'
import { useUiStore } from '@/app/uiStore'
import { eventText } from '@/lib/eventText'
import { formatRelative } from '@/lib/format'
import { useNow } from '@/lib/useNow'
import { cn } from '@/lib/utils'

const ICON = { info: Info, warn: AlertTriangle, error: OctagonAlert }
const COLOR: Record<Severity, string> = { info: 'text-accent', warn: 'text-warn', error: 'text-err' }
const ROW_H = 40

interface Props {
  events: WocEvent[]
  /** Virtualize when the list can be long (Events page); the dashboard list is tiny. */
  virtual?: boolean
}

export function EventStream({ events, virtual }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const selectRobot = useUiStore((s) => s.selectRobot)
  const now = useNow()
  const parentRef = useRef<HTMLDivElement>(null)
  const virt = useVirtualizer({ count: events.length, getScrollElement: () => parentRef.current, estimateSize: () => ROW_H, overscan: 8 })

  if (events.length === 0) return <p className="p-4 text-sm text-muted">{t('events.empty')}</p>

  const row = (e: WocEvent, style?: React.CSSProperties) => {
    const Icon = ICON[e.severity]
    const open = () => {
      if (!e.robotId) return
      selectRobot(e.robotId)
      navigate('/fleet/map')
    }
    return (
      <div
        key={e.id}
        style={style}
        role={e.robotId ? 'button' : undefined}
        tabIndex={e.robotId ? 0 : undefined}
        onClick={open}
        onKeyDown={(k) => k.key === 'Enter' && open()}
        className={cn('flex items-center gap-3 border-b border-border px-3 text-sm', e.robotId && 'cursor-pointer hover:bg-panel2')}
        data-severity={e.severity}
      >
        <Icon className={cn('size-4 shrink-0', COLOR[e.severity])} aria-label={t(`severity.${e.severity}`)} />
        <span className="min-w-0 flex-1 truncate">{eventText(t, e)}</span>
        <span className="shrink-0 text-xs text-muted tabular-nums">{formatRelative(e.ts, now)}</span>
      </div>
    )
  }

  if (!virtual) return <div data-testid="event-list">{events.map((e) => row(e, { height: ROW_H }))}</div>

  return (
    <div ref={parentRef} className="h-full overflow-y-auto" data-testid="event-list">
      <div style={{ height: virt.getTotalSize(), position: 'relative' }}>
        {virt.getVirtualItems().map((v) =>
          row(events[v.index], { position: 'absolute', top: 0, left: 0, right: 0, height: ROW_H, transform: `translateY(${v.start}px)` }),
        )}
      </div>
    </div>
  )
}
