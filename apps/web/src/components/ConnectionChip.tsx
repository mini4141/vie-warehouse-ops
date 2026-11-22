import { useTranslation } from 'react-i18next'
import { useTelemetryStore } from '@/telemetry/store'
import { useTelemetryValue } from '@/telemetry/hooks'
import { cn } from '@/lib/utils'

export function ConnectionChip() {
  const { t } = useTranslation()
  const state = useTelemetryStore((s) => s.connection)
  const latency = useTelemetryValue((s) => Math.round(s.latencyMs))
  const ok = state === 'live' || state === 'mock'
  const label = state === 'live' ? `${t('conn.live')} · ${latency} ms` : t(`conn.${state}`)
  return (
    <span
      data-testid="connection-chip"
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-border px-3 py-1 text-xs tabular-nums',
        ok ? 'text-ok' : 'text-warn',
      )}
    >
      <span className={cn('size-2 rounded-full', ok ? 'bg-ok' : 'animate-pulse bg-warn')} />
      {label}
    </span>
  )
}
