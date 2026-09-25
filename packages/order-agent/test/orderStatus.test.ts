import { describe, expect, it } from "vitest"
import { resolveOrderStatus } from "../src/formulas/orderStatus.js"
import { OrderStatus } from "../src/domain/enums.js"
import type { OrderStatusContext } from "../src/formulas/orderStatus.js"

const context = (overrides: Partial<OrderStatusContext>): OrderStatusContext => ({
  lineCount: 3,
  finalOrderCost: 12_000,
  availableBudget: 50_000,
  maximumOrderCost: 40_000,
  minimumOrderAmount: 0,
  hasMinimumOrder: false,
  hasOwnerAdjustments: false,
  ...overrides,
})

describe("F10: estado del pedido", () => {
  it("sin líneas → NothingToOrder", () => {
    const { status, explanation } = resolveOrderStatus(context({ lineCount: 0 }))
    expect(status).toBe(OrderStatus.NothingToOrder)
    expect(explanation.key).toBe("order.status.nothingToOrder")
  })

  it("B=$1.000 y el empaque más barato cuesta $6.000 → Postponed (no alcanza ni para un empaque)", () => {
    const { status, explanation } = resolveOrderStatus(
      context({ lineCount: 1, finalOrderCost: 0, availableBudget: 1_000 }),
    )
    expect(status).toBe(OrderStatus.Postponed)
    expect(explanation.key).toBe("order.status.notEvenOnePack")
    expect(explanation.params.availableBudget).toBe(1_000)
  })

  it("con minimumOrderAmount = 0 nunca es BelowMinimum", () => {
    const withBudgetCortado = resolveOrderStatus(
      context({ hasMinimumOrder: false, minimumOrderAmount: 0, availableBudget: 10_000, maximumOrderCost: 40_000 }),
    )
    expect(withBudgetCortado.status).toBe(OrderStatus.WithinBudget)

    const complete = resolveOrderStatus(context({ hasMinimumOrder: false, minimumOrderAmount: 0, availableBudget: 50_000, maximumOrderCost: 40_000 }))
    expect(complete.status).toBe(OrderStatus.Complete)
  })

  it("si no alcanza el pedido mínimo del vendedor → BelowMinimum", () => {
    const { status, explanation } = resolveOrderStatus(
      context({ hasMinimumOrder: true, minimumOrderAmount: 100_000, finalOrderCost: 12_000 }),
    )
    expect(status).toBe(OrderStatus.BelowMinimum)
    expect(explanation.key).toBe("order.status.belowSupplierMinimum")
  })

  it("ajustes del dueño que superan la plata → OverBudget con la diferencia exacta", () => {
    const { status, explanation } = resolveOrderStatus(
      context({ hasOwnerAdjustments: true, finalOrderCost: 62_000, availableBudget: 50_000 }),
    )
    expect(status).toBe(OrderStatus.OverBudget)
    expect(explanation.key).toBe("order.status.overBudget")
    expect(explanation.params.overBy).toBe(12_000)
  })

  it("ajustes del dueño dentro de la plata → AdjustedByOwner", () => {
    const { status } = resolveOrderStatus(
      context({ hasOwnerAdjustments: true, finalOrderCost: 45_000, availableBudget: 50_000 }),
    )
    expect(status).toBe(OrderStatus.AdjustedByOwner)
  })

  it("B ≥ máximo → Complete", () => {
    const { status, explanation } = resolveOrderStatus(context({ availableBudget: 40_000, maximumOrderCost: 40_000 }))
    expect(status).toBe(OrderStatus.Complete)
    expect(explanation.key).toBe("order.status.maximum")
  })

  it("en otro caso → WithinBudget", () => {
    const { status, explanation } = resolveOrderStatus(
      context({ availableBudget: 20_000, maximumOrderCost: 40_000 }),
    )
    expect(status).toBe(OrderStatus.WithinBudget)
    expect(explanation.key).toBe("order.status.withinBudget")
  })
})