import { describe, expect, it } from "vitest"
import { calculateOrderBudget, calculateRemainingCash } from "../src/formulas/orderBudget.js"

describe("calculateRemainingCash", () => {
  it("resta lo ya pedido hoy del efectivo al abrir", () => {
    expect(calculateRemainingCash(400_000)(150_000)).toBe(250_000)
  })

  it("nunca queda negativa", () => {
    expect(calculateRemainingCash(100_000)(180_000)).toBe(0)
  })
})

describe("calculateOrderBudget", () => {
  it("primer pedido del día: la caja supera el tope → B = $250.000", () => {
    expect(calculateOrderBudget({ remainingCash: 600_000, maximumOrderAmount: 250_000, ownerBudget: null })).toBe(250_000)
  })

  it("segundo pedido: sale de lo que quedó en caja", () => {
    expect(calculateOrderBudget({ remainingCash: 90_000, maximumOrderAmount: 250_000, ownerBudget: null })).toBe(90_000)
  })

  it("el límite del dueño gana si es el menor", () => {
    expect(calculateOrderBudget({ remainingCash: 300_000, maximumOrderAmount: 250_000, ownerBudget: 50_000 })).toBe(50_000)
  })

  it("sin caja ni tope ni límite → sin límite (null)", () => {
    expect(calculateOrderBudget({ remainingCash: null, maximumOrderAmount: null, ownerBudget: null })).toBeNull()
  })
})
