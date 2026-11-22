import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Pause, Play, X, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client'
import { useRobotIndex } from '@/api/hooks'
import type { RobotCommand, RobotDetail, RobotStatus } from '@/api/types'
import { useUiStore } from '@/app/uiStore'
import { formatNumber, formatRelative } from '@/lib/format'
import { useRobotBattery, useRobotStatus } from '@/telemetry/hooks'
import { BatteryBar } from './BatteryBar'
import { StatusBadge } from './StatusBadge'
import { Button } from './ui/button'

const PREDICTED: Record<RobotCommand, RobotStatus> = { pause: 'idle', resume: 'moving', recall: 'moving' }

export function RobotPanel() {
  const id = useUiStore((s) => s.selectedRobotId)
  if (!id) return null
  return <PanelBody key={id} id={id} />
}

function PanelBody({ id }: { id: string }) {
  const { t } = useTranslation()
  const qc = useQueryClient()
  const selectRobot = useUiStore((s) => s.selectRobot)
  const idx = useRobotIndex(id)
  const liveStatus = useRobotStatus(idx)
  const liveBattery = useRobotBattery(idx)
  const [optimistic, setOptimistic] = useState<RobotStatus | null>(null)
  const clearTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(clearTimer.current), [])

  const { data } = useQuery({ queryKey: ['robot', id], queryFn: () => api.robot(id), refetchInterval: 2000 })

  const mutation = useMutation({
    mutationFn: (command: RobotCommand) => api.command(id, command),
    onMutate: (command) => {
      // Show the expected state at once; the next telemetry frames reconcile it.
      setOptimistic(PREDICTED[command])
      qc.setQueryData<RobotDetail>(['robot', id], (old) => old && { ...old, status: PREDICTED[command] })
      clearTimeout(clearTimer.current)
      clearTimer.current = setTimeout(() => setOptimistic(null), 1500)
    },
    onError: () => setOptimistic(null),
    onSettled: () => void qc.invalidateQueries({ queryKey: ['robot', id] }),
  })

  const status = optimistic ?? (idx >= 0 ? liveStatus : (data?.status ?? 'offline'))
  const battery = idx >= 0 ? liveBattery : Math.round(data?.battery ?? 0)

  return (
    <aside
      aria-label={t('robot.panelTitle')}
      data-testid="robot-panel"
      className="absolute top-3 right-3 z-20 w-80 rounded-lg border border-border bg-panel p-4 shadow-xl"
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">{id}</h2>
        <Button variant="ghost" size="icon" aria-label={t('common.close')} onClick={() => selectRobot(null)}>
          <X className="size-4" />
        </Button>
      </div>
      <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2 text-sm">
        <dt className="text-muted">{t('robot.kind')}</dt>
        <dd>{data ? t(`kind.${data.kind}`) : '—'}</dd>
        <dt className="text-muted">{t('robot.status')}</dt>
        <dd data-testid="robot-status">
          <StatusBadge status={status} />
        </dd>
        <dt className="text-muted">{t('robot.battery')}</dt>
        <dd>
          <BatteryBar value={battery} />
        </dd>
        <dt className="text-muted">{t('robot.speed')}</dt>
        <dd className="tabular-nums">{t('robot.speedValue', { value: formatNumber(data?.speed ?? 0, 1) })}</dd>
        <dt className="text-muted">{t('robot.task')}</dt>
        <dd className="min-w-0 truncate">
          {data?.task ? `${data.task.id} · ${data.task.locationLabel ?? ''}` : t('robot.noTask')}
        </dd>
        <dt className="text-muted">{t('robot.lastSeen')}</dt>
        <dd>{data ? formatRelative(data.lastSeen) : '—'}</dd>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => mutation.mutate('pause')}>
          <Pause className="size-3" />
          {t('robot.pause')}
        </Button>
        <Button variant="outline" size="sm" onClick={() => mutation.mutate('resume')}>
          <Play className="size-3" />
          {t('robot.resume')}
        </Button>
        <Button size="sm" onClick={() => mutation.mutate('recall')}>
          <Zap className="size-3" />
          {t('robot.recall')}
        </Button>
      </div>
    </aside>
  )
}
