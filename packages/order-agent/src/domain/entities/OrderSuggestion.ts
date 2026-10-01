import { sumBy } from "../../functional/arithmetic.js"
import { calculateFinalOrderCost, calculateMaximumOrderCost } from "../../formulas/orderCost.js"
import { resolveOrderStatus } from "../../formulas/orderStatus.js"
import type { OrderStatusExplanation, OrderStatusContext } from "../../formulas/orderStatus.js"
import type { Supplier } from "./Supplier.js"
import type { OrderLine } from "./OrderLine.js"
import type { OrderStatus } from "../enums.js"
import type { ReplenishmentMode } from "../enums.js"
import type { BudgetTier } from "../../suggestion/types.js"
import { Money } from "../value-objects/Money.js"

export interface OrderLineGroup {
  brandName: string
  lines: OrderLine[]
  subtotal: Money
}

/** Entidad: el pedido sugerido completo para un proveedor. */
export class OrderSuggestion {
  private readonly orderLines: readonly OrderLine[]

  constructor(
    readonly supplier: Supplier,
    readonly availableBudget: Money,
    readonly replenishmentMode: ReplenishmentMode,
    readonly salesReportId: string | null,
    lines: readonly OrderLine[],
    /** Modo de niveles: qué permitió la plata (tope, entre base y tope, bajo la base…). */
    readonly budgetTier: BudgetTier | null = null,
  ) {
    this.orderLines = [...lines]
  }

  get lines(): readonly OrderLine[] {
    return this.orderLines
  }

  get maximumOrderCost(): Money {
    return Money.fromPesos(calculateMaximumOrderCost(this.orderLines.map((line) => ({ maximumLineCost: line.maximumLineCost.pesos }))))
  }

  get allocatedOrderCost(): Money {
    return Money.fromPesos(sumBy((line: OrderLine) => line.allocatedLineCost.pesos)([...this.orderLines]))
  }

  get finalOrderCost(): Money {
    return Money.fromPesos(calculateFinalOrderCost(this.orderLines.map((line) => ({ finalLineCost: line.finalLineCost.pesos }))))
  }

  /** Lo que sobra de la plata. En `OverBudget` aparece 0 y el exceso se reporta en `statusExplanation.params.overBy`. */
  get remainingBudget(): Money {
    return Money.fromPesos(Math.max(0, this.availableBudget.pesos - this.finalOrderCost.pesos))
  }

  get status(): OrderStatus {
    return resolveOrderStatus(this.statusContext).status
  }

  get statusExplanation(): OrderStatusExplanation {
    return resolveOrderStatus(this.statusContext).explanation
  }

  linesGroupedByBrand(): OrderLineGroup[] {
    const groups = new Map<string, OrderLine[]>()
    for (const line of this.orderLines) {
      const groupForBrand = groups.get(line.brandName) ?? []
      groupForBrand.push(line)
      groups.set(line.brandName, groupForBrand)
    }
    return [...groups.entries()].map(([brandName, lines]) => ({
      brandName,
      lines,
      subtotal: Money.fromPesos(sumBy((line: OrderLine) => line.finalLineCost.pesos)(lines)),
    }))
  }

  withOwnerAdjustment(productId: string, packDelta: number): OrderSuggestion {
    const nextLines = this.orderLines.map((line) =>
      line.product.id === productId ? line.adjustByPacks(packDelta) : line,
    )
    return new OrderSuggestion(
      this.supplier,
      this.availableBudget,
      this.replenishmentMode,
      this.salesReportId,
      nextLines,
      this.budgetTier,
    )
  }

  /** Paso 5: fija las unidades finales del dueño. Nunca supera el máximo sugerido (R7) y se alinea al empaque (R5). */
  withOwnerUnits(productId: string, finalUnits: number): OrderSuggestion {
    const nextLines = this.orderLines.map((line) => {
      if (line.product.id !== productId) return line
      const packedUnits = Math.max(0, Math.min(finalUnits, line.suggestedMaximumUnits))
      const packAligned = Math.round(packedUnits / line.product.packSize.units) * line.product.packSize.units
      return line.withOwnerAdjustedUnits(Math.max(0, packAligned))
    })
    return new OrderSuggestion(
      this.supplier,
      this.availableBudget,
      this.replenishmentMode,
      this.salesReportId,
      nextLines,
      this.budgetTier,
    )
  }

  withoutOwnerAdjustments(): OrderSuggestion {
    return new OrderSuggestion(
      this.supplier,
      this.availableBudget,
      this.replenishmentMode,
      this.salesReportId,
      this.orderLines.map((line) => line.resetAdjustment()),
      this.budgetTier,
    )
  }

  /** Texto para WhatsApp / dictar: agrupado por marca, unidades y empaques (HU6). */
  toPlainText(): string {
    const supplierLines = `PEDIDO ${this.supplier.name.toUpperCase()}\n${this.statusExplanation.key}\n\n`
    const groupsText = this.linesGroupedByBrand()
      .map((group) => {
        const itemRows = group.lines
          .filter((line) => line.finalUnits > 0)
          .map((line) => {
            const packs = line.finalUnits / line.product.packSize.units
            return `- ${line.product.name}: ${line.finalUnits} u (${packs} ${packs === 1 ? "empaque" : "empaques"})`
          })
          .join("\n")
        return `${group.brandName}\n${itemRows}\nSubtotal: $${group.subtotal.pesos}`
      })
      .join("\n\n")
    return `${supplierLines}${groupsText}\n\nTOTAL: $${this.finalOrderCost.pesos}`
  }

  /** Líneas con costo estimado por categoría (no confirmado por el vendedor ni por el Excel). */
  get estimatedCostLineCount(): number {
    return this.orderLines.filter((line) => line.isCostEstimated).length
  }

  /** Líneas sin costo (ni precio de venta para estimarlo): suman $0 al total. */
  get noCostLineCount(): number {
    return this.orderLines.filter((line) => line.hasNoCost).length
  }

  private get statusContext(): OrderStatusContext {
    const minimumOrderAmountPesos = this.supplier.minimumOrderAmount.pesos
    return {
      lineCount: this.orderLines.length,
      finalOrderCost: this.finalOrderCost.pesos,
      availableBudget: this.availableBudget.pesos,
      maximumOrderCost: this.maximumOrderCost.pesos,
      minimumOrderAmount: minimumOrderAmountPesos,
      hasMinimumOrder: minimumOrderAmountPesos > 0,
      hasOwnerAdjustments: this.orderLines.some((line) => line.isAdjustedByOwner),
    }
  }
}