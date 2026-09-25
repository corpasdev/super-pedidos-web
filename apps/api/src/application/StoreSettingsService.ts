import type { StoreDataSource, StoreRepository } from "@agente-pedidos/order-agent"

/** Caso de uso: el dueño nuevo crea su tienda (antes de importar el catálogo). */
export class StoreSettingsService {
  constructor(private readonly storeRepository: StoreRepository) {}

  async createForOwner(ownerUserId: string, name: string): Promise<StoreDataSource> {
    const existingId = await this.storeRepository.findStoreIdByOwner(ownerUserId)
    if (existingId !== null) {
      return { id: existingId, name }
    }
    const id = await this.storeRepository.createForOwner(ownerUserId, name)
    return { id, name }
  }

  async findForOwner(ownerUserId: string): Promise<StoreDataSource | null> {
    const storeId = await this.storeRepository.findStoreIdByOwner(ownerUserId)
    if (storeId === null) return null
    return this.storeRepository.findById(storeId)
  }
}