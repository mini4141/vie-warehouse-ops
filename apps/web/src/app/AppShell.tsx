import { Activity, Bot, ClipboardList, LayoutDashboard, Map as MapIcon, PanelLeft, ScanLine, Settings } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Toaster, toast } from 'sonner'
import { ConnectionChip } from '@/components/ConnectionChip'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { LangSwitch } from '@/components/LangSwitch'
import { RobotPanel } from '@/components/RobotPanel'
import { ScreenSkeleton } from '@/components/Skeleton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import i18n from '@/i18n'
import { eventText } from '@/lib/eventText'
import { cn } from '@/lib/utils'
import { useTelemetryStore } from '@/telemetry/store'
import { useUiStore } from './uiStore'

const NAV = [
  { to: '/', key: 'dashboard', icon: LayoutDashboard, end: true },
  { to: '/fleet/map', key: 'fleetMap', icon: MapIcon },
  { to: '/fleet', key: 'fleet', icon: Bot, end: true },
  { to: '/orders', key: 'orders', icon: ClipboardList },
  { to: '/events', key: 'events', icon: Activity },
  { to: '/handheld', key: 'handheld', icon: ScanLine },
  { to: '/settings', key: 'settings', icon: Settings },
] as const

export function AppShell() {
  const { t } = useTranslation()
  const { pathname } = useLocation()
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 1024)
  const theme = useUiStore((s) => s.theme)
  const density = useUiStore((s) => s.density)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.dataset.density = density
  }, [theme, density])

  // Error events raise a toast; subscribed outside React so it costs no renders.
  useEffect(
    () =>
      useTelemetryStore.subscribe((s, prev) => {
        const latest = s.events[0]
        if (latest && latest !== prev.events[0] && latest.severity === 'error') {
          toast.error(eventText(i18n.t.bind(i18n), latest))
        }
      }),
    [],
  )

  const current = NAV.find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)) && !(n.to === '/fleet' && pathname.startsWith('/fleet/map')))
  return (
    <div className="flex h-full">
      <nav aria-label="Main" className={cn('flex shrink-0 flex-col border-r border-border bg-panel py-3 transition-[width]', collapsed ? 'w-14' : 'w-52')}>
        <Button variant="ghost" size="icon" className="mx-2 mb-2" aria-label="Toggle navigation" onClick={() => setCollapsed((c) => !c)}>
          <PanelLeft className="size-4" />
        </Button>
        {NAV.map(({ to, key, icon: Icon, ...rest }) => (
          <NavLink
            key={to}
            to={to}
            end={'end' in rest}
            className={({ isActive }) =>
              cn('mx-2 flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-panel2', isActive && 'bg-panel2 font-medium text-accent')
            }
          >
            <Icon className="size-4 shrink-0" />
            {!collapsed && <span className="min-w-0 truncate">{t(`nav.${key}`)}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-panel px-4">
          <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{current ? t(`nav.${current.key}`) : t('app.title')}</h1>
          <ConnectionChip />
          <LangSwitch />
          <ThemeToggle />
        </header>
        <main className="relative min-h-0 flex-1 overflow-auto">
          <ErrorBoundary key={pathname}>
            <Suspense fallback={<ScreenSkeleton />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
          <RobotPanel />
        </main>
      </div>
      <Toaster position="bottom-right" theme={theme === 'light' ? 'light' : 'dark'} richColors />
    </div>
  )
}
