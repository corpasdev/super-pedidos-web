import { describe, expect, it } from "vitest"
import { estimateUnitCost, isCandyCategory, markupRatioFor } from "../src/formulas/estimatedCost.js"

describe("estimateUnitCost", () => {
  it("dulcería: precio ÷ 1,30", () => {
    expect(estimateUnitCost(1_300, "dulceria")).toBe(1_000)
    expect(estimateUnitCost(500, "Dulcería")).toBe(385)
  })

  it("otras categorías: precio ÷ 1,20", () => {
    expect(estimateUnitCost(3_600, "abarrotes")).toBe(3_000)
    expect(estimateUnitCost(2_500, "CATEGORIA ESTANDAR")).toBe(2_083)
  })

  it("sin precio de venta no se puede estimar", () => {
    expect(estimateUnitCost(0, "aseo")).toBe(0)
  })

  it("reconoce dulcería con o sin tilde y en mayúsculas", () => {
    expect(isCandyCategory("DULCERIA")).toBe(true)
    expect(isCandyCategory("dulcería")).toBe(true)
    expect(markupRatioFor("bebidas")).toBe(0.2)
  })
})
