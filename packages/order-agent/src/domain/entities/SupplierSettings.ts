import type { SupplierSchedule } from "./SupplierSchedule.js"
import type { Money } from "../value-objects/Money.js"

export interface SupplierSettingsProps {
  /** null = el dueño todavía no escribió el calendario (paso 1 lo pide antes del primer pedido). */
  schedule: SupplierSchedule | null
  minimumOrderAmount: Money
  isEstimated: boolean
  /** Tope de plata por pedido (regla del dueño: $250.000). null = sin tope. */
  maximumOrderAmount: Money | null
}

/** Objeto de valor: ajustes del proveedor. `minimumOrderAmount` 0 = no exige pedido mínimo. */
export class SupplierSettings {
  constructor(
    readonly schedule: SupplierSchedule | null,
    readonly minimumOrderAmount: Money,
    readonly isEstimated: boolean,
    readonly maximumOrderAmount: Money | null = null,
  ) {}
}