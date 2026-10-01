import { describe, expect, it } from "vitest"
import { mockRequest } from "../src/infrastructure/mockApi"
import type { BuildSuggestionResponse, ConfirmOrderResponse, InboxItem } from "../src/infrastructure/apiTypes"

describe("modo de prueba de Sugeridos (data/mock)", () => {
  it("responde la bandeja y el sugerido sin llamar a la API", async () => {
    const { inbox } = (await mockRequest("GET", "/inbox/today?day=2026-10-05")) as { inbox: InboxItem }
    expect(inbox.vendors.length).toBeGreaterThan(0)

    const pending = inbox.vendors.find((vendor) => vendor.orderToday === null && (vendor.ready?.productCount ?? 0) > 0)!
    const built = (await mockRequest("POST", `/order-suggestions/suppliers/${pending.supplierId}`, {})) as BuildSuggestionResponse
    expect(built.suggestion.finalOrderCost).toBe(pending.ready!.totalCost)

    await expect(mockRequest("GET", "/ruta-que-no-existe")).rejects.toThrow(/modo de prueba/)
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

  it("simula Productos, Proveedores y vencidos en memoria", async () => {
    const created = (await mockRequest("POST", "/products", {
      barcode: "MOCK-1",
      name: "producto nuevo",
      category: "abarrotes",
      salePrice: 2400,
      minStockUnits: 2,
      maxStockUnits: 10,
    })) as { id: string }
    const { products } = (await mockRequest("GET", "/products")) as { products: { id: string; reorderPointUnits: number | null }[] }
    expect(products.find((product) => product.id === created.id)?.reorderPointUnits).toBe(6)
    await expect(mockRequest("POST", "/products", { barcode: "MOCK-1", name: "x", category: "y", salePrice: 1 })).rejects.toThrow(/Ya existe/)

    await mockRequest("POST", "/suppliers", { name: "nuevo", orderWeekday: 2, deliveryWeekday: 4, minimumOrderAmount: 20000, maximumOrderAmount: 100000 })
    const { suppliers } = (await mockRequest("GET", "/suppliers")) as { suppliers: { name: string }[] }
    expect(suppliers.some((supplier) => supplier.name === "NUEVO")).toBe(true)

    const { exchange } = (await mockRequest("POST", "/expired-exchanges", { productId: created.id, units: 2 })) as { exchange: { id: string } }
    await mockRequest("POST", `/expired-exchanges/${exchange.id}/exchanged`)
    const { exchanges } = (await mockRequest("GET", "/expired-exchanges")) as { exchanges: { id: string }[] }
    expect(exchanges.some((item) => item.id === exchange.id)).toBe(false)
  })

  it("bloquea lo que no se simula", async () => {
    await expect(mockRequest("POST", "/sales-reports/import", {})).rejects.toThrow(/modo de prueba/)
  })
})
