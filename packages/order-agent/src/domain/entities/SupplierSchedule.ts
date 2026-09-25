import { AnchorDateOnWrongWeekdayError, BiweeklyAnchorRequiredError } from "../errors/DomainErrors.js"
import { isoWeekdayOf } from "../../formulas/dateTime.js"
import { VisitFrequency, Weekday } from "../enums.js"

/**
 * Objeto de valor: calendario fijo del proveedor.
 * Invariante: si es quincenal, `biweeklyAnchorDate` es obligatoria y cae en `orderWeekday`.
 */
export class SupplierSchedule {
  constructor(
    readonly orderWeekday: Weekday,
    readonly deliveryWeekday: Weekday,
    readonly visitFrequency: VisitFrequency,
    readonly biweeklyAnchorDate: Date | null,
  ) {
    if (this.visitFrequency === VisitFrequency.Biweekly) {
      if (this.biweeklyAnchorDate === null) throw new BiweeklyAnchorRequiredError()
      const anchorDayName = Object.keys(Weekday).find((key) => Weekday[key as keyof typeof Weekday] === this.orderWeekday)
      if (isoWeekdayOf(this.biweeklyAnchorDate) !== this.orderWeekday) {
        throw new AnchorDateOnWrongWeekdayError(this.biweeklyAnchorDate.toISOString(), String(anchorDayName ?? this.orderWeekday))
      }
    }
  }
}