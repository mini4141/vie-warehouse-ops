import { Check, Circle, Loader } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import type { Task } from '@/api/types'
import { useUiStore } from '@/app/uiStore'
import { cn } from '@/lib/utils'

const ICON = { pending: Circle, active: Loader, done: Check }
const COLOR = { pending: 'text-muted', active: 'text-accent', done: 'text-ok' }

export function TaskTimeline({ tasks }: { tasks: Task[] }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const selectRobot = useUiStore((s) => s.selectRobot)
  if (tasks.length === 0) return <p className="text-sm text-muted">{t('orders.noTasks')}</p>
  return (
    <ol className="space-y-4 border-l border-border pl-5" data-testid="task-timeline">
      {tasks.map((task) => {
        const Icon = ICON[task.status]
        return (
          <li key={task.id} className="relative" data-status={task.status}>
            <span className={cn('absolute -left-[31px] rounded-full bg-panel p-0.5', COLOR[task.status])}>
              <Icon className="size-4" />
            </span>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">{`${task.sku ?? task.type} × ${task.qty ?? 1}`}</span>
              <span className={cn('text-xs', COLOR[task.status])}>{t(`task.${task.status}`)}</span>
            </div>
            <div className="text-xs text-muted">{task.locationLabel}</div>
            {task.robotId && (
              <button
                className="mt-1 text-xs text-accent hover:underline"
                onClick={() => {
                  selectRobot(task.robotId)
                  navigate('/fleet/map')
                }}
              >
                {t('orders.showRobot', { robot: task.robotId })}
              </button>
            )}
          </li>
        )
      })}
    </ol>
  )
}
