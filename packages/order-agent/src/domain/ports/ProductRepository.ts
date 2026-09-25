import type { Product } from "../entities/Product.js"
import type { Barcode } from "../value-objects/Barcode.js"

export interface ProductRepository {
  listBySupplier(storeId: string, supplierId: string): Promise<Product[]>
  findByBarcodes(storeId: string, barcodes: Barcode[]): Promise<Product[]>
  saveMany(storeId: string, products: Product[]): Promise<void>
}