import { sumBy } from "../../functional/arithmetic.js"
import { TruckDelivery } from "./TruckDelivery.js"
import { Money } from "../value-objects/Money.js"

export interface PurchaseOrderLine {
  productId: string
  units: number
  unitCost: Money
}

export interface PurchaseOrderBudget {
  availableBudget: Money | null
  maximumOrderCost: Money
}

const parseStatus = (status: "confirmed" | "received"): "confirmed" | "received" => {
  if (status !== "confirmed" && status !== "received") throw new Error(`Estado inválido de pedido: ${status}`)
  return status
}

/** Entidad: pedido confirmado con el vendedor. */
export class PurchaseOrder {
  private currentStatus: "confirmed" | "received"

  constructor(
    readonly id: string,
    readonly supplierId: string,
    readonly createdAt: Date,
    readonly lines: ReadonlyArray<PurchaseOrderLine>,
    status: "confirmed" | "received",
    readonly budget: PurchaseOrderBudget | null = null,
  ) {
    this.currentStatus = parseStatus(status)
  }

  get status(): "confirmed" | "received" {
    return this.currentStatus
  }

  get totalCost(): Money {
    return Money.fromPesos(sumBy((line: PurchaseOrderLine) => line.unitCost.pesos * line.units)([...this.lines]))
  }

  markAsReceived(deliveredAt: Date): TruckDelivery {
    this.currentStatus = "received"
    return new TruckDelivery(
      this.id,
      deliveredAt,
      new Map(this.lines.map((line) => [line.productId, line.units])),
    )
  }
}