import { InvalidDateRangeError } from "../errors/DomainErrors.js"
import { startOfDay } from "../../formulas/dateTime.js"

const MILLISECONDS_IN_DAY = 86_400_000

/** Objeto de valor: rango de fechas con startsAt <= endsAt. */
export class DateRange {
  constructor(readonly startsAt: Date, readonly endsAt: Date) {
    if (startsAt.getTime() > endsAt.getTime()) {
      throw new InvalidDateRangeError(startsAt, endsAt)
    }
  }

  /** Días calendario inclusivos: el 16 al 16 = 1 día. */
  get coveredDays(): number {
    const differenceInDays =
      (startOfDay(this.endsAt).getTime() - startOfDay(this.startsAt).getTime()) / MILLISECONDS_IN_DAY
    return Math.round(differenceInDays) + 1
  }
}