import { useTranslation } from 'react-i18next'
import type { RobotStatus } from '@/api/types'
import { STATUS_BADGE_CLASS } from '@/lib/status'
import { cn } from '@/lib/utils'

export function StatusBadge({ status }: { status: RobotStatus }) {
  const { t } = useTranslation()
  return (
    <span className={cn('inline-block rounded px-2 py-0.5 text-xs font-medium whitespace-nowrap', STATUS_BADGE_CLASS[status])}>
      {t(`status.${status}`)}
    </span>
  )
}
