import { describe, expect, it } from "vitest"
import { allocateBudgetByCoverage, type AllocatableLine } from "../src/formulas/budgetAllocation.js"

const baseLine = (overrides: Partial<AllocatableLine>): AllocatableLine => ({
  productId: "product",
  barcode: "0000000000000",
  packSize: 6,
  unitCost: 1_000,
  unitsSold: 0,
  targetUnits: 12,
  stockToDiscount: 0,
  suggestedMaximumUnits: 12,
  allocatedUnits: 0,
  ...overrides,
})

describe("F9: reparto de la plata", () => {
  it("B suficiente → cada línea recibe su máximo", () => {
    const lines = allocateBudgetByCoverage(1_000_000)([
      baseLine({ productId: "a", suggestedMaximumUnits: 12 }),
      baseLine({ productId: "b", suggestedMaximumUnits: 6 }),
      baseLine({ productId: "c", suggestedMaximumUnits: 18 }),
    ])
    expect(lines.map((line) => line.allocatedUnits)).toEqual([12, 6, 18])
  })

  it("B corta: líneas con s = 0, 10, 6 y objetivos 12, 12, 24, e=6, B=$18.000 → total ≤ B; la de s=0 recibe; la de s=10 recibe 0", () => {
    const lines = [
      baseLine({ productId: "a", barcode: "0000000000001", targetUnits: 12, stockToDiscount: 0, unitsSold: 12, suggestedMaximumUnits: 12 }),
      baseLine({ productId: "b", barcode: "0000000000002", targetUnits: 12, stockToDiscount: 10, unitsSold: 12, suggestedMaximumUnits: 6 }),
      baseLine({ productId: "c", barcode: "0000000000003", targetUnits: 24, stockToDiscount: 6, unitsSold: 18, suggestedMaximumUnits: 18 }),
    ]
    const allocated = allocateBudgetByCoverage(18_000)(lines)
    const totalCost = allocated.reduce((sum, line) => sum + line.allocatedUnits * line.unitCost, 0)
    expect(totalCost).toBeLessThanOrEqual(18_000)

    const lineWithZeroStock = allocated.find((line) => line.productId === "a")
    const lineWithTenStock = allocated.find((line) => line.productId === "b")
    expect(lineWithZeroStock!.allocatedUnits).toBeGreaterThan(0)
    expect(lineWithTenStock!.allocatedUnits).toBe(0)
  })

  it("dos líneas (e=6, $1.000 y $1.500, objetivo 12, s=0), B=$9.000 → total > 0 y ≤ $9.000; siempre paquetes enteros", () => {
    const lines = [
      baseLine({ productId: "a", barcode: "0000000000001", unitCost: 1_000, targetUnits: 12, unitsSold: 12, suggestedMaximumUnits: 12 }),
      baseLine({ productId: "b", barcode: "0000000000002", unitCost: 1_500, targetUnits: 12, unitsSold: 12, suggestedMaximumUnits: 12 }),
    ]
    const allocated = allocateBudgetByCoverage(9_000)(lines)
    const totalCost = allocated.reduce((sum, line) => sum + line.allocatedUnits * line.unitCost, 0)
    expect(totalCost).toBeGreaterThan(0)
    expect(totalCost).toBeLessThanOrEqual(9_000)
    for (const line of allocated) {
      expect(line.allocatedUnits % line.packSize).toBe(0)
    }
  })

  it("empate por cobertura: gana la de mayor unitsSold, luego el barcode menor", () => {
    const lines = [
      baseLine({ productId: "b", barcode: "0000000000009", targetUnits: 12, unitsSold: 6, suggestedMaximumUnits: 12 }),
      baseLine({ productId: "a", barcode: "0000000000001", targetUnits: 12, unitsSold: 12, suggestedMaximumUnits: 12 }),
    ]
    const allocated = allocateBudgetByCoverage(6_000)(lines)
    expect(allocated.find((line) => line.productId === "a")!.allocatedUnits).toBe(6)
    expect(allocated.find((line) => line.productId === "b")!.allocatedUnits).toBe(0)
  })

  it("con cero plata ninguna línea recibe", () => {
    const lines = [baseLine({ productId: "a", suggestedMaximumUnits: 12 })]
    const allocated = allocateBudgetByCoverage(0)(lines)
    expect(allocated[0]!.allocatedUnits).toBe(0)
  })
})