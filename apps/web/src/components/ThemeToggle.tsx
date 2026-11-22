import { Contrast, Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useUiStore, type Theme } from '@/app/uiStore'
import { Button } from './ui/button'

const ORDER: Theme[] = ['dark', 'light', 'high-contrast']
const ICON = { dark: Moon, light: Sun, 'high-contrast': Contrast }

export function ThemeToggle() {
  const { t } = useTranslation()
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const Icon = ICON[theme]
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={`${t('settings.theme')}: ${t(`theme.${theme}`)}`}
      onClick={() => setTheme(ORDER[(ORDER.indexOf(theme) + 1) % ORDER.length])}
    >
      <Icon className="size-4" />
    </Button>
  )
}
