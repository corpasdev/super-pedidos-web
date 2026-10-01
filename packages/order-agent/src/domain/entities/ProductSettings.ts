import type { CostSource } from "../enums.js"
import type { Money } from "../value-objects/Money.js"
import type { PackSize } from "../value-objects/PackSize.js"

export interface ProductSettingsProps {
  /** Tope (T): inventario máximo. */
  maxStockUnits: number | null
  unitCost: Money
  costSource: CostSource
  packSize: PackSize
  isEstimated: boolean
  /** Base (B): inventario mínimo. */
  minStockUnits: number | null
  /** Punto de pedido (PD). Tras cada entrega el producto queda en este nivel. */
  reorderPointUnits: number | null
}

/** Objeto de valor: ajustes de un producto (costo, empaque y niveles B < PD < T). */
export class ProductSettings {
  constructor(
    readonly maxStockUnits: number | null,
    readonly unitCost: Money,
    readonly costSource: CostSource,
    readonly packSize: PackSize,
    readonly isEstimated: boolean,
    readonly minStockUnits: number | null = null,
    readonly reorderPointUnits: number | null = null,
  ) {}
}
