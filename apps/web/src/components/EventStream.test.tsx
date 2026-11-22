import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import '@/i18n'
import type { WocEvent } from '@/api/types'
import { EventStream } from './EventStream'

const event = (over: Partial<WocEvent>): WocEvent => ({
  id: 1, ts: new Date().toISOString(), severity: 'error', code: 'ROBOT_FAULT', robotId: 'R-042', orderId: null, params: { reason: 'motor' }, ...over,
})

describe('EventStream', () => {
  it('renders coded events through i18n with params', () => {
    render(<MemoryRouter><EventStream events={[event({})]} /></MemoryRouter>)
    expect(screen.getByText('R-042 fault: motor')).toBeInTheDocument()
  })

  it('shows a single-line empty state', () => {
    render(<MemoryRouter><EventStream events={[]} /></MemoryRouter>)
    expect(screen.getByText('No events.')).toBeInTheDocument()
  })
})
