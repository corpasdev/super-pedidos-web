import { CostSource, Money, PackSize } from "@agente-pedidos/order-agent"
import type { Product } from "@agente-pedidos/order-agent"
import type { SupabaseProductRepository } from "../infrastructure/supabase/repositories/SupabaseProductRepository.js"
import type { BrandRepository } from "./ports.js"

export interface UpdateProductSettingsInput {
  maxStockUnits?: number | null
  unitCost?: number
  packSize?: number
  isEstimated?: boolean
  costSource?: "owner" | "sales_report" | "estimated"
  brandName?: string | null
}

export interface UpdatedProduct {
  product: Product
  brandName: string | null
}

/** Caso de uso: el dueño corrige el producto (HU7): empaque, costo, tope de stock, marca, stock contado. */
export class ProductSettingsService {
  constructor(
    private readonly productRepository: SupabaseProductRepository,
    private readonly brandRepository: BrandRepository,
  ) {}

  async update(storeId: string, productId: string, changes: UpdateProductSettingsInput): Promise<UpdatedProduct> {
    const product = await this.productRepository.findById(storeId, productId)
    if (product === null) throw new Error(`El producto ${productId} no existe en esta tienda.`)

    product.updateSettings({
      maxStockUnits: changes.maxStockUnits === undefined ? product.maxStockUnits : changes.maxStockUnits,
      unitCost: changes.unitCost === undefined ? product.unitCost : Money.fromPesos(changes.unitCost),
      costSource:
        changes.unitCost === undefined && changes.costSource === undefined
          ? product.costSource
          : ((changes.costSource ?? CostSource.Owner) as CostSource),
      packSize: changes.packSize === undefined ? product.packSize : PackSize.of(changes.packSize),
      isEstimated: changes.isEstimated,
    })

    let brandName: string | null = null
    if (changes.brandName !== undefined) {
      if (changes.brandName === null) {
        product.assignBrand("")
      } else {
        if (product.supplierId === "") {
          throw new Error("El producto no tiene proveedor, así que no se le puede asignar una marca. Primero arréglalo en el catálogo.")
        }
        const existing = await this.brandRepository.findByNameAndSupplier(storeId, changes.brandName, product.supplierId)
        const brandId = existing?.id ?? (await this.brandRepository.create(storeId, changes.brandName, product.supplierId))
        product.assignBrand(brandId)
        brandName = changes.brandName
      }
    }

    await this.productRepository.save(storeId, product)
    return { product, brandName }
  }

  /** El dueño hace conteo de stock (HU3): lo marca confiable. */
  async countStock(storeId: string, productId: string, units: number): Promise<void> {
    const product = await this.productRepository.findById(storeId, productId)
    if (product === null) throw new Error(`El producto ${productId} no existe en esta tienda.`)
    product.markStockAsCounted(units)
    await this.productRepository.save(storeId, product)
  }
}