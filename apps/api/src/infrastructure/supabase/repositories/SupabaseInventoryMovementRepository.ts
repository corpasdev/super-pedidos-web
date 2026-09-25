import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"
import type { InventoryMovementRepository, TruckDelivery } from "@agente-pedidos/order-agent"

export class SupabaseInventoryMovementRepository implements InventoryMovementRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async recordDelivery(storeId: string, delivery: TruckDelivery): Promise<void> {
    const deliveryId = crypto.randomUUID()
    const { error: deliveryError } = await this.supabase.from("truck_deliveries").insert({
      id: deliveryId,
      store_id: storeId,
      purchase_order_id: delivery.purchaseOrderId,
      delivered_at: delivery.deliveredAt.toISOString(),
    })
    if (deliveryError) throw deliveryError

    const movements = [...delivery.receivedUnitsByProduct.entries()].map(([productId, unitsDelivered]) => ({
      store_id: storeId,
      product_id: productId,
      movement_type: "truck_delivery",
      units_delta: unitsDelivered,
      purchase_order_id: delivery.purchaseOrderId,
    }))
    if (movements.length === 0) return

    const { error: movementsError } = await this.supabase.from("inventory_movements").insert(movements)
    if (movementsError) throw movementsError

    for (const { product_id, units_delta } of movements) {
      const { data: current, error: readError } = await this.supabase
        .from("products")
        .select("stock_units")
        .eq("store_id", storeId)
        .eq("id", product_id)
        .maybeSingle()
      if (readError) throw readError
      if (!current) continue
      const { error: updateError } = await this.supabase
        .from("products")
        .update({
          stock_units: current.stock_units + units_delta,
          updated_at: new Date().toISOString(),
        })
        .eq("store_id", storeId)
        .eq("id", product_id)
      if (updateError) throw updateError
    }
  }
}