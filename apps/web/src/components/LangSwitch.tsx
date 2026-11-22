import { useTranslation } from 'react-i18next'
import { setLanguage } from '@/i18n'
import { cn } from '@/lib/utils'

const LANGS = [
  { code: 'en', label: 'EN' },
  { code: 'ja', label: '日本語' },
] as const

export function LangSwitch() {
  const { i18n, t } = useTranslation()
  return (
    <div role="group" aria-label={t('settings.language')} className="inline-flex overflow-hidden rounded-md border border-border text-xs">
      {LANGS.map((l) => (
        <button
          key={l.code}
          aria-pressed={i18n.language === l.code}
          onClick={() => setLanguage(l.code)}
          className={cn('px-2.5 py-1.5', i18n.language === l.code ? 'bg-accent text-accent-fg' : 'hover:bg-panel2')}
        >
          {l.label}
        </button>
      ))}
    </div>
  )
}
