import { describe, expect, it } from "vitest"
import { calculateFillToTargetUnits, calculateTargetUnits } from "../src/formulas/targetUnits.js"
import { calculateSuggestedMaximumUnits, selectStockToDiscount } from "../src/formulas/suggestedUnits.js"
import { ReplenishmentMode } from "../src/domain/enums.js"

const fillToTargetParameters = (overrides: Partial<{ reportCoveredDays: number; coverageDays: number; safetyMarginRatio: number; maxStockUnits: number | null }> = {}) => ({
  reportCoveredDays: 8,
  coverageDays: 9,
  safetyMarginRatio: 0.1,
  maxStockUnits: null,
  ...overrides,
})

describe("F3b: objetivo en modo FillToTarget", () => {
  it("v=16, d=8, F+L=9, m=0.10, T=null → 20 (2/día × 9 × 1,1 = 19,8 → 20)", () => {
    expect(calculateFillToTargetUnits(fillToTargetParameters())(16)).toBe(20)
  })

  it("igual pero con tope T=12 → 12", () => {
    expect(calculateFillToTargetUnits(fillToTargetParameters({ maxStockUnits: 12 }))(16)).toBe(12)
  })

  it("sin ventas el objetivo es 0", () => {
    expect(calculateFillToTargetUnits(fillToTargetParameters())(0)).toBe(0)
  })
})

describe("F3a: objetivo en modo ReplenishSold", () => {
  it("es exactamente lo vendido (v)", () => {
    const targetFor = calculateTargetUnits(ReplenishmentMode.ReplenishSold, fillToTargetParameters())
    expect(targetFor(7)).toBe(7)
    expect(targetFor(133)).toBe(133)
  })
})

describe("F4: stock que se descuenta", () => {
  it("ReplenishSold → 0 aunque el producto tenga stock", () => {
    expect(selectStockToDiscount(ReplenishmentMode.ReplenishSold)(50)).toBe(0)
  })

  it("FillToTarget → el stock actual", () => {
    expect(selectStockToDiscount(ReplenishmentMode.FillToTarget)(50)).toBe(50)
  })
})

describe("F5: máximo sugerido por producto", () => {
  it("F3a + F5 en ReplenishSold: v=7, s=50, e=1 → 7 (el stock no se descuenta)", () => {
    const suggestedMaximumUnits = calculateSuggestedMaximumUnits(selectStockToDiscount(ReplenishmentMode.ReplenishSold)(50), 1)(7)
    expect(suggestedMaximumUnits).toBe(7)
  })

  it("FillToTarget: objetivo=24, s=4, e=6 → 24 (falta 20 → 24)", () => {
    expect(calculateSuggestedMaximumUnits(4, 6)(24)).toBe(24)
  })

  it("FillToTarget: objetivo=24, s=30, e=6 → 0", () => {
    expect(calculateSuggestedMaximumUnits(30, 6)(24)).toBe(0)
  })

  it("siempre múltiplo de empaque", () => {
    expect(calculateSuggestedMaximumUnits(0, 6)(5)).toBe(6)
    expect(calculateSuggestedMaximumUnits(0, 6)(12)).toBe(12)
    expect(calculateSuggestedMaximumUnits(1, 6)(12)).toBe(12)
    expect(calculateSuggestedMaximumUnits(7, 6)(12)).toBe(6)
  })
})