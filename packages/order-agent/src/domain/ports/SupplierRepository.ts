import type { Supplier } from "../entities/Supplier.js"

export interface SupplierDataSource {
  supplier: Supplier
  productCount: number
  lastOrderAt: Date | null
}

export interface SupplierRepository {
  listWithProductCount(storeId: string): Promise<SupplierDataSource[]>
  findById(storeId: string, supplierId: string): Promise<Supplier | null>
  save(storeId: string, supplier: Supplier): Promise<void>
}