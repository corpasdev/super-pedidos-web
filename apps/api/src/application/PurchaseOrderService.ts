import { PurchaseOrder, PurchaseOrderConflictError } from "@agente-pedidos/order-agent"
import type { OrderSuggestion } from "@agente-pedidos/order-agent"
import type { SupabasePurchaseOrderRepository } from "../infrastructure/supabase/repositories/SupabasePurchaseOrderRepository.js"

/** Caso de uso 6.4: confirmar el pedido con el vendedor. */
export class PurchaseOrderService {
  constructor(private readonly purchaseOrderRepository: SupabasePurchaseOrderRepository) {}

  async confirm(storeId: string, suggestion: OrderSuggestion): Promise<PurchaseOrder> {
    const pending = await this.purchaseOrderRepository.findPendingBySupplier(storeId, suggestion.supplier.id)
    if (pending) throw new PurchaseOrderConflictError(suggestion.supplier.name)

    const order = new PurchaseOrder(
      crypto.randomUUID(),
      suggestion.supplier.id,
      new Date(),
      suggestion.lines
        .filter((line) => line.finalUnits > 0)
        // El costo guardado es el de ESTE pedido (el que dio el vendedor, o el del producto si no se escribió).
        .map((line) => ({ productId: line.product.id, units: line.finalUnits, unitCost: line.unitCost })),
      "confirmed",
      {
        availableBudget:
          suggestion.availableBudget.pesos === Number.MAX_SAFE_INTEGER
            ? null
            : suggestion.availableBudget,
        maximumOrderCost: suggestion.maximumOrderCost,
      },
    )
    await this.purchaseOrderRepository.save(storeId, order)
    return order
  }
}