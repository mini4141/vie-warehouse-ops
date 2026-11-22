import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { lazy, Profiler, Suspense, useEffect } from 'react'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { ScreenSkeleton } from '@/components/Skeleton'
import { perf } from '@/lib/perf'
import { startTelemetry } from '@/telemetry'
import { AppShell } from './AppShell'
import { useUiStore } from './uiStore'

const Dashboard = lazy(() => import('@/features/dashboard/DashboardPage'))
const FleetMap = lazy(() => import('@/features/map/FleetMapPage'))
const Fleet = lazy(() => import('@/features/fleet/FleetPage'))
const Orders = lazy(() => import('@/features/orders/OrdersPage'))
const Events = lazy(() => import('@/features/events/EventsPage'))
const Handheld = lazy(() => import('@/features/handheld/HandheldPage'))
const Settings = lazy(() => import('@/features/settings/SettingsPage'))

const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/fleet/map', element: <FleetMap /> },
      { path: '/fleet', element: <Fleet /> },
      { path: '/orders', element: <Orders /> },
      { path: '/events', element: <Events /> },
      { path: '/settings', element: <Settings /> },
    ],
  },
  // Handheld renders without the nav shell.
  {
    path: '/handheld',
    element: (
      <Suspense fallback={<ScreenSkeleton />}>
        <Handheld />
      </Suspense>
    ),
  },
])

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } })

export function App() {
  useEffect(() => {
    startTelemetry()
    // Handheld defaults to high-contrast unless the user chose a theme explicitly.
    if (location.pathname === '/handheld' && !localStorage.getItem('woc.theme')) useUiStore.setState({ theme: 'high-contrast' })
  }, [])
  return (
    <Profiler id="app" onRender={() => { perf.commits++ }}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </Profiler>
  )
}
