// Domain types come from the FastAPI OpenAPI document (`make gen-api`); do not hand-edit the shapes.
import type { components } from './schema'

type S = components['schemas']

export type Point = S['Point']
export type Robot = S['Robot']
export type RobotDetail = S['RobotDetail']
export type Task = S['Task']
export type Order = S['Order']
export type OrderDetail = S['OrderDetail']
export type OrdersResponse = S['OrdersResponse']
export type WocEvent = S['Event']
export type Layout = S['Layout']
export type KpiPoint = S['KpiPoint']
export type DashboardSummary = S['DashboardSummary']

export type RobotKind = Robot['kind']
export type RobotStatus = Robot['status']
export type Priority = Order['priority']
export type OrderStatus = Order['status']
export type TaskType = Task['type']
export type TaskStatus = Task['status']
export type Severity = WocEvent['severity']
export type RobotCommand = S['CommandBody']['command']
