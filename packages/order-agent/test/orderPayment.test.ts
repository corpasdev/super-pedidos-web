import { describe, expect, it } from "vitest"
import { applyOrderPayment } from "../src/formulas/orderPayment.js"

describe("applyOrderPayment", () => {
  it("marcar saldado paga todo", () => {
    expect(applyOrderPayment(180_000, { settled: true })).toEqual({ paidAmount: 180_000, pendingAmount: 0, isSettled: true })
  })

  it("desmarcar saldado deja todo pendiente", () => {
    expect(applyOrderPayment(180_000, { settled: false })).toEqual({ paidAmount: 0, pendingAmount: 180_000, isSettled: false })
  })

  it("escribir lo pendiente calcula lo pagado", () => {
    expect(applyOrderPayment(180_000, { pendingAmount: 50_000 })).toEqual({ paidAmount: 130_000, pendingAmount: 50_000, isSettled: false })
  })

  it("pendiente en 0 queda saldado", () => {
    expect(applyOrderPayment(180_000, { pendingAmount: 0 }).isSettled).toBe(true)
  })

  it("el pendiente nunca pasa del total ni es negativo", () => {
    expect(applyOrderPayment(180_000, { pendingAmount: 999_999 })).toEqual({ paidAmount: 0, pendingAmount: 180_000, isSettled: false })
    expect(applyOrderPayment(180_000, { pendingAmount: -5 }).pendingAmount).toBe(0)
  })
})
