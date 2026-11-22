import { http, HttpResponse } from 'msw'
import type { OrderStatus, RobotCommand } from '@/api/types'
import { getWorld } from '@/telemetry/mock/world'

// REST side of mock mode; the same MockWorld also feeds MockSource telemetry.
export const handlers = [
  http.get('/api/layout', () => HttpResponse.json(getWorld().layout)),
  http.get('/api/robots', () => HttpResponse.json(getWorld().robots())),
  http.get('/api/robots/:id', ({ params }) => HttpResponse.json(getWorld().robotDetail(String(params.id)))),
  http.post('/api/robots/:id/commands', async ({ params, request }) => {
    const body = (await request.json()) as { command: RobotCommand }
    return HttpResponse.json(getWorld().command(String(params.id), body.command))
  }),
  http.get('/api/dashboard/summary', () => HttpResponse.json(getWorld().summary())),
  http.get('/api/orders', ({ request }) => {
    const status = new URL(request.url).searchParams.get('status') as OrderStatus | null
    return HttpResponse.json(getWorld().ordersList(status ?? undefined))
  }),
  http.get('/api/orders/:id', ({ params }) => HttpResponse.json(getWorld().orderDetail(String(params.id)))),
  http.post('/api/orders/demo', () => HttpResponse.json(getWorld().demoOrder())),
  http.get('/api/events', ({ request }) => {
    const limit = Number(new URL(request.url).searchParams.get('limit') ?? 200)
    return HttpResponse.json(getWorld().eventsList(limit))
  }),
  http.get('/api/handheld/next-task', () => HttpResponse.json({ task: getWorld().nextHandheld() })),
  http.post('/api/handheld/tasks/:id/confirm', ({ params }) => {
    getWorld().confirm(String(params.id))
    return HttpResponse.json({ ok: true })
  }),
  http.post('/api/handheld/tasks/:id/issue', ({ params }) => {
    getWorld().issue(String(params.id))
    return HttpResponse.json({ ok: true })
  }),
  http.post('/api/sim/faults', () => HttpResponse.json(getWorld().injectFault())),
]
