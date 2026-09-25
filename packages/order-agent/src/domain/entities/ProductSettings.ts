import type { CostSource } from "../enums.js"
import type { Money } from "../value-objects/Money.js"
import type { PackSize } from "../value-objects/PackSize.js"

export interface ProductSettingsProps {
  maxStockUnits: number | null
  unitCost: Money
  costSource: CostSource
  packSize: PackSize
  isEstimated: boolean
}

/** Objeto de valor: ajustes de un producto (costo, empaque, tope de stock). */
export class ProductSettings {
  constructor(
    readonly maxStockUnits: number | null,
    readonly unitCost: Money,
    readonly costSource: CostSource,
    readonly packSize: PackSize,
    readonly isEstimated: boolean,
  ) {}
}