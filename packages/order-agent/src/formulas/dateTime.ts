import type { Weekday } from "../domain/enums.js"

const MILLISECONDS_IN_DAY = 86_400_000

export const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

export const addDays = (days: number) => (date: Date) =>
  new Date(Math.round(startOfDay(date).getTime()) + days * MILLISECONDS_IN_DAY)

/** ISO 8601: 1 = lunes … 7 = domingo. `getDay()` devuelve 0 = domingo. */
export const isoWeekdayOf = (date: Date): Weekday => (date.getDay() === 0 ? 7 : date.getDay()) as Weekday

/** Días entre dos fechas (positivo si endDate es posterior). */
export const daysBetween = (startDate: Date) => (endDate: Date) =>
  Math.round((startOfDay(endDate).getTime() - startOfDay(startDate).getTime()) / MILLISECONDS_IN_DAY)