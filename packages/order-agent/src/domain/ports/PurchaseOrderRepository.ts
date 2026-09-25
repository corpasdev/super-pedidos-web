import type { PurchaseOrder } from "../entities/PurchaseOrder.js"

export interface PurchaseOrderRepository {
  save(storeId: string, order: PurchaseOrder): Promise<void>
  listRecent(storeId: string, limit: number): Promise<PurchaseOrder[]>
  findPendingBySupplier(storeId: string, supplierId: string): Promise<PurchaseOrder | null>
  markAsReceived(storeId: string, purchaseOrderId: string): Promise<void>
}