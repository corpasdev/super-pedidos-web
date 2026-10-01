import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"
import type { PurchaseOrder, PurchaseOrderRepository } from "@agente-pedidos/order-agent"
import { purchaseOrderFromRows } from "../mappers.js"

export class SupabasePurchaseOrderRepository implements PurchaseOrderRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async save(
    storeId: string,
    order: PurchaseOrder,
    delivery: { sellerId: string | null; expectedDeliveryDay: string | null } = { sellerId: null, expectedDeliveryDay: null },
  ): Promise<void> {
    const { error: orderError } = await this.supabase.from("purchase_orders").insert({
      id: order.id,
      store_id: storeId,
      supplier_id: order.supplierId,
      status: order.status,
      available_budget: order.budget?.availableBudget?.pesos ?? null,
      maximum_order_cost: order.budget?.maximumOrderCost.pesos ?? Math.round(order.totalCost.pesos * 1.5),
      total_cost: order.totalCost.pesos,
      seller_id: delivery.sellerId,
      expected_delivery_date: delivery.expectedDeliveryDay,
    })
    if (orderError) throw orderError

    if (order.lines.length > 0) {
      const { error: linesError } = await this.supabase.from("purchase_order_lines").insert(
        order.lines.map((line) => ({
          purchase_order_id: order.id,
          store_id: storeId,
          product_id: line.productId,
          units: line.units,
          unit_cost: line.unitCost.pesos,
          was_adjusted_by_owner: false,
          // Copia de los niveles y la posición del producto al momento de pedir.
          min_stock_units: line.stockPosition?.levels.base ?? null,
          reorder_point_units: line.stockPosition?.levels.reorderPoint ?? null,
          max_stock_units: line.stockPosition?.levels.tope ?? null,
          moved_units: line.stockPosition?.movedUnits ?? null,
          estimated_stock: line.stockPosition?.estimatedStock ?? null,
          units_above_base: line.stockPosition?.unitsAboveBase ?? null,
        })),
      )
      if (linesError) throw linesError
    }
  }

  async listRecent(storeId: string, limit: number): Promise<PurchaseOrder[]> {
    const { data: orderRows, error } = await this.supabase
      .from("purchase_orders")
      .select("*")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(limit)
    if (error) throw error

    const orders: PurchaseOrder[] = []
    for (const orderRow of orderRows ?? []) {
      const lines = await this.loadLines(storeId, orderRow.id)
      orders.push(purchaseOrderFromRows(orderRow, lines))
    }
    return orders
  }

  async findById(storeId: string, purchaseOrderId: string): Promise<PurchaseOrder | null> {
    const { data, error } = await this.supabase
      .from("purchase_orders")
      .select("*")
      .eq("store_id", storeId)
      .eq("id", purchaseOrderId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    const lines = await this.loadLines(storeId, data.id)
    return purchaseOrderFromRows(data, lines)
  }

  async findPendingBySupplier(storeId: string, supplierId: string): Promise<PurchaseOrder | null> {
    const { data, error } = await this.supabase
      .from("purchase_orders")
      .select("*")
      .eq("store_id", storeId)
      .eq("supplier_id", supplierId)
      .eq("status", "confirmed")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    const lines = await this.loadLines(storeId, data.id)
    return purchaseOrderFromRows(data, lines)
  }

  async markAsReceived(storeId: string, purchaseOrderId: string): Promise<void> {
    const { error } = await this.supabase
      .from("purchase_orders")
      .update({ status: "received", received_at: new Date().toISOString() })
      .eq("store_id", storeId)
      .eq("id", purchaseOrderId)
    if (error) throw error
  }

  private async loadLines(storeId: string, purchaseOrderId: string): Promise<Database["public"]["Tables"]["purchase_order_lines"]["Row"][]> {
    const { data, error } = await this.supabase
      .from("purchase_order_lines")
      .select("*")
      .eq("store_id", storeId)
      .eq("purchase_order_id", purchaseOrderId)
    if (error) throw error
    return data ?? []
  }
}