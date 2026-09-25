import type { TruckDelivery } from "@agente-pedidos/order-agent"
import type { SupabasePurchaseOrderRepository } from "../infrastructure/supabase/repositories/SupabasePurchaseOrderRepository.js"
import type { SupabaseInventoryMovementRepository } from "../infrastructure/supabase/repositories/SupabaseInventoryMovementRepository.js"

/** Caso de uso 6.5: "aterrizar" el pedido cuando llega el camión (suma al inventario y marca recibido). */
export class TruckDeliveryService {
  constructor(
    private readonly purchaseOrderRepository: SupabasePurchaseOrderRepository,
    private readonly inventoryMovementRepository: SupabaseInventoryMovementRepository,
  ) {}

  async finalize(storeId: string, purchaseOrderId: string): Promise<TruckDelivery> {
    const order = await this.purchaseOrderRepository.findById(storeId, purchaseOrderId)
    if (order === null) throw new Error(`El pedido ${purchaseOrderId} no existe en esta tienda.`)
    const delivery = order.markAsReceived(new Date())
    await this.purchaseOrderRepository.markAsReceived(storeId, purchaseOrderId)
    await this.inventoryMovementRepository.recordDelivery(storeId, delivery)
    return delivery
  }
}