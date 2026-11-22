import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { api } from '@/api/client'
import { Sheet } from '@/components/ui/sheet'
import { formatDateTime } from '@/lib/format'
import { TaskTimeline } from './TaskTimeline'

export function OrderDrawer({ orderId, onClose }: { orderId: string | null; onClose: () => void }) {
  const { t } = useTranslation()
  const { data } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => api.order(orderId!),
    enabled: !!orderId,
    refetchInterval: 3000,
  })
  return (
    <Sheet open={!!orderId} onOpenChange={(o) => !o && onClose()} title={orderId ?? ''}>
      {data && (
        <div className="space-y-5" data-testid="order-drawer">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">{t('orders.col.customer')}</dt>
            <dd>{data.customer}</dd>
            <dt className="text-muted">{t('orders.col.priority')}</dt>
            <dd>{t(`priority.${data.priority}`)}</dd>
            <dt className="text-muted">{t('orders.col.status')}</dt>
            <dd>{t(`orderStatus.${data.status}`)}</dd>
            <dt className="text-muted">{t('orders.col.progress')}</dt>
            <dd className="tabular-nums">{`${data.linesDone} / ${data.lineCount}`}</dd>
            <dt className="text-muted">{t('orders.col.due')}</dt>
            <dd>{formatDateTime(data.dueAt)}</dd>
          </dl>
          <h3 className="text-sm font-medium text-muted">{t('orders.timeline')}</h3>
          <TaskTimeline tasks={data.tasks} />
        </div>
      )}
    </Sheet>
  )
}
