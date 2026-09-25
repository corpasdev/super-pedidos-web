import type { OrderListItem, SupplierListItem } from "../infrastructure/apiTypes"

const MONTH_LABEL = new Intl.DateTimeFormat("es-CO", { month: "short" })
const DAY_MS = 86_400_000

export interface MonthCount {
  label: string
  count: number
  isCurrent: boolean
}

export interface WeekRange {
  label: string
  min: number
  max: number
  isCurrent: boolean
}

export interface WeekdayVisits {
  weekday: number
  count: number
  isToday: boolean
}

export interface DaySchedule {
  weekday: number
  isToday: boolean
  ordering: SupplierListItem[]
  delivering: SupplierListItem[]
}

export interface InTransitOrder {
  order: OrderListItem
  supplier: SupplierListItem | null
  expectedDeliveryAt: Date | null
  /** 0–1: avance entre la confirmación y la entrega esperada. */
  progress: number
}

const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1)
const isoWeekday = (date: Date): number => (date.getDay() === 0 ? 7 : date.getDay())
const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate())

/** Pedidos confirmados por mes, los últimos `months` meses (el actual al final). */
export const ordersByMonth = (orders: OrderListItem[], now: Date, months = 4): MonthCount[] =>
  Array.from({ length: months }, (_, index) => {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - (months - 1 - index), 1)
    const nextMonthStart = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1)
    const count = orders.filter((order) => {
      const createdAt = new Date(order.createdAt)
      return createdAt >= monthStart && createdAt < nextMonthStart
    }).length
    return { label: MONTH_LABEL.format(monthStart).replace(".", ""), count, isCurrent: index === months - 1 }
  })

/** Variación porcentual redondeada; null si no hay base para comparar. */
export const percentChange = (current: number, previous: number): number | null =>
  previous === 0 ? null : Math.round(((current - previous) / previous) * 100)

const averageCost = (orders: OrderListItem[]): number =>
  orders.length === 0 ? 0 : Math.round(orders.reduce((total, order) => total + order.totalCost, 0) / orders.length)

/** Gasto promedio por pedido este mes y el del mes anterior. */
export const averageOrderCost = (orders: OrderListItem[], now: Date): { current: number; previous: number } => {
  const thisMonth = startOfMonth(now)
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const inRange = (from: Date, to: Date) =>
    orders.filter((order) => {
      const createdAt = new Date(order.createdAt)
      return createdAt >= from && createdAt < to
    })
  return {
    current: averageCost(inRange(thisMonth, new Date(now.getFullYear(), now.getMonth() + 1, 1))),
    previous: averageCost(inRange(lastMonth, thisMonth)),
  }
}

/** Rango (mínimo–máximo) del total de los pedidos por semana, las últimas `weeks` semanas. */
export const weeklyOrderRanges = (orders: OrderListItem[], now: Date, weeks = 6): WeekRange[] => {
  const thisWeekStart = new Date(startOfDay(now).getTime() - (isoWeekday(now) - 1) * DAY_MS)
  return Array.from({ length: weeks }, (_, index) => {
    const weekStart = new Date(thisWeekStart.getTime() - (weeks - 1 - index) * 7 * DAY_MS)
    const weekEnd = new Date(weekStart.getTime() + 7 * DAY_MS)
    const totals = orders
      .filter((order) => {
        const createdAt = new Date(order.createdAt)
        return createdAt >= weekStart && createdAt < weekEnd
      })
      .map((order) => order.totalCost)
    return {
      label: String(weekStart.getDate()).padStart(2, "0"),
      min: totals.length === 0 ? 0 : Math.min(...totals),
      max: totals.length === 0 ? 0 : Math.max(...totals),
      isCurrent: index === weeks - 1,
    }
  })
}

/** Cuántos vendedores pasan a tomar pedido cada día, de lunes (1) a sábado (6). */
export const visitsByWeekday = (suppliers: SupplierListItem[], now: Date): WeekdayVisits[] =>
  [1, 2, 3, 4, 5, 6].map((weekday) => ({
    weekday,
    count: suppliers.filter((supplier) => supplier.orderWeekday === weekday).length,
    isToday: isoWeekday(now) === weekday,
  }))

/** El vendedor que viene hoy; si nadie viene hoy, el de la próxima visita. */
export const nextSupplier = (suppliers: SupplierListItem[]): SupplierListItem | null => {
  const visitingToday = suppliers.find((supplier) => supplier.isVisitingToday)
  if (visitingToday !== undefined) return visitingToday
  const scheduled = suppliers
    .filter((supplier) => supplier.nextOrderDate !== null)
    .sort((left, right) => new Date(left.nextOrderDate!).getTime() - new Date(right.nextOrderDate!).getTime())
  return scheduled[0] ?? null
}

/** Fecha de entrega esperada: el siguiente `deliveryWeekday` desde la confirmación (el mismo día si coincide). */
export const expectedDeliveryDate = (confirmedAt: Date, deliveryWeekday: number | null): Date | null => {
  if (deliveryWeekday === null) return null
  const daysAhead = (deliveryWeekday - isoWeekday(confirmedAt) + 7) % 7
  return new Date(startOfDay(confirmedAt).getTime() + daysAhead * DAY_MS + 18 * 3_600_000)
}

/** El pedido confirmado más reciente que todavía no llega. */
export const inTransitOrder = (orders: OrderListItem[], suppliers: SupplierListItem[], now: Date): InTransitOrder | null => {
  const order = [...orders]
    .filter((candidate) => candidate.status === "confirmed")
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())[0]
  if (order === undefined) return null
  const supplier = suppliers.find((candidate) => candidate.id === order.supplierId) ?? null
  const confirmedAt = new Date(order.createdAt)
  const expectedDeliveryAt = expectedDeliveryDate(confirmedAt, supplier?.deliveryWeekday ?? null)
  const span = expectedDeliveryAt === null ? 0 : expectedDeliveryAt.getTime() - confirmedAt.getTime()
  const progress = span <= 0 ? 1 : Math.min(1, Math.max(0, (now.getTime() - confirmedAt.getTime()) / span))
  return { order, supplier, expectedDeliveryAt, progress }
}

/** Semana de lunes a domingo: quién pasa a tomar pedido y quién entrega cada día. */
export const weekSchedule = (suppliers: SupplierListItem[], now: Date): DaySchedule[] =>
  [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({
    weekday,
    isToday: isoWeekday(now) === weekday,
    ordering: suppliers.filter((supplier) => supplier.orderWeekday === weekday),
    delivering: suppliers.filter((supplier) => supplier.deliveryWeekday === weekday),
  }))

/** Pesos en formato corto para centros de gráficos: $320k, $1,2M. */
export const shortMoney = (pesos: number): string => {
  if (pesos >= 1_000_000) return `$${(pesos / 1_000_000).toLocaleString("es-CO", { maximumFractionDigits: 1 })}M`
  if (pesos >= 1_000) return `$${Math.round(pesos / 1_000)}k`
  return `$${pesos}`
}
