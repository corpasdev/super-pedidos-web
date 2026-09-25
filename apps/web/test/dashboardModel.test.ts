import { describe, expect, it } from "vitest"
import {
  averageOrderCost,
  expectedDeliveryDate,
  inTransitOrder,
  nextSupplier,
  ordersByMonth,
  percentChange,
  shortMoney,
  weekSchedule,
} from "../src/stores/dashboardModel"
import type { OrderListItem, SupplierListItem } from "../src/infrastructure/apiTypes"

const order = (overrides: Partial<OrderListItem>): OrderListItem => ({
  id: "order-1",
  supplierId: "supplier-1",
  supplierName: "Distribuidora Andina",
  status: "confirmed",
  totalCost: 100_000,
  availableBudget: null,
  maximumOrderCost: null,
  createdAt: "2026-09-24T14:33:00",
  paidAmount: 0,
  pendingAmount: 100_000,
  isSettled: false,
  paidAt: null,
  ...overrides,
})

const supplier = (overrides: Partial<SupplierListItem>): SupplierListItem => ({
  id: "supplier-1",
  name: "Distribuidora Andina",
  taxId: null,
  contactEmail: null,
  hasSchedule: true,
  orderWeekday: 4,
  deliveryWeekday: 5,
  visitFrequencyDays: 7,
  deliveryLeadDays: 1,
  nextOrderDate: "2026-10-01T00:00:00",
  lastDeliveryDate: null,
  isVisitingToday: false,
  minimumOrderAmount: 20_000,
  maximumOrderAmount: 250_000,
  isEstimated: false,
  productCount: 12,
  lastOrderAt: null,
  ...overrides,
})

const THURSDAY_24_SEP = new Date(2026, 8, 24, 16, 0)

describe("dashboardModel", () => {
  it("cuenta pedidos por mes con el actual al final", () => {
    const months = ordersByMonth(
      [order({ createdAt: "2026-09-02T10:00:00" }), order({ createdAt: "2026-09-20T10:00:00" }), order({ createdAt: "2026-08-15T10:00:00" })],
      THURSDAY_24_SEP,
      4,
    )
    expect(months.map((month) => month.count)).toEqual([0, 0, 1, 2])
    expect(months.at(-1)?.isCurrent).toBe(true)
  })

  it("variación porcentual; sin mes anterior devuelve null", () => {
    expect(percentChange(132, 105)).toBe(26)
    expect(percentChange(5, 0)).toBeNull()
  })

  it("gasto promedio por pedido del mes actual y del anterior", () => {
    const average = averageOrderCost(
      [order({ totalCost: 100_000 }), order({ totalCost: 200_000, createdAt: "2026-09-10T10:00:00" }), order({ totalCost: 90_000, createdAt: "2026-08-10T10:00:00" })],
      THURSDAY_24_SEP,
    )
    expect(average).toEqual({ current: 150_000, previous: 90_000 })
  })

  it("el vendedor que viene hoy va primero; si nadie, la próxima visita", () => {
    const later = supplier({ id: "later", nextOrderDate: "2026-10-03T00:00:00" })
    const sooner = supplier({ id: "sooner", nextOrderDate: "2026-09-26T00:00:00" })
    expect(nextSupplier([later, sooner])?.id).toBe("sooner")
    expect(nextSupplier([later, supplier({ id: "today", isVisitingToday: true })])?.id).toBe("today")
  })

  it("entrega esperada: siguiente día de entrega; el mismo día si coincide", () => {
    expect(expectedDeliveryDate(new Date(2026, 8, 24, 10), 5)?.getDate()).toBe(25)
    expect(expectedDeliveryDate(new Date(2026, 8, 24, 10), 4)?.getDate()).toBe(24)
  })

  it("pedido en camino: el confirmado más reciente, con avance entre 0 y 1", () => {
    const transit = inTransitOrder(
      [order({ id: "old", status: "received" }), order({ id: "new", createdAt: "2026-09-24T10:00:00" })],
      [supplier({})],
      THURSDAY_24_SEP,
    )
    expect(transit?.order.id).toBe("new")
    expect(transit?.progress).toBeGreaterThan(0)
    expect(transit?.progress).toBeLessThan(1)
  })

  it("semana: quién pide y quién entrega cada día, marcando hoy", () => {
    const week = weekSchedule([supplier({})], THURSDAY_24_SEP)
    expect(week.find((day) => day.weekday === 4)?.ordering).toHaveLength(1)
    expect(week.find((day) => day.weekday === 5)?.delivering).toHaveLength(1)
    expect(week.find((day) => day.isToday)?.weekday).toBe(4)
  })

  it("pesos cortos para el centro del medidor", () => {
    expect(shortMoney(320_000)).toBe("$320k")
    expect(shortMoney(1_250_000)).toBe("$1,3M")
    expect(shortMoney(800)).toBe("$800")
  })
})
