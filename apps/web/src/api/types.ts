export type RobotKind = 'amr' | 'forklift'
export type RobotStatus = 'idle' | 'moving' | 'picking' | 'charging' | 'fault' | 'offline'
export type Priority = 'low' | 'normal' | 'high'
export type OrderStatus = 'queued' | 'in_progress' | 'completed' | 'short' | 'cancelled'
export type TaskType = 'move' | 'pick' | 'charge'
export type TaskStatus = 'pending' | 'active' | 'done'
export type Severity = 'info' | 'warn' | 'error'
export type RobotCommand = 'pause' | 'resume' | 'recall'

export interface Point {
  x: number
  y: number
}

export interface Robot {
  id: string
  kind: RobotKind
  status: RobotStatus
  battery: number
  x: number
  y: number
  heading: number
  speed: number
  taskId: string | null
  lastSeen: string
}

export interface Task {
  id: string
  orderId: string | null
  type: TaskType
  status: TaskStatus
  robotId: string | null
  from: Point
  to: Point
  sku: string | null
  qty: number | null
  locationLabel: string | null
  startedAt: string | null
  finishedAt: string | null
}

export interface RobotDetail extends Robot {
  task: Task | null
}

export interface Order {
  id: string
  customer: string
  priority: Priority
  status: OrderStatus
  lineCount: number
  linesDone: number
  createdAt: string
  dueAt: string
}

export interface OrderDetail extends Order {
  tasks: Task[]
}
export interface OrdersResponse {
  items: Order[]
  counts: Record<OrderStatus, number>
}

export interface WocEvent {
  id: number
  ts: string
  severity: Severity
  code: string
  robotId: string | null
  orderId: string | null
  params: Record<string, string | number>
}

export interface Layout {
  width: number
  height: number
  racks: { x: number; y: number; w: number; d: number; h: number }[]
  stations: { id: string; x: number; y: number; kind: 'pick' | 'pack' }[]
  chargers: { id: string; x: number; y: number }[]
}

export interface KpiPoint {
  ts: string
  linesPerMin: number
  utilization: number
}

export interface DashboardSummary {
  online: number
  total: number
  utilization: number
  ordersInProgress: number
  linesPerMin: number
  series: KpiPoint[]
  byStatus: Record<RobotStatus, number>
}
