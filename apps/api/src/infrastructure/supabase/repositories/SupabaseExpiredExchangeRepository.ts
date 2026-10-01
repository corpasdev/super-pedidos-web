import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"

/** Un producto vencido separado para que el proveedor lo cambie. */
export interface ExpiredExchange {
  id: string
  productId: string
  productName: string
  barcode: string
  supplierId: string | null
  supplierName: string | null
  units: number
  createdAt: string
}

interface ExchangeRow {
  id: string
  product_id: string
  supplier_id: string | null
  units: number
  created_at: string
  products: { name: string; barcode: string } | null
  suppliers: { name: string } | null
}

const toExchange = (row: ExchangeRow): ExpiredExchange => ({
  id: row.id,
  productId: row.product_id,
  productName: row.products?.name ?? "",
  barcode: row.products?.barcode ?? "",
  supplierId: row.supplier_id,
  supplierName: row.suppliers?.name ?? null,
  units: row.units,
  createdAt: row.created_at,
})

const SELECT = "id, product_id, supplier_id, units, created_at, products(name, barcode), suppliers(name)"

export class SupabaseExpiredExchangeRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listPending(storeId: string): Promise<ExpiredExchange[]> {
    const { data, error } = await this.supabase
      .from("expired_exchanges")
      .select(SELECT)
      .eq("store_id", storeId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
    if (error) throw error
    return ((data ?? []) as unknown as ExchangeRow[]).map(toExchange)
  }

  /** Proveedor actual del producto (para proponerlo como quien hace el cambio). */
  async supplierOfProduct(storeId: string, productId: string): Promise<{ exists: boolean; supplierId: string | null }> {
    const { data, error } = await this.supabase.from("products").select("supplier_id").eq("store_id", storeId).eq("id", productId).maybeSingle()
    if (error) throw error
    return { exists: data !== null, supplierId: data?.supplier_id ?? null }
  }

  async create(storeId: string, input: { productId: string; supplierId: string | null; units: number }): Promise<ExpiredExchange> {
    const { data, error } = await this.supabase
      .from("expired_exchanges")
      .insert({ store_id: storeId, product_id: input.productId, supplier_id: input.supplierId, units: input.units })
      .select(SELECT)
      .single()
    if (error) throw error
    return toExchange(data as unknown as ExchangeRow)
  }

  /** true si había un cambio pendiente con ese id. */
  async markExchanged(storeId: string, exchangeId: string, at: Date): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("expired_exchanges")
      .update({ status: "exchanged", exchanged_at: at.toISOString() })
      .eq("store_id", storeId)
      .eq("id", exchangeId)
      .eq("status", "pending")
      .select("id")
    if (error) throw error
    return (data ?? []).length > 0
  }

  async remove(storeId: string, exchangeId: string): Promise<void> {
    const { error } = await this.supabase.from("expired_exchanges").delete().eq("store_id", storeId).eq("id", exchangeId)
    if (error) throw error
  }
}
