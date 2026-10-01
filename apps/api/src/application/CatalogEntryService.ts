import { Barcode } from "@agente-pedidos/order-agent"
import type { SupabaseProductRepository } from "../infrastructure/supabase/repositories/SupabaseProductRepository.js"
import type { SupabaseSupplierRepository } from "../infrastructure/supabase/repositories/SupabaseSupplierRepository.js"

export interface CreateSupplierInput {
  name: string
  taxId?: string | null
  contactEmail?: string | null
  /** 1 = lunes … 7 = domingo. */
  orderWeekday: number
  deliveryWeekday: number
  visitFrequency: "weekly" | "biweekly"
  minimumOrderAmount: number
  maximumOrderAmount: number
}

/** Calendario con el que se crea el proveedor (y su visita en Sugeridos). */
export interface NewSupplierRow {
  name: string
  taxId: string | null
  contactEmail: string | null
  orderWeekday: number
  deliveryWeekday: number
  visitFrequency: "weekly" | "biweekly"
  /** Quincenal: la primera visita, que cae en el día de pedido. */
  biweeklyAnchorDate: string | null
  minimumOrderAmount: number
  maximumOrderAmount: number
}

/** Próxima fecha (desde hoy, incluido) que cae en ese día de la semana, como AAAA-MM-DD. */
export const nextDateOnWeekday = (today: Date, weekday: number): string => {
  const isoToday = ((today.getDay() + 6) % 7) + 1
  const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + ((weekday - isoToday + 7) % 7))
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export interface CreateProductInput {
  barcode: string
  name: string
  category: string
  supplierId?: string | null
  salePrice: number
  /** Sin precio de compra se estima con el recargo por categoría. */
  unitCost?: number | null
  stockUnits?: number
  /** Base (B). */
  minStockUnits?: number | null
  /** Tope (T). */
  maxStockUnits?: number | null
}

/** Ya existe un producto con ese código o un proveedor con ese nombre. */
export class DuplicateCatalogEntryError extends Error {
  readonly code = "duplicate_catalog_entry"
}

/** Base y tope no dejan espacio para el punto de pedido (oculto en la web). */
export class InvalidNewLevelsError extends Error {
  readonly code = "invalid_levels"
}

/**
 * El punto de pedido no se pide en la web: queda a mitad de camino entre la base y el tope.
 * Necesita al menos 2 unidades entre ambos para cumplir B < PD < T.
 */
export const reorderPointBetween = (base: number | null, tope: number | null): number | null => {
  if (base === null || tope === null) return null
  if (tope - base < 2) throw new InvalidNewLevelsError("Entre la base y el tope debe haber al menos 2 unidades.")
  return Math.floor((base + tope) / 2)
}

/** Caso de uso: el dueño registra a mano un proveedor o un producto nuevo (fuera del catálogo importado). */
export class CatalogEntryService {
  constructor(
    private readonly supplierRepository: SupabaseSupplierRepository,
    private readonly productRepository: SupabaseProductRepository,
  ) {}

  async createSupplier(storeId: string, input: CreateSupplierInput, today: Date = new Date()): Promise<string> {
    const name = input.name.trim().toUpperCase()
    if (await this.supplierRepository.existsByName(storeId, name)) {
      throw new DuplicateCatalogEntryError(`Ya existe un proveedor llamado ${name}.`)
    }
    return this.supplierRepository.create(storeId, {
      name,
      taxId: input.taxId?.trim() || null,
      contactEmail: input.contactEmail?.trim() || null,
      orderWeekday: input.orderWeekday,
      deliveryWeekday: input.deliveryWeekday,
      visitFrequency: input.visitFrequency,
      biweeklyAnchorDate: input.visitFrequency === "biweekly" ? nextDateOnWeekday(today, input.orderWeekday) : null,
      minimumOrderAmount: input.minimumOrderAmount,
      maximumOrderAmount: input.maximumOrderAmount,
    })
  }

  async createProduct(storeId: string, input: CreateProductInput): Promise<string> {
    const barcode = Barcode.parse(input.barcode).value
    if (await this.productRepository.existsByBarcode(storeId, barcode)) {
      throw new DuplicateCatalogEntryError(`Ya existe un producto con el código ${barcode}.`)
    }
    const base = input.minStockUnits ?? null
    const tope = input.maxStockUnits ?? null
    if (base !== null && tope !== null && base >= tope) throw new InvalidNewLevelsError("La base debe ser menor que el tope.")
    return this.productRepository.create(storeId, {
      barcode,
      name: input.name.trim(),
      category: input.category.trim(),
      supplierId: input.supplierId ?? null,
      salePrice: input.salePrice,
      unitCost: input.unitCost ?? null,
      stockUnits: input.stockUnits ?? 0,
      minStockUnits: base,
      reorderPointUnits: reorderPointBetween(base, tope),
      maxStockUnits: tope,
    })
  }
}
