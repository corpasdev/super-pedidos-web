import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"
import { applyOrderPayment, type OrderPaymentChange } from "@agente-pedidos/order-agent"

export interface OrderPaymentState {
  orderId: string
  totalCost: number
  paidAmount: number
  pendingAmount: number
  isSettled: boolean
  paidAt: string | null
}

export class OrderNotFoundError extends Error {
  readonly code = "purchase_order_not_found"
}

/** Caso de uso: registrar cuánto se le ha pagado al proveedor por un pedido. El total sale siempre de la base. */
export class OrderPaymentService {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async update(storeId: string, orderId: string, change: OrderPaymentChange): Promise<OrderPaymentState> {
    const { data: order, error: readError } = await this.supabase
      .from("purchase_orders")
      .select("id, total_cost, paid_at")
      .eq("store_id", storeId)
      .eq("id", orderId)
      .maybeSingle()
    if (readError) throw readError
    if (order === null) throw new OrderNotFoundError("Ese pedido no existe en esta tienda.")

    const payment = applyOrderPayment(order.total_cost, change)
    const { data: updated, error: updateError } = await this.supabase
      .from("purchase_orders")
      .update({
        paid_amount: payment.paidAmount,
        paid_at: payment.isSettled ? (order.paid_at ?? new Date().toISOString()) : null,
      })
      .eq("store_id", storeId)
      .eq("id", orderId)
      .select("id, total_cost, paid_amount, pending_amount, is_settled, paid_at")
      .single()
    if (updateError) throw updateError

    return {
      orderId: updated.id,
      totalCost: updated.total_cost,
      paidAmount: updated.paid_amount,
      pendingAmount: updated.pending_amount,
      isSettled: updated.is_settled,
      paidAt: updated.paid_at,
    }
  }
}
