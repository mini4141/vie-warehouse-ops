import { Pause, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { Severity, WocEvent } from '@/api/types'
import { EventStream } from '@/components/EventStream'
import { ScreenSkeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { useEventFeed } from '@/lib/useEventFeed'
import { cn } from '@/lib/utils'

const SEVERITIES: (Severity | 'all')[] = ['all', 'info', 'warn', 'error']

export default function EventsPage() {
  const { t } = useTranslation()
  const { events, isLoading } = useEventFeed(200)
  const [severity, setSeverity] = useState<Severity | 'all'>('all')
  const [frozen, setFrozen] = useState<WocEvent[] | null>(null)
  const source = frozen ?? events
  const shown = useMemo(() => source.filter((e) => severity === 'all' || e.severity === severity), [source, severity])

  if (isLoading) return <ScreenSkeleton />
  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-3 flex items-center gap-3">
        <div role="group" aria-label={t('events.filter')} className="flex overflow-hidden rounded-md border border-border">
          {SEVERITIES.map((s) => (
            <button
              key={s}
              aria-pressed={severity === s}
              onClick={() => setSeverity(s)}
              className={cn('px-3 py-1.5 text-sm', severity === s ? 'bg-accent text-accent-fg' : 'hover:bg-panel2')}
            >
              {s === 'all' ? t('common.all') : t(`severity.${s}`)}
            </button>
          ))}
        </div>
        <Button variant="outline" onClick={() => setFrozen(frozen ? null : events)}>
          {frozen ? <Play className="size-4" /> : <Pause className="size-4" />}
          {frozen ? t('events.resume') : t('events.pause')}
        </Button>
      </div>
      <div className="min-h-0 flex-1 rounded-lg border border-border bg-panel">
        <EventStream events={shown} virtual />
      </div>
    </div>
  )
}
