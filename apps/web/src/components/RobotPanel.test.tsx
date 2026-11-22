import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import '@/i18n'
import { useUiStore } from '@/app/uiStore'
import { RobotPanel } from './RobotPanel'

vi.mock('@/api/client', () => ({
  api: {
    robots: async () => [{ id: 'R-001' }],
    robot: async () => ({
      id: 'R-001', kind: 'amr', status: 'moving', battery: 77, x: 1, y: 2, heading: 0, speed: 1.5, taskId: 'T-1',
      lastSeen: new Date().toISOString(),
      task: { id: 'T-1', locationLabel: 'A-07-3' },
    }),
    command: async () => ({}),
  },
}))

describe('RobotPanel', () => {
  it('shows the selected robot and its actions', async () => {
    useUiStore.setState({ selectedRobotId: 'R-001' })
    render(<QueryClientProvider client={new QueryClient()}><RobotPanel /></QueryClientProvider>)
    expect(await screen.findByText('T-1 · A-07-3')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pause/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Recall to charger/ })).toBeInTheDocument()
  })
})
