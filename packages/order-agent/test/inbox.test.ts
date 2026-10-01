import { describe, expect, it } from "vitest"
import {
  deliversSameDay,
  expectedDeliveryDay,
  isVisitingOnDay,
  isoWeekdayOfDay,
  visitsOnDay,
  type SellerVisit,
} from "../src/inbox/visits.js"
import { arrivalsDueOn, debtReserveFor, debtsBySupplier, orderOfSupplierOn, pendingInvoicesBySupplier, type InboxOrder } from "../src/inbox/ledger.js"

const visit = (overrides: Partial<SellerVisit> = {}): SellerVisit => ({
  id: "v",
  supplierId: "s",
  sellerName: "Juan",
  orderWeekday: 4,
  deliveryWeekday: 5,
  visitFrequency: "weekly",
  biweeklyAnchorDate: null,
  ...overrides,
})

const order = (overrides: Partial<InboxOrder> = {}): InboxOrder => ({
  id: "o",
  supplierId: "s",
  status: "confirmed",
  totalCost: 50_000,
  pendingAmount: 50_000,
  orderDay: "2026-09-24",
  expectedDeliveryDay: "2026-09-25",
  ...overrides,
})

describe("visitas de vendedores", () => {
  it("día de la semana ISO", () => {
    expect(isoWeekdayOfDay("2026-09-24")).toBe(4) // jueves
    expect(isoWeekdayOfDay("2026-09-27")).toBe(7) // domingo
  })

  it("viene los jueves; quincenal solo en la semana que toca", () => {
    expect(isVisitingOnDay("2026-09-24")(visit())).toBe(true)
    expect(isVisitingOnDay("2026-09-25")(visit())).toBe(false)
    const biweekly = visit({ visitFrequency: "biweekly", biweeklyAnchorDate: "2026-09-10" })
    expect(isVisitingOnDay("2026-09-24")(biweekly)).toBe(true)
    expect(isVisitingOnDay("2026-10-01")(biweekly)).toBe(false)
  })

  it("un vendedor con dos días aparece solo el día que corresponde", () => {
    const visits = [visit({ id: "lunes", orderWeekday: 1 }), visit({ id: "jueves", orderWeekday: 4 })]
    expect(visitsOnDay("2026-09-24")(visits).map((v) => v.id)).toEqual(["jueves"])
  })

  it("entrega el mismo día o días después", () => {
    expect(deliversSameDay(visit({ deliveryWeekday: 4 }))).toBe(true)
    expect(expectedDeliveryDay(visit({ deliveryWeekday: 4 }))("2026-09-24")).toBe("2026-09-24")
    expect(expectedDeliveryDay(visit())("2026-09-24")).toBe("2026-09-25")
    expect(expectedDeliveryDay(visit({ orderWeekday: 6, deliveryWeekday: 1 }))("2026-09-26")).toBe("2026-09-28")
  })
})

describe("bandeja: llegadas y deudas", () => {
  it("llegan hoy los pendientes con llegada hoy o atrasada", () => {
    const orders = [order({ id: "hoy", expectedDeliveryDay: "2026-09-25" }), order({ id: "atrasado", expectedDeliveryDay: "2026-09-23" }), order({ id: "mañana", expectedDeliveryDay: "2026-09-26" }), order({ id: "recibido", status: "received" })]
    expect(arrivalsDueOn("2026-09-25")(orders).map((o) => o.id)).toEqual(["hoy", "atrasado"])
  })

  it("pedido ya hecho hoy a un proveedor", () => {
    expect(orderOfSupplierOn("2026-09-24")("s")([order()])?.id).toBe("o")
    expect(orderOfSupplierOn("2026-09-25")("s")([order()])).toBeNull()
  })

  it("facturas con saldo por distribuidor, de la más vieja a la más reciente", () => {
    const invoices = pendingInvoicesBySupplier([
      order({ id: "nueva", supplierId: "a", orderDay: "2026-09-28", totalCost: 90_000, pendingAmount: 40_000 }),
      order({ id: "vieja", supplierId: "a", orderDay: "2026-09-21", totalCost: 120_000, pendingAmount: 120_000 }),
      order({ id: "pagada", supplierId: "a", orderDay: "2026-09-14", pendingAmount: 0 }),
    ])
    expect(invoices.get("a")?.map((invoice) => [invoice.orderId, invoice.pendingAmount])).toEqual([
      ["vieja", 120_000],
      ["nueva", 40_000],
    ])
  })

  it("aparta de la caja lo que se les debe a los que vienen (sin contar los pedidos de hoy)", () => {
    const orders = [
      order({ supplierId: "viene", orderDay: "2026-09-21", pendingAmount: 186_400 }),
      order({ supplierId: "viene", orderDay: "2026-09-28", pendingAmount: 82_750 }),
      order({ supplierId: "viene", orderDay: "2026-10-05", pendingAmount: 50_000 }),
      order({ supplierId: "no-viene", orderDay: "2026-09-24", pendingAmount: 25_988 }),
    ]
    expect(debtReserveFor(new Set(["viene"]), "2026-10-05")(orders)).toBe(269_150)
  })

  it("deuda por distribuidor", () => {
    const debts = debtsBySupplier([order({ supplierId: "a", pendingAmount: 10_000 }), order({ supplierId: "a", pendingAmount: 5_000 }), order({ supplierId: "b", pendingAmount: 0 })])
    expect(debts.get("a")).toBe(15_000)
    expect(debts.has("b")).toBe(false)
  })
})
