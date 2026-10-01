import { describe, expect, it } from "vitest"
import { mockRequest } from "../src/infrastructure/mockApi"
import type { BuildSuggestionResponse, ConfirmOrderResponse, InboxItem } from "../src/infrastructure/apiTypes"

describe("modo de prueba de Sugeridos (data/mock)", () => {
  it("responde la bandeja, el sugerido y deja pasar las lecturas ajenas a Sugeridos", async () => {
    const { inbox } = (await mockRequest("GET", "/inbox/today?day=2026-10-05")) as { inbox: InboxItem }
    expect(inbox.vendors.length).toBeGreaterThan(0)

    const pending = inbox.vendors.find((vendor) => vendor.orderToday === null && (vendor.ready?.productCount ?? 0) > 0)!
    const built = (await mockRequest("POST", `/order-suggestions/suppliers/${pending.supplierId}`, {})) as BuildSuggestionResponse
    expect(built.suggestion.finalOrderCost).toBe(pending.ready!.totalCost)

    expect(await mockRequest("GET", "/store-profile")).toBeUndefined()
  })

  it("confirmar descuenta la caja y marca el pedido de hoy, sin tocar la API", async () => {
    const { inbox } = (await mockRequest("GET", "/inbox/today")) as { inbox: InboxItem }
    const pending = inbox.vendors.find((vendor) => vendor.orderToday === null && (vendor.ready?.productCount ?? 0) > 0)!
    const spentBefore = inbox.cash.spentAmount

    const result = (await mockRequest("POST", `/order-suggestions/suppliers/${pending.supplierId}/confirm`, {
      sellerId: pending.sellerId,
      paidNow: true,
    })) as ConfirmOrderResponse

    expect(result.order.totalCost).toBe(pending.ready!.totalCost)
    const { inbox: after } = (await mockRequest("GET", "/inbox/today")) as { inbox: InboxItem }
    expect(after.cash.spentAmount).toBe(spentBefore + result.order.totalCost)
    expect(after.vendors.find((vendor) => vendor.sellerId === pending.sellerId)!.orderToday).not.toBeNull()
  })

  it("bloquea las escrituras que no son de Sugeridos", async () => {
    await expect(mockRequest("PATCH", "/store-profile", {})).rejects.toThrow(/modo de prueba/)
  })
})
