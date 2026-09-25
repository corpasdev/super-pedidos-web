import { allocateBudgetByCoverage, type AllocatableLine } from "../../formulas/budgetAllocation.js"
import { calculateSuggestedMaximumUnits, selectSoldProducts, selectStockToDiscount } from "../../formulas/suggestedUnits.js"
import { calculateTargetUnits } from "../../formulas/targetUnits.js"
import { SupplierScheduleNotConfiguredError } from "../errors/DomainErrors.js"
import type { Supplier } from "../entities/Supplier.js"
import type { Product } from "../entities/Product.js"
import { OrderLine } from "../entities/OrderLine.js"
import { OrderSuggestion } from "../entities/OrderSuggestion.js"
import type { SalesReport } from "../entities/SalesReport.js"
import { ReplenishmentMode } from "../enums.js"
import type { Money } from "../value-objects/Money.js"

export const DEFAULT_SAFETY_MARGIN_RATIO = 0.1

export interface OrderSuggestionCalculatorInput {
  supplier: Supplier
  products: Product[]
  brandNamesByProductId: ReadonlyMap<string, string>
  salesReport: SalesReport | null
  availableBudget: Money
  replenishmentMode: ReplenishmentMode
  /** Solo se usa en `FillToTarget`. Por defecto 0.10. */
  safetyMarginRatio?: number
  /** Precio que dio el vendedor para ESTE pedido, por producto. Se usa en todo el cálculo, incluido el reparto (F9). */
  unitCostOverrides?: ReadonlyMap<string, Money>
}

/** Servicio de dominio sin estado: arma el pedido aplicando las fórmulas de la sección 6 en orden. */
export class OrderSuggestionCalculator {
  buildSuggestion(input: OrderSuggestionCalculatorInput): OrderSuggestion {
    if (!input.supplier.hasSchedule) throw new SupplierScheduleNotConfiguredError(input.supplier.name)
    const safetyMarginRatio = input.safetyMarginRatio ?? DEFAULT_SAFETY_MARGIN_RATIO
    const eligibleProducts =
      input.replenishmentMode === ReplenishmentMode.FillToBase
        ? selectProductsForBase(input.salesReport)(input.products)
        : filterEligibleForMode(input.replenishmentMode, selectSoldProducts(input.salesReport)(input.products))

    const buildLine = (product: Product): OrderLine => {
      const unitsSold = input.salesReport?.unitsSoldFor(product.barcode) ?? 0
      const targetUnits = calculateTargetUnits(
        input.replenishmentMode,
        {
          reportCoveredDays: input.salesReport?.reportCoveredDays ?? input.supplier.coverageDays,
          coverageDays: input.supplier.coverageDays,
          safetyMarginRatio,
          maxStockUnits: product.maxStockUnits,
        },
      )(unitsSold)
      const stockToDiscount = selectStockToDiscount(input.replenishmentMode, product.maxStockUnits)(product.stockUnits)
      const suggestedMaximumUnits = calculateSuggestedMaximumUnits(stockToDiscount, product.packSize.units)(targetUnits)
      const brandName = input.brandNamesByProductId.get(product.id) ?? "Otras marcas"
      const unitCostOverride = input.unitCostOverrides?.get(product.id) ?? null
      return new OrderLine(product, brandName, unitsSold, targetUnits, suggestedMaximumUnits, stockToDiscount, 0, null, unitCostOverride)
    }

    const lines = eligibleProducts.map(buildLine)
    const allocatedByProductId = new Map(
      allocateBudgetByCoverage(input.availableBudget.pesos)(lines.map(toAllocatableLine)).map((line) => [
        line.productId,
        line.allocatedUnits,
      ]),
    )
    const linesWithAllocation = lines.map((line) =>
      new OrderLine(
        line.product,
        line.brandName,
        line.unitsSold,
        line.targetUnits,
        line.suggestedMaximumUnits,
        line.stockToDiscount,
        allocatedByProductId.get(line.product.id) ?? 0,
        null,
        line.unitCostOverride,
      ),
    )
    return new OrderSuggestion(
      input.supplier,
      input.availableBudget,
      input.replenishmentMode,
      input.salesReport?.id ?? null,
      linesWithAllocation,
    )
  }
}

/**
 * `FillToBase`: entran los vendidos en el Excel y, aunque no se hayan vendido, los que tienen base
 * y les falta stock para cubrirla (el dueño pide aunque falten 1 o 2). El stock se usa aunque no esté contado:
 * el dueño revisa la existencia antes de calcular.
 */
const selectProductsForBase = (salesReport: SalesReport | null) => (products: Product[]): Product[] => {
  const soldProductIds = new Set(
    salesReport === null ? [] : selectSoldProducts(salesReport)(products).map((product) => product.id),
  )
  return products.filter(
    (product) =>
      soldProductIds.has(product.id) ||
      (product.maxStockUnits !== null && product.maxStockUnits > Math.max(0, product.stockUnits)),
  )
}

/** En `FillToTarget` los productos con stock no confiable (provisional) quedan fuera (sección 7.3). */
const filterEligibleForMode = (mode: ReplenishmentMode, products: Product[]): Product[] =>
  mode === ReplenishmentMode.FillToTarget
    ? products.filter((product) => product.isStockReliable || product.stockUnits === 0)
    : products

const toAllocatableLine = (line: OrderLine): AllocatableLine => ({
  productId: line.product.id,
  barcode: line.product.barcode.value,
  packSize: line.product.packSize.units,
  unitCost: line.unitCost.pesos,
  unitsSold: line.unitsSold,
  targetUnits: line.targetUnits,
  stockToDiscount: line.stockToDiscount,
  suggestedMaximumUnits: line.suggestedMaximumUnits,
  allocatedUnits: 0,
})