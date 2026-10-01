/**
 * Visitas de los vendedores y entregas de los distribuidores — funciones puras.
 * Los días se manejan como texto YYYY-MM-DD (día de la tienda), sin depender de la zona horaria del servidor.
 */

export type VisitFrequencyValue = "weekly" | "biweekly"

/** Una visita semanal de un vendedor: el día que toma el pedido y el día que el distribuidor lo entrega. */
export interface SellerVisit {
  readonly id: string
  readonly supplierId: string
  readonly sellerName: string | null
  /** ISO: 1 = lunes … 7 = domingo. */
  readonly orderWeekday: number
  readonly deliveryWeekday: number
  readonly visitFrequency: VisitFrequencyValue
  /** Un día en que sí vino (quincenal). */
  readonly biweeklyAnchorDate: string | null
}

const DAY_MS = 86_400_000

const toUtcDate = (day: string): Date => new Date(`${day}T00:00:00Z`)

const toDay = (date: Date): string => date.toISOString().slice(0, 10)

/** ISO: 1 = lunes … 7 = domingo. */
export const isoWeekdayOfDay = (day: string): number => {
  const weekday = toUtcDate(day).getUTCDay()
  return weekday === 0 ? 7 : weekday
}

export const daysBetweenDays = (from: string) => (to: string): number =>
  Math.round((toUtcDate(to).getTime() - toUtcDate(from).getTime()) / DAY_MS)

export const addDaysToDay = (days: number) => (day: string): string => toDay(new Date(toUtcDate(day).getTime() + days * DAY_MS))

/** true si el vendedor viene ese día (respeta la quincena). */
export const isVisitingOnDay = (day: string) => (visit: SellerVisit): boolean => {
  if (isoWeekdayOfDay(day) !== visit.orderWeekday) return false
  if (visit.visitFrequency === "weekly" || visit.biweeklyAnchorDate === null) return true
  return ((daysBetweenDays(visit.biweeklyAnchorDate)(day) % 14) + 14) % 14 === 0
}

export const visitsOnDay = (day: string) => (visits: readonly SellerVisit[]): readonly SellerVisit[] =>
  visits.filter(isVisitingOnDay(day))

/** Entrega en el acto: el distribuidor trae la mercancía el mismo día del pedido (confirmar = recibir). */
export const deliversSameDay = (visit: SellerVisit): boolean => visit.orderWeekday === visit.deliveryWeekday

/** Días entre el pedido y la entrega: (entrega − pedido) mod 7. 0 = el mismo día. */
export const deliveryLeadDaysOf = (visit: SellerVisit): number => (((visit.deliveryWeekday - visit.orderWeekday) % 7) + 7) % 7

/** Día en que llega la mercancía de un pedido tomado en `orderDay`. */
export const expectedDeliveryDay = (visit: SellerVisit) => (orderDay: string): string =>
  addDaysToDay(deliveryLeadDaysOf(visit))(orderDay)
