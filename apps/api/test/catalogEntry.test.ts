import { describe, expect, it } from "vitest"
import {
  CatalogEntryService,
  DuplicateCatalogEntryError,
  InvalidNewLevelsError,
  nextDateOnWeekday,
  reorderPointBetween,
} from "../src/application/CatalogEntryService.js"
import type { NewProductRow, SupabaseProductRepository } from "../src/infrastructure/supabase/repositories/SupabaseProductRepository.js"
import type { SupabaseSupplierRepository } from "../src/infrastructure/supabase/repositories/SupabaseSupplierRepository.js"

const fakeRepositories = (existing: { barcodes?: string[]; suppliers?: string[] } = {}) => {
  const created: { products: NewProductRow[]; suppliers: string[] } = { products: [], suppliers: [] }
  const productRepository = {
    existsByBarcode: async (_storeId: string, barcode: string) => (existing.barcodes ?? []).includes(barcode),
    create: async (_storeId: string, row: NewProductRow) => {
      created.products.push(row)
      return "new-product"
    },
  } as unknown as SupabaseProductRepository
  const supplierRepository = {
    existsByName: async (_storeId: string, name: string) => (existing.suppliers ?? []).includes(name),
    create: async (_storeId: string, input: { name: string }) => {
      created.suppliers.push(input.name)
      return "new-supplier"
    },
  } as unknown as SupabaseSupplierRepository
  return { service: new CatalogEntryService(supplierRepository, productRepository), created }
}

describe("crear productos y proveedores a mano", () => {
  it("el punto de pedido queda entre la base y el tope", () => {
    expect(reorderPointBetween(4, 16)).toBe(10)
    expect(reorderPointBetween(3, 5)).toBe(4)
    expect(reorderPointBetween(null, 10)).toBeNull()
    expect(() => reorderPointBetween(4, 5)).toThrow(InvalidNewLevelsError)
  })

  it("crea el producto con sus niveles y sin precio de compra lo deja estimado", async () => {
    const { service, created } = fakeRepositories()
    await service.createProduct("store", { barcode: "7702001047161", name: " Yogo ", category: "lacteos", salePrice: 4000, minStockUnits: 3, maxStockUnits: 12 })
    expect(created.products[0]).toMatchObject({ name: "Yogo", unitCost: null, minStockUnits: 3, reorderPointUnits: 7, maxStockUnits: 12, stockUnits: 0 })
  })

  it("no repite códigos de barras ni nombres de proveedor", async () => {
    const { service } = fakeRepositories({ barcodes: ["123456"], suppliers: ["POSTOBON"] })
    await expect(service.createProduct("store", { barcode: "123456", name: "x", category: "y", salePrice: 1 })).rejects.toThrow(DuplicateCatalogEntryError)
    const calendar = { orderWeekday: 1, deliveryWeekday: 3, visitFrequency: "weekly" as const, minimumOrderAmount: 20_000, maximumOrderAmount: 250_000 }
    await expect(service.createSupplier("store", { name: "postobon", ...calendar })).rejects.toThrow(DuplicateCatalogEntryError)
  })

  it("un proveedor quincenal arranca en el próximo día de pedido", () => {
    // 1-oct-2026 es jueves (4).
    const thursday = new Date(2026, 9, 1)
    expect(nextDateOnWeekday(thursday, 4)).toBe("2026-10-01")
    expect(nextDateOnWeekday(thursday, 1)).toBe("2026-10-05")
    expect(nextDateOnWeekday(thursday, 6)).toBe("2026-10-03")
  })
})
