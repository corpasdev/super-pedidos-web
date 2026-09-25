import { clampToZero, roundUpToMultipleOf, subtract } from "../functional/arithmetic.js"
import { pipe } from "../functional/pipe.js"
import { ReplenishmentMode } from "../domain/enums.js"
import type { SalesReport } from "../domain/entities/SalesReport.js"
import type { Product } from "../domain/entities/Product.js"

/**
 * F4: stock que se descuenta. `ReplenishSold` → 0 (el stock es provisional); `FillToTarget` → stock actual;
 * `FillToBase` → stock actual si el producto tiene base, 0 si no (se repone lo vendido).
 */
export const selectStockToDiscount = (mode: ReplenishmentMode, maxStockUnits: number | null = null) => (stockUnits: number) => {
  if (mode === ReplenishmentMode.ReplenishSold) return 0
  if (mode === ReplenishmentMode.FillToBase) return maxStockUnits === null ? 0 : Math.max(0, stockUnits)
  return stockUnits
}

/** F5: máximo sugerido por producto = ceil(max(0, objetivo − stock) ÷ e) × e. Múltiplo de empaque. */
export const calculateSuggestedMaximumUnits = (stockToDiscount: number, packSize: number) =>
  pipe(subtract(stockToDiscount), clampToZero, roundUpToMultipleOf(packSize))

/** R1: con Excel cargado solo se sugieren productos vendidos en él. */
export const hasUnitsSold = (unitsSold: number) => unitsSold > 0

export const selectSoldProducts = (salesReport: SalesReport | null) => (products: Product[]): Product[] =>
  salesReport === null ? products : products.filter((product) => hasUnitsSold(salesReport.unitsSoldFor(product.barcode)))