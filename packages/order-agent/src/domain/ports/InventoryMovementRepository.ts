import type { TruckDelivery } from "../entities/TruckDelivery.js"

export interface InventoryMovementRepository {
  recordDelivery(storeId: string, delivery: TruckDelivery): Promise<void>
}