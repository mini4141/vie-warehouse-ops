import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client'
import { useRobots } from '@/api/hooks'
import { useUiStore, type CameraMode } from '@/app/uiStore'
import { ScreenSkeleton } from '@/components/Skeleton'
import { Button } from '@/components/ui/button'
import { STATUS_CODES, STATUS_HEX } from '@/lib/status'
import { cn } from '@/lib/utils'
import { PerfHud } from './PerfHud'
import { TwinCanvas } from './TwinCanvas'

const MODES: CameraMode[] = ['top', 'iso', 'follow']

export default function FleetMapPage() {
  const { t } = useTranslation()
  const layout = useQuery({ queryKey: ['layout'], queryFn: api.layout, staleTime: Infinity })
  const robots = useRobots()
  const mode = useUiStore((s) => s.cameraMode)
  const setMode = useUiStore((s) => s.setCameraMode)
  const hidden = useUiStore((s) => s.hiddenStatuses)
  const toggle = useUiStore((s) => s.toggleStatus)
  const robotIds = useMemo(() => robots.data?.map((r) => r.id) ?? [], [robots.data])

  if (!layout.data || !robots.data) return <ScreenSkeleton />
  return (
    <div className="relative h-full min-h-[480px]">
      <TwinCanvas layout={layout.data} robotIds={robotIds} />
      <div className="absolute top-3 left-3 flex flex-col gap-2">
        <div role="group" aria-label={t('map.camera')} className="flex overflow-hidden rounded-md border border-border bg-panel/90">
          {MODES.map((m) => (
            <button
              key={m}
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={cn('px-3 py-1.5 text-xs', mode === m ? 'bg-accent text-accent-fg' : 'hover:bg-panel2')}
            >
              {t(`map.${m}`)}
            </button>
          ))}
        </div>
        <div className="flex max-w-sm flex-wrap gap-1" role="group" aria-label={t('map.filter')}>
          {STATUS_CODES.map((s) => (
            <Button key={s} variant="outline" size="sm" aria-pressed={!hidden.includes(s)} onClick={() => toggle(s)} className={cn('bg-panel/90', hidden.includes(s) && 'opacity-40')}>
              <span className="size-2 rounded-full" style={{ background: STATUS_HEX[s] }} />
              {t(`status.${s}`)}
            </Button>
          ))}
        </div>
      </div>
      <PerfHud />
    </div>
  )
}
