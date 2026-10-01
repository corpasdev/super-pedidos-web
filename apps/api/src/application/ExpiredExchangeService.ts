import type {
  ExpiredExchange,
  SupabaseExpiredExchangeRepository,
} from "../infrastructure/supabase/repositories/SupabaseExpiredExchangeRepository.js"

/** El cambio pedido no existe o ya se hizo. */
export class ExpiredExchangeNotFoundError extends Error {
  readonly code = "expired_exchange_not_found"
}

/**
 * Caso de uso: vencidos para cambio. El dueño anota los productos vencidos y quedan pendientes
 * hasta que el proveedor los cambia en su visita.
 */
export class ExpiredExchangeService {
  constructor(private readonly repository: SupabaseExpiredExchangeRepository) {}

  listPending(storeId: string): Promise<ExpiredExchange[]> {
    return this.repository.listPending(storeId)
  }

  /** Sin proveedor elegido, el cambio queda a cargo del proveedor actual del producto. */
  async add(storeId: string, input: { productId: string; units: number; supplierId?: string | null }): Promise<ExpiredExchange> {
    const product = await this.repository.supplierOfProduct(storeId, input.productId)
    if (!product.exists) throw new ExpiredExchangeNotFoundError("Ese producto no existe en esta tienda.")
    return this.repository.create(storeId, {
      productId: input.productId,
      supplierId: input.supplierId ?? product.supplierId,
      units: input.units,
    })
  }

  async markExchanged(storeId: string, exchangeId: string, now: Date = new Date()): Promise<void> {
    const updated = await this.repository.markExchanged(storeId, exchangeId, now)
    if (!updated) throw new ExpiredExchangeNotFoundError("Ese cambio no está pendiente.")
  }

  remove(storeId: string, exchangeId: string): Promise<void> {
    return this.repository.remove(storeId, exchangeId)
  }
}
