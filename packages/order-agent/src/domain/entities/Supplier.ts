import {
  calculateCoverageDays,
  calculateDeliveryLeadDays,
  calculateLastDeliveryDate,
  calculateNextDeliveryDate,
  calculateNextOrderDate,
  calculateVisitFrequencyDays,
} from "../../formulas/supplierSchedule.js"
import { startOfDay } from "../../formulas/dateTime.js"
import type { SupplierSettings, SupplierSettingsProps } from "./SupplierSettings.js"
import { SupplierScheduleNotConfiguredError } from "../errors/DomainErrors.js"
import type { VisitFrequency } from "../enums.js"
import type { Weekday } from "../enums.js"
import type { Money } from "../value-objects/Money.js"
import type { SupplierSchedule } from "./SupplierSchedule.js"

/** Entidad: proveedor (el vendedor que pasa cada 8 o 15 días). */
export class Supplier {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly taxId: string | null,
    readonly contactEmail: string | null,
    private settings: SupplierSettings,
  ) {}

  get schedule(): SupplierSchedule | null {
    return this.settings.schedule
  }

  /** El calendario solo se puede usar después de que el dueño lo escriba (paso 1). */
  get hasSchedule(): boolean {
    return this.settings.schedule !== null
  }

  get orderWeekday(): Weekday | null {
    return this.settings.schedule?.orderWeekday ?? null
  }

  get deliveryWeekday(): Weekday | null {
    return this.settings.schedule?.deliveryWeekday ?? null
  }

  get visitFrequency(): VisitFrequency | null {
    return this.settings.schedule?.visitFrequency ?? null
  }

  /** 7 si semanal, 14 si quincenal. */
  get visitFrequencyDays(): number | null {
    return this.settings.schedule === null
      ? null
      : calculateVisitFrequencyDays(this.settings.schedule.visitFrequency)
  }

  /** Miércoles − martes = 1; mismo día = 0. */
  get deliveryLeadDays(): number | null {
    return this.settings.schedule === null ? null : calculateDeliveryLeadDays(this.settings.schedule)
  }

  nextOrderDate(fromDate: Date): Date {
    return calculateNextOrderDate(this.requireSchedule())(fromDate)
  }

  nextDeliveryDate(fromDate: Date): Date {
    return calculateNextDeliveryDate(this.requireSchedule())(fromDate)
  }

  lastDeliveryDate(fromDate: Date): Date {
    return calculateLastDeliveryDate(this.requireSchedule())(fromDate)
  }

  /** Para destacar "viene hoy" en el paso 1. */
  isVisitingOn(date: Date): boolean {
    if (this.settings.schedule === null) return false
    return startOfDay(this.nextOrderDate(startOfDay(date))).getTime() === startOfDay(date).getTime()
  }

  get minimumOrderAmount(): Money {
    return this.settings.minimumOrderAmount
  }

  get maximumOrderAmount(): Money | null {
    return this.settings.maximumOrderAmount
  }

  get coverageDays(): number {
    return calculateCoverageDays(this.requireSchedule())
  }

  get isEstimated(): boolean {
    return this.settings.isEstimated
  }

  updateSettings(changes: Partial<SupplierSettingsProps>): void {
    this.settings = {
      schedule: changes.schedule !== undefined ? changes.schedule : this.settings.schedule,
      minimumOrderAmount: changes.minimumOrderAmount ?? this.settings.minimumOrderAmount,
      isEstimated: changes.isEstimated ?? this.settings.isEstimated,
      maximumOrderAmount:
        changes.maximumOrderAmount !== undefined ? changes.maximumOrderAmount : this.settings.maximumOrderAmount,
    }
  }

  private requireSchedule(): SupplierSchedule {
    if (this.settings.schedule === null) throw new SupplierScheduleNotConfiguredError(this.name)
    return this.settings.schedule
  }
}