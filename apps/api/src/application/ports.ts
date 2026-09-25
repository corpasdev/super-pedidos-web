import type { Brand } from "@agente-pedidos/order-agent"

/** Puertos de la capa de aplicación (no forman parte del dominio). */
export interface BrandRepository {
  listNamesByProductIds(storeId: string, productIds: string[]): Promise<Map<string, string>>
  findByNameAndSupplier(storeId: string, name: string, supplierId: string): Promise<Brand | null>
  create(storeId: string, name: string, supplierId: string): Promise<string>
  assignToProduct(storeId: string, productId: string, brandId: string): Promise<void>
}