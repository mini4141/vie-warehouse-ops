import type {
  DashboardSummary,
  Layout,
  Order,
  OrderDetail,
  OrdersResponse,
  OrderStatus,
  Robot,
  RobotCommand,
  RobotDetail,
  Task,
  WocEvent,
} from './types'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

export const api = {
  layout: () => request<Layout>('/layout'),
  robots: () => request<Robot[]>('/robots'),
  robot: (id: string) => request<RobotDetail>(`/robots/${id}`),
  command: (id: string, command: RobotCommand) => post<Robot>(`/robots/${id}/commands`, { command }),
  summary: () => request<DashboardSummary>('/dashboard/summary'),
  orders: (status?: OrderStatus) => request<OrdersResponse>(`/orders${status ? `?status=${status}` : ''}`),
  order: (id: string) => request<OrderDetail>(`/orders/${id}`),
  demoOrder: () => post<Order>('/orders/demo'),
  events: (limit = 200) => request<WocEvent[]>(`/events?limit=${limit}`),
  nextTask: () => request<{ task: Task | null }>('/handheld/next-task'),
  confirmTask: (id: string) => post<{ ok: boolean }>(`/handheld/tasks/${id}/confirm`),
  reportIssue: (id: string) => post<{ ok: boolean }>(`/handheld/tasks/${id}/issue`),
  injectFault: () => post<WocEvent>('/sim/faults'),
}
