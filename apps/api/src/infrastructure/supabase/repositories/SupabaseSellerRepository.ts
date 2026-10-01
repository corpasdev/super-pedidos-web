import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"
import type { SellerVisit, VisitFrequencyValue } from "@agente-pedidos/order-agent"

type SellerRow = Database["public"]["Tables"]["supplier_sellers"]["Row"]

const toVisit = (row: SellerRow): SellerVisit => ({
  id: row.id,
  supplierId: row.supplier_id,
  sellerName: row.seller_name,
  orderWeekday: row.order_weekday,
  deliveryWeekday: row.delivery_weekday,
  visitFrequency: row.visit_frequency as VisitFrequencyValue,
  biweeklyAnchorDate: row.biweekly_anchor_date,
})

/** Vendedores del proveedor (una fila por visita semanal). */
export class SupabaseSellerRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listActive(storeId: string): Promise<SellerVisit[]> {
    const { data, error } = await this.supabase.from("supplier_sellers").select("*").eq("store_id", storeId).eq("is_active", true)
    if (error) throw error
    return (data ?? []).map(toVisit)
  }

  async findById(storeId: string, sellerId: string): Promise<SellerVisit | null> {
    const { data, error } = await this.supabase
      .from("supplier_sellers")
      .select("*")
      .eq("store_id", storeId)
      .eq("id", sellerId)
      .maybeSingle()
    if (error) throw error
    return data === null ? null : toVisit(data)
  }
}
