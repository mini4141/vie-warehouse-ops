import { useMutation } from '@tanstack/react-query'
import { Zap } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/api/client'
import { useUiStore, type Density, type Theme } from '@/app/uiStore'
import { LangSwitch } from '@/components/LangSwitch'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { DATA_SOURCE } from '@/telemetry'

const THEMES: Theme[] = ['dark', 'light', 'high-contrast']
const DENSITIES: Density[] = ['comfortable', 'compact']
const VERSION = import.meta.env.VITE_APP_VERSION ?? 'dev'

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  )
}

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: T[]; onChange: (v: T) => void; label: (v: T) => string }) {
  return (
    <div className="flex overflow-hidden rounded-md border border-border text-sm">
      {options.map((o) => (
        <button key={o} aria-pressed={value === o} onClick={() => onChange(o)} className={cn('px-3 py-1.5', value === o ? 'bg-accent text-accent-fg' : 'hover:bg-panel2')}>
          {label(o)}
        </button>
      ))}
    </div>
  )
}

export default function SettingsPage() {
  const { t } = useTranslation()
  const { theme, setTheme, density, setDensity } = useUiStore()
  const fault = useMutation({
    mutationFn: api.injectFault,
    onSuccess: (e) => toast.info(t('settings.faultInjected', { robot: e.robotId ?? '' })),
  })
  return (
    <div className="mx-auto max-w-2xl p-6">
      <section className="rounded-lg border border-border bg-panel px-4">
        <Row label={t('settings.language')}>
          <LangSwitch />
        </Row>
        <Row label={t('settings.theme')}>
          <Segmented value={theme} options={THEMES} onChange={setTheme} label={(v) => t(`theme.${v}`)} />
        </Row>
        <Row label={t('settings.density')}>
          <Segmented value={density} options={DENSITIES} onChange={setDensity} label={(v) => t(`density.${v}`)} />
        </Row>
        <Row label={t('settings.dataSource')}>
          <span data-testid="data-source" className="rounded-full border border-border px-3 py-1 text-xs">
            {DATA_SOURCE === 'mock' ? t('conn.mock') : t('conn.live')}
          </span>
        </Row>
        <Row label={t('settings.injectFault')}>
          <Button variant="danger" onClick={() => fault.mutate()} disabled={fault.isPending}>
            <Zap className="size-4" />
            {t('settings.injectFaultButton')}
          </Button>
        </Row>
      </section>
      <footer className="mt-6 text-center text-xs text-muted" data-testid="app-version">
        {t('settings.version', { version: VERSION })}
      </footer>
    </div>
  )
}
