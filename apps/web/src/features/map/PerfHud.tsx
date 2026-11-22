import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { perf } from '@/lib/perf'

/** Updates its own DOM text from the perf counters, so the HUD adds zero React commits. */
export function PerfHud() {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let lastCommits = perf.commits
    const id = setInterval(() => {
      const commits = perf.commits - lastCommits
      lastCommits = perf.commits
      const el = ref.current
      if (el) {
        el.dataset.fps = String(Math.round(perf.fps))
        el.textContent = [
          `${t('perf.fps')} ${perf.fps.toFixed(0)}`,
          `${t('perf.robots')} ${perf.robots}`,
          `${t('perf.commits')} ${commits}`,
          `${t('perf.msgs')} ${perf.wsMsgs}`,
        ].join('  ·  ')
      }
    }, 1000)
    return () => clearInterval(id)
  }, [t])
  return (
    <div
      ref={ref}
      data-testid="perf-hud"
      className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-border bg-panel/90 px-3 py-1.5 font-mono text-xs tabular-nums"
    />
  )
}
