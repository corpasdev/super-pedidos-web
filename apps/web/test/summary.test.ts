// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest"
import { mount } from "@vue/test-utils"
import OrderSummaryPanel from "../src/presentation/components/wizard/OrderSummaryPanel.vue"
import type { SuggestionResponse } from "../src/infrastructure/apiTypes"

const suggestion = {
  supplier: { id: "s1", name: "ALPINA", productCount: 1, lastOrderAt: null },
  salesReportId: "r1",
  replenishmentMode: "replenish_sold",
  availableBudget: 30000,
  maximumOrderCost: 25988,
  allocatedOrderCost: 25988,
  remainingBudget: 4012,
  status: "complete",
  statusExplanation: { key: "order.status.maximum", params: {} },
  groups: [
    {
      brandName: "ALPINA",
      subtotal: 25988,
      lines: [
        {
          productId: "p1",
          productName: "Queso doble crema",
          barcode: "7702000000001",
          category: "Lácteos",
          packSize: 6,
          unitsSold: 12,
          targetUnits: 20,
          stockToDiscount: 0,
          suggestedMaximumUnits: 12,
          finalUnits: 12,
          allocatedUnits: 12,
          unitCost: 2500,
          maximumLineCost: 30000,
          allocatedLineCost: 30000,
          finalLineCost: 30000,
          isCutByBudget: false,
          isAdjustedByOwner: false,
          coverageRatio: 1,
        },
      ],
    },
  ],
  plainText: "pedido",
} as unknown as SuggestionResponse

describe("OrderSummaryPanel", () => {
  it("muestra el total animado y la frase de estado en pesos", async () => {
    const wrapper = mount(OrderSummaryPanel, { props: { suggestion } })
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("$25.988")
    })
    expect(wrapper.text()).toContain("Hay plata para todo")
  })

  it("refleja las unidades editadas por el dueño y avisa el estado recalculado", async () => {
    const wrapper = mount(OrderSummaryPanel, {
      props: { suggestion, ownerUnits: { p1: 6 } },
    })
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain("$15.000")
    })
    expect(wrapper.text()).toContain("Estado actualizado al confirmar")
  })
})