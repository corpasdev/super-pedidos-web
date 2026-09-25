import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"
import type { Barcode, Product, ProductRepository } from "@agente-pedidos/order-agent"
import { productFromRows } from "../mappers.js"

type SettingsRow = Database["public"]["Tables"]["product_settings"]["Row"]

export interface ProductWithNames {
  product: Product
  brandName: string | null
  supplierName: string | null
}

export class SupabaseProductRepository implements ProductRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listBySupplier(storeId: string, supplierId: string): Promise<Product[]> {
    const { data: productRows, error } = await this.supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .eq("supplier_id", supplierId)
    if (error) throw error

    const settingsByProductId = await this.loadSettingsFor(storeId, (productRows ?? []).map((row) => row.id))
    return (productRows ?? []).map((row) => productFromRows(row, settingsByProductId.get(row.id) ?? null))
  }

  /**
   * Todos los productos de la tienda con su marca y su proveedor (vista Productos sin filtro).
   * Paginado de a 1.000 (límite de Supabase) y con los ajustes embebidos para no mandar miles de ids en la URL.
   */
  async listAllWithNames(storeId: string): Promise<ProductWithNames[]> {
    const PAGE = 1000
    const results: ProductWithNames[] = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await this.supabase
        .from("products")
        .select("*, product_settings(*), brands(name), suppliers(name)")
        .eq("store_id", storeId)
        .order("name")
        .range(from, from + PAGE - 1)
      if (error) throw error
      for (const row of data ?? []) {
        const embedded = row as unknown as {
          product_settings: SettingsRow | SettingsRow[] | null
          brands: { name: string } | null
          suppliers: { name: string } | null
        }
        const settings = Array.isArray(embedded.product_settings) ? (embedded.product_settings[0] ?? null) : embedded.product_settings
        results.push({
          product: productFromRows(row, settings),
          brandName: embedded.brands?.name ?? null,
          supplierName: embedded.suppliers?.name ?? null,
        })
      }
      if ((data ?? []).length < PAGE) break
    }
    return results
  }

  async findByBarcodes(storeId: string, barcodes: Barcode[]): Promise<Product[]> {
    if (barcodes.length === 0) return []
    const { data: productRows, error } = await this.supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .in("barcode", barcodes.map((barcode) => barcode.value))
    if (error) throw error

    const settingsByProductId = await this.loadSettingsFor(storeId, (productRows ?? []).map((row) => row.id))
    return (productRows ?? []).map((row) => productFromRows(row, settingsByProductId.get(row.id) ?? null))
  }

  async findById(storeId: string, productId: string): Promise<Product | null> {
    const { data: productRow, error } = await this.supabase
      .from("products")
      .select("*")
      .eq("store_id", storeId)
      .eq("id", productId)
      .maybeSingle()
    if (error) throw error
    if (!productRow) return null

    const settingsRows = await this.loadSettingsFor(storeId, [productRow.id])
    return productFromRows(productRow, settingsRows.get(productRow.id) ?? null)
  }

  async save(storeId: string, product: Product): Promise<void> {
    await this.saveMany(storeId, [product])
  }

  private async loadSettingsFor(storeId: string, productIds: string[]): Promise<Map<string, Database["public"]["Tables"]["product_settings"]["Row"]>> {
    const settingsByProductId = new Map<string, Database["public"]["Tables"]["product_settings"]["Row"]>()
    for (let start = 0; start < productIds.length; start += 100) {
      const chunk = productIds.slice(start, start + 100)
      if (chunk.length === 0) continue
      const { data: settingsRows, error } = await this.supabase
        .from("product_settings")
        .select("*")
        .eq("store_id", storeId)
        .in("product_id", chunk)
      if (error) throw error
      for (const settingsRow of settingsRows ?? []) settingsByProductId.set(settingsRow.product_id, settingsRow)
    }
    return settingsByProductId
  }

  async saveMany(storeId: string, products: Product[]): Promise<void> {
    for (const product of products) {
      const { error: productError } = await this.supabase
        .from("products")
        .update({
          stock_units: product.stockUnits,
          is_stock_reliable: product.isStockReliable,
          brand_id: product.brandIdentifier,
          updated_at: new Date().toISOString(),
        })
        .eq("store_id", storeId)
        .eq("id", product.id)
      if (productError) throw productError

      const { error: settingsError } = await this.supabase.from("product_settings").upsert({
        product_id: product.id,
        store_id: storeId,
        unit_cost: product.unitCost.pesos,
        cost_source: product.costSource,
        pack_size: product.packSize.units,
        max_stock_units: product.maxStockUnits,
        is_estimated: product.isEstimated,
        updated_at: new Date().toISOString(),
      })
      if (settingsError) throw settingsError
    }
  }
}