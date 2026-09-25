import { calculateCoverageRatio } from "../../formulas/budgetAllocation.js"
import type { Product } from "./Product.js"
import type { Money } from "../value-objects/Money.js"

/** De dónde sale el costo de la línea: escrito para este pedido, o el del producto (dueño, Excel o estimado). */
export type OrderLineCostSource = "order" | "owner" | "sales_report" | "estimated"

/** Línea del pedido sugerido. Las cantidades siempre son múltiplos de empaque (R5). */
export class OrderLine {
  constructor(
    readonly product: Product,
    readonly brandName: string,
    readonly unitsSold: number,
    readonly targetUnits: number,
    readonly suggestedMaximumUnits: number,
    /** F4: stock que se descuenta según el modo (0 en `ReplenishSold`, stock real en `FillToTarget`). */
    readonly stockToDiscount: number,
    private allocatedUnits: number,
    private ownerAdjustedUnits: number | null,
    /** Precio que dio el vendedor para ESTE pedido (el costo del proveedor varía; no se guarda en el producto). */
    readonly unitCostOverride: Money | null = null,
  ) {}

  /** Costo unitario efectivo: el de este pedido si el dueño lo escribió; si no, el del producto (R8). */
  get unitCost(): Money {
    return this.unitCostOverride ?? this.product.unitCost
  }

  get costSource(): OrderLineCostSource {
    return this.unitCostOverride !== null ? "order" : this.product.costSource
  }

  /** true si el costo es estimado por categoría (no viene del vendedor, del Excel ni del dueño). */
  get isCostEstimated(): boolean {
    return this.costSource === "estimated" && this.unitCost.pesos > 0
  }

  /** Sin costo conocido ni precio de venta para estimarlo: la línea suma $0 y hay que avisar. */
  get hasNoCost(): boolean {
    return this.unitCost.pesos === 0
  }

  get allocatedUnitsValue(): number {
    return this.allocatedUnits
  }

  get isCutByBudget(): boolean {
    return this.allocatedUnits < this.suggestedMaximumUnits
  }

  get isAdjustedByOwner(): boolean {
    return this.ownerAdjustedUnits !== null
  }

  /** ownerAdjustedUnits ?? allocatedUnits */
  get finalUnits(): number {
    return this.ownerAdjustedUnits ?? this.allocatedUnits
  }

  get maximumLineCost(): Money {
    return this.unitCost.multiplyByUnits(this.suggestedMaximumUnits)
  }

  get allocatedLineCost(): Money {
    return this.unitCost.multiplyByUnits(this.allocatedUnits)
  }

  get finalLineCost(): Money {
    return this.unitCost.multiplyByUnits(this.finalUnits)
  }

  /** F8: cobertura = (stock descontado + asignado) ÷ objetivo. */
  get coverageRatio(): number {
    return calculateCoverageRatio(this.stockToDiscount, this.targetUnits)(this.allocatedUnits)
  }

  /** Sube o baja de a un empaque (R9). Devuelve una instancia nueva, nunca negativa. */
  adjustByPacks(packDelta: number): OrderLine {
    const baseUnits = this.ownerAdjustedUnits ?? this.allocatedUnits
    return this.withOwnerAdjustedUnits(Math.max(0, baseUnits + packDelta * this.product.packSize.units))
  }

  resetAdjustment(): OrderLine {
    return this.withOwnerAdjustedUnits(null)
  }

  withOwnerAdjustedUnits(units: number | null): OrderLine {
    return new OrderLine(
      this.product,
      this.brandName,
      this.unitsSold,
      this.targetUnits,
      this.suggestedMaximumUnits,
      this.stockToDiscount,
      this.allocatedUnits,
      units,
      this.unitCostOverride,
    )
  }
}
