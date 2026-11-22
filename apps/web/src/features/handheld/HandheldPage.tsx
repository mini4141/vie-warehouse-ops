import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, Check, ScanLine } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Toaster, toast } from 'sonner'
import { api } from '@/api/client'
import { useUiStore } from '@/app/uiStore'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** 360×800 industrial-Android layout: no shell, big text, 48px+ targets, keyboard-wedge scanner input. */
export default function HandheldPage() {
  const { t } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const inputRef = useRef<HTMLInputElement>(null)
  const [flash, setFlash] = useState(false)
  const next = useQuery({ queryKey: ['handheld', 'next'], queryFn: api.nextTask, refetchInterval: 3000 })
  const layout = useQuery({ queryKey: ['layout'], queryFn: api.layout, staleTime: Infinity })
  const task = next.data?.task ?? null

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const confirm = useMutation({
    mutationFn: (id: string) => api.confirmTask(id),
    onSuccess: async () => {
      setFlash(true)
      setTimeout(() => setFlash(false), 700)
      await next.refetch()
    },
  })
  const issue = useMutation({
    mutationFn: (id: string) => api.reportIssue(id),
    onSuccess: () => toast.warning(t('handheld.issueSent')),
  })

  // A wedge scanner "types" the barcode and finishes with Enter into the focused (hidden) input.
  const keepFocus = () => inputRef.current?.focus()
  useEffect(keepFocus, [task?.id])
  const onScan = (code: string) => {
    if (task && code.trim() === task.sku) confirm.mutate(task.id)
  }

  const station = layout.data?.stations.find((s) => task && s.x === task.to.x && s.y === task.to.y)?.id ?? '—'

  return (
    <div className="mx-auto flex min-h-full w-full max-w-[420px] flex-col gap-4 bg-bg p-4 text-lg" onClick={keepFocus}>
      <input
        ref={inputRef}
        aria-label={t('handheld.scanInput')}
        autoFocus
        className="sr-only"
        onBlur={() => setTimeout(keepFocus, 50)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onScan(e.currentTarget.value)
            e.currentTarget.value = ''
          }
        }}
      />
      <header className="flex items-center gap-3 border-b-2 border-border pb-3">
        <ScanLine className="size-7 text-accent" />
        <h1 className="text-xl font-bold">{t('handheld.title')}</h1>
      </header>

      {task ? (
        <section className={cn('flex flex-1 flex-col gap-4 rounded-xl border-2 border-border p-4', flash && 'flash-ok')} data-testid="pick-card">
          <div>
            <p className="text-base text-muted">{t('handheld.location')}</p>
            <p className="text-5xl font-extrabold tracking-wide text-accent" data-testid="pick-location">
              {task.locationLabel}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-base text-muted">{t('handheld.sku')}</p>
              <p className="text-2xl font-bold" data-testid="pick-sku">
                {task.sku}
              </p>
            </div>
            <div>
              <p className="text-base text-muted">{t('handheld.station')}</p>
              <p className="text-2xl font-bold">{station}</p>
            </div>
          </div>
          <div>
            <p className="text-base text-muted">{t('handheld.qty')}</p>
            <p className="text-8xl leading-none font-black tabular-nums" data-testid="pick-qty">
              {task.qty}
            </p>
          </div>
          <p className="text-base text-muted">{t('handheld.scanHint')}</p>
          <div className="mt-auto flex flex-col gap-3">
            <Button variant="outline" size="lg" className="h-14 border-2" onClick={() => onScan(task.sku ?? '')}>
              <ScanLine className="size-6" />
              {t('handheld.simulateScan')}
            </Button>
            <Button size="lg" className="h-16 text-xl font-bold" disabled={confirm.isPending} onClick={() => confirm.mutate(task.id)}>
              <Check className="size-6" />
              {t('handheld.confirm')}
            </Button>
            <Button variant="danger" size="lg" className="h-14" onClick={() => issue.mutate(task.id)}>
              <AlertTriangle className="size-6" />
              {t('handheld.issue')}
            </Button>
          </div>
        </section>
      ) : (
        <p className="flex flex-1 items-center justify-center text-center text-muted">{t('handheld.noTask')}</p>
      )}
      <Toaster position="top-center" richColors />
    </div>
  )
}
