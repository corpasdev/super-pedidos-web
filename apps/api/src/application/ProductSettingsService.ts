import { CostSource, Money, PackSize, levelsProblem } from "@agente-pedidos/order-agent"
import type { Product } from "@agente-pedidos/order-agent"
import type { SupabaseProductRepository } from "../infrastructure/supabase/repositories/SupabaseProductRepository.js"
import type { BrandRepository } from "./ports.js"

export interface UpdateProductSettingsInput {
  /** Tope (T). */
  maxStockUnits?: number | null
  /** Base (B). */
  minStockUnits?: number | null
  /** Punto de pedido (PD). */
  reorderPointUnits?: number | null
  unitCost?: number
  /** Precio de venta de la tienda. */
  salePrice?: number
  packSize?: number
  isEstimated?: boolean
  costSource?: "owner" | "sales_report" | "estimated"
  brandName?: string | null
}

/** Los niveles no cumplen 0 < B < PD < T. */
export class InvalidLevelsError extends Error {
  readonly code = "invalid_levels"
}

export interface UpdatedProduct {
  product: Product
  brandName: string | null
}

/** Caso de uso: el dueño corrige el producto (HU7): precios de compra y venta, empaque, niveles, marca, stock contado. */
export class ProductSettingsService {
  constructor(
    private readonly productRepository: SupabaseProductRepository,
    private readonly brandRepository: BrandRepository,
  ) {}

  async update(storeId: string, productId: string, changes: UpdateProductSettingsInput): Promise<UpdatedProduct> {
    const product = await this.productRepository.findById(storeId, productId)
    if (product === null) throw new Error(`El producto ${productId} no existe en esta tienda.`)

    const nextLevels = {
      base: changes.minStockUnits === undefined ? product.minStockUnits : changes.minStockUnits,
      reorderPoint: changes.reorderPointUnits === undefined ? product.reorderPointUnits : changes.reorderPointUnits,
      tope: changes.maxStockUnits === undefined ? product.maxStockUnits : changes.maxStockUnits,
    }
    const problem = levelsProblem(nextLevels)
    if (problem !== null) throw new InvalidLevelsError(problem)

    if (changes.salePrice !== undefined) product.changeSalePrice(Money.fromPesos(changes.salePrice))

    product.updateSettings({
      maxStockUnits: nextLevels.tope,
      minStockUnits: nextLevels.base,
      reorderPointUnits: nextLevels.reorderPoint,
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