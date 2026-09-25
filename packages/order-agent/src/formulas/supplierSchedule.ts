import { modulo, subtract } from "../functional/arithmetic.js"
import { pipe } from "../functional/pipe.js"
import { addDays, daysBetween, isoWeekdayOf, startOfDay } from "./dateTime.js"
import type { SupplierSchedule } from "../domain/entities/SupplierSchedule.js"
import { VisitFrequency } from "../domain/enums.js"
import type { Weekday } from "../domain/enums.js"
import { DateRange } from "../domain/value-objects/DateRange.js"

const DAYS_IN_WEEK = 7
const DAYS_IN_BIWEEK = 14

/** F2-días: F = 7 si semanal, 14 si quincenal. */
export const calculateVisitFrequencyDays = (visitFrequency: VisitFrequency) =>
  visitFrequency === VisitFrequency.Weekly ? DAYS_IN_WEEK : DAYS_IN_BIWEEK

/** F0a: días entre el pedido y la entrega. Miércoles − martes = 1; mismo día = 0. */
export const calculateDeliveryLeadDays = (schedule: { orderWeekday: Weekday; deliveryWeekday: Weekday }) =>
  pipe(subtract(schedule.orderWeekday), modulo(DAYS_IN_WEEK))(schedule.deliveryWeekday)

/** Días que faltan desde `fromDate` hasta el próximo `targetWeekday` (0 si es hoy). */
export const daysUntilWeekday = (targetWeekday: Weekday) => (fromDate: Date) =>
  pipe(isoWeekdayOf, (currentWeekday: number) => targetWeekday - currentWeekday, modulo(DAYS_IN_WEEK))(fromDate)

/** F0b: próxima visita respetando la quincena (si cae en la semana que no toca, suma 7 días). */
export const calculateNextOrderDate = (schedule: SupplierSchedule) => (fromDate: Date) => {
  const nextWeekdayDate = addDays(daysUntilWeekday(schedule.orderWeekday)(fromDate))(startOfDay(fromDate))
  const isOffWeek = (date: Date) =>
    schedule.visitFrequency === VisitFrequency.Biweekly &&
    pipe(daysBetween(schedule.biweeklyAnchorDate!), modulo(DAYS_IN_BIWEEK))(date) !== 0
  return isOffWeek(nextWeekdayDate) ? addDays(DAYS_IN_WEEK)(nextWeekdayDate) : nextWeekdayDate
}

/** F0c: próxima entrega = próxima visita + días de entrega. */
export const calculateNextDeliveryDate = (schedule: SupplierSchedule) => (fromDate: Date) =>
  pipe(
    calculateNextOrderDate(schedule),
    addDays(calculateDeliveryLeadDays(schedule)),
  )(fromDate)

/** Última entrega (inicio sugerido del Excel de ventas) = próxima entrega − un ciclo. */
export const calculateLastDeliveryDate = (schedule: SupplierSchedule) => (fromDate: Date) =>
  pipe(
    calculateNextDeliveryDate(schedule),
    addDays(-calculateVisitFrequencyDays(schedule.visitFrequency)),
  )(fromDate)

/** F0d: rango sugerido del Excel: [última entrega, día anterior a la visita]. */
export const suggestSalesReportRange = (schedule: SupplierSchedule) => (visitDate: Date) =>
  new DateRange(calculateLastDeliveryDate(schedule)(visitDate), addDays(-1)(visitDate))

/** F1: días de cobertura = F + L. */
export const calculateCoverageDays = (schedule: SupplierSchedule) =>
  calculateVisitFrequencyDays(schedule.visitFrequency) + calculateDeliveryLeadDays(schedule)