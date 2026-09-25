import { describe, expect, it } from "vitest"
import {
  calculateCoverageDays,
  calculateDeliveryLeadDays,
  calculateLastDeliveryDate,
  calculateNextOrderDate,
  calculateVisitFrequencyDays,
  suggestSalesReportRange,
} from "../src/formulas/supplierSchedule.js"
import { daysBetween, isoWeekdayOf } from "../src/formulas/dateTime.js"
import { SupplierSchedule } from "../src/domain/entities/SupplierSchedule.js"
import { VisitFrequency, Weekday } from "../src/domain/enums.js"
import { Money } from "../src/domain/value-objects/Money.js"
import { Supplier } from "../src/domain/entities/Supplier.js"
import { SupplierSettings } from "../src/domain/entities/SupplierSettings.js"
import { DateRange } from "../src/domain/value-objects/DateRange.js"

const weeklyTuesdaysToWednesdays = () =>
  new SupplierSchedule(Weekday.Tuesday, Weekday.Wednesday, VisitFrequency.Weekly, null)

describe("F0a: días de entrega (deliveryLeadDays)", () => {
  it("pedido martes (2), entrega miércoles (3) → 1 día", () => {
    expect(calculateDeliveryLeadDays({ orderWeekday: Weekday.Tuesday, deliveryWeekday: Weekday.Wednesday })).toBe(1)
  })

  it("pedido sábado (6), entrega lunes (1) → 2 días", () => {
    expect(calculateDeliveryLeadDays({ orderWeekday: Weekday.Saturday, deliveryWeekday: Weekday.Monday })).toBe(2)
  })

  it("pedido y entrega el mismo día → 0 días", () => {
    expect(calculateDeliveryLeadDays({ orderWeekday: Weekday.Friday, deliveryWeekday: Weekday.Friday })).toBe(0)
  })
})

describe("F0b: próxima visita", () => {
  it("semanal los martes, hoy miércoles 2026-09-23 → martes 2026-09-29", () => {
    const schedule = weeklyTuesdaysToWednesdays()
    const nextOrderDate = calculateNextOrderDate(schedule)(new Date(2026, 8, 23))
    expect(nextOrderDate).toEqual(new Date(2026, 8, 29))
    expect(isoWeekdayOf(nextOrderDate)).toBe(Weekday.Tuesday)
  })

  it("quincenal los martes con referencia martes 2026-09-22, hoy 2026-09-23 → martes 2026-10-06 (la del 29 no toca)", () => {
    const schedule = new SupplierSchedule(
      Weekday.Tuesday,
      Weekday.Wednesday,
      VisitFrequency.Biweekly,
      new Date(2026, 8, 22),
    )
    const nextOrderDate = calculateNextOrderDate(schedule)(new Date(2026, 8, 23))
    expect(nextOrderDate).toEqual(new Date(2026, 9, 6))
  })
})

describe("F1: días de cobertura", () => {
  it("semanal con entrega al día siguiente → 7 + 1 = 8 días", () => {
    const schedule = weeklyTuesdaysToWednesdays()
    expect(calculateCoverageDays(schedule)).toBe(8)
  })

  it("visita quincenal 2 días después de la entrega → 14 + 2 = 16 días", () => {
    const schedule = new SupplierSchedule(
      Weekday.Monday,
      Weekday.Wednesday,
      VisitFrequency.Biweekly,
      new Date(2026, 8, 21),
    )
    expect(calculateVisitFrequencyDays(VisitFrequency.Biweekly)).toBe(14)
    expect(calculateCoverageDays(schedule)).toBe(16)
  })
})

describe("F0d: rango sugerido del Excel de ventas", () => {
  it("semanal, pide martes, entrega miércoles, visita martes 2026-09-29 → rango 2026-09-23 → 2026-09-28", () => {
    const schedule = weeklyTuesdaysToWednesdays()
    const range = suggestSalesReportRange(schedule)(new Date(2026, 8, 29))
    expect(range).toBeInstanceOf(DateRange)
    expect(range.startsAt).toEqual(new Date(2026, 8, 23))
    expect(range.endsAt).toEqual(new Date(2026, 8, 28))
    expect(range.coveredDays).toBe(6)
  })

  it("lastDeliveryDate con semanal es la entrega anterior al rango", () => {
    const schedule = weeklyTuesdaysToWednesdays()
    const lastDelivery = calculateLastDeliveryDate(schedule)(new Date(2026, 8, 29))
    expect(lastDelivery).toEqual(new Date(2026, 8, 23))
  })
})

describe("Supplier.isVisitingOn", () => {
  it("destaca que el proveedor viene hoy cuando su día de pedido es hoy", () => {
    const supplier = new Supplier(
      "supplier-1",
      "Distribuidora Andina",
      null,
      null,
      new SupplierSettings(weeklyTuesdaysToWednesdays(), Money.zero(), true),
    )
    expect(supplier.isVisitingOn(new Date(2026, 8, 29))).toBe(true)
    expect(supplier.isVisitingOn(new Date(2026, 8, 30))).toBe(false)
  })

  it("daysBetween cuenta días salvando la medianoche", () => {
    expect(daysBetween(new Date(2026, 8, 23))(new Date(2026, 8, 29))).toBe(6)
  })
})