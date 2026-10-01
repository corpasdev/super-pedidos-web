import { describe, expect, it } from "vitest"
import { ExpiredExchangeNotFoundError, ExpiredExchangeService } from "../src/application/ExpiredExchangeService.js"
import type { SupabaseExpiredExchangeRepository } from "../src/infrastructure/supabase/repositories/SupabaseExpiredExchangeRepository.js"

const fakeRepository = () => {
  const created: { productId: string; supplierId: string | null; units: number }[] = []
  const repository = {
    supplierOfProduct: async (_storeId: string, productId: string) =>
      productId === "yogo" ? { exists: true, supplierId: "alpina" } : { exists: false, supplierId: null },
    create: async (_storeId: string, input: { productId: string; supplierId: string | null; units: number }) => {
      created.push(input)
      return { id: "x", productName: "", barcode: "", supplierName: null, createdAt: "", ...input }
    },
    markExchanged: async (_storeId: string, id: string) => id === "pendiente",
  } as unknown as SupabaseExpiredExchangeRepository
  return { service: new ExpiredExchangeService(repository), created }
}

describe("vencidos para cambio", () => {
  it("sin proveedor elegido, lo cambia el proveedor del producto", async () => {
    const { service, created } = fakeRepository()
    await service.add("store", { productId: "yogo", units: 3 })
    await service.add("store", { productId: "yogo", units: 1, supplierId: "otro" })
    expect(created).toEqual([
      { productId: "yogo", supplierId: "alpina", units: 3 },
      { productId: "yogo", supplierId: "otro", units: 1 },
    ])
  })

  it("no acepta productos de otra tienda ni marca dos veces el mismo cambio", async () => {
    const { service } = fakeRepository()
    await expect(service.add("store", { productId: "ajeno", units: 1 })).rejects.toThrow(ExpiredExchangeNotFoundError)
    await expect(service.markExchanged("store", "ya-cambiado")).rejects.toThrow(ExpiredExchangeNotFoundError)
    await expect(service.markExchanged("store", "pendiente")).resolves.toBeUndefined()
  })
})
