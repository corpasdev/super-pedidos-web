import { describe, expect, it } from "vitest"
import { levelsProblem, physicalStock, positionOf, stockStatusOf, unitsAboveBase } from "../src/suggestion/levels.js"
import { planSuggestion } from "../src/suggestion/plan.js"
import { movedUnitsSince } from "../src/suggestion/movedUnits.js"
import type { SuggestionItem } from "../src/suggestion/types.js"

const item = (overrides: Partial<SuggestionItem> & { productId: string }): SuggestionItem => ({
  barcode: overrides.productId,
  name: overrides.productId,
  category: "abarrotes",
  packSize: 1,
  unitCost: 1_000,
  levels: { base: 4, reorderPoint: 8, tope: 12 },
  movedUnits: 0,
  ...overrides,
})

describe("niveles: EA = PD − (B + CM)", () => {
  it("con signo, sin valor absoluto", () => {
    expect(unitsAboveBase(8, 4)(2)).toBe(2)
    expect(unitsAboveBase(8, 4)(4)).toBe(0)
    expect(unitsAboveBase(8, 4)(6)).toBe(-2)
  })

  it("estado según el signo", () => {
    expect(stockStatusOf(-2)).toBe("below_base")
    expect(stockStatusOf(0)).toBe("at_base")
    expect(stockStatusOf(3)).toBe("above_base")
  })

  it("existencia física = max(0, EA + B)", () => {
    expect(physicalStock(4)(-2)).toBe(2)
    expect(physicalStock(4)(-9)).toBe(0)
  })

  it("posición: faltantes a base y tope redondeados al empaque", () => {
    const position = positionOf(item({ productId: "a", movedUnits: 6, packSize: 6 }))
    expect(position.estimatedStock).toBe(2) // PD 8 − CM 6
    expect(position.unitsToBase).toBe(6) // faltan 2 → 1 empaque de 6
    expect(position.unitsToTope).toBe(12) // faltan 10 → 2 empaques
  })

  it("sin niveles: repone lo movido", () => {
    const position = positionOf(item({ productId: "a", movedUnits: 5, levels: { base: null, reorderPoint: null, tope: null } }))
    expect(position.status).toBe("no_levels")
    expect(position.unitsToBase).toBe(5)
    expect(position.unitsToTope).toBe(5)
  })

  it("valida 0 < B < PD < T", () => {
    expect(levelsProblem({ base: 4, reorderPoint: 8, tope: 12 })).toBeNull()
    expect(levelsProblem({ base: 8, reorderPoint: 8, tope: 12 })).toContain("base")
    expect(levelsProblem({ base: 4, reorderPoint: 12, tope: 12 })).toContain("tope")
  })
})

describe("planSuggestion: la plata decide el nivel", () => {
  // Dos productos: A vendió 6 (existencia 2, bajo la base), B vendió 3 (existencia 5, sobre la base).
  const items = [item({ productId: "a", movedUnits: 6 }), item({ productId: "b", movedUnits: 3 }), item({ productId: "c", movedUnits: 0 })]

  it("solo entran los productos que se movieron", () => {
    expect(planSuggestion(null)(items).lines.map((line) => line.productId)).toEqual(["a", "b"])
  })

  it("mucha plata: todo hasta el tope", () => {
    const plan = planSuggestion(1_000_000)(items)
    expect(plan.tier).toBe("tope")
    expect(plan.lines.map((line) => line.suggestedUnits)).toEqual([10, 7]) // 12−2, 12−5
    expect(plan.totalCost).toBe(17_000)
  })

  it("poca plata: primero la base, el más urgente primero", () => {
    const plan = planSuggestion(2_000)(items)
    // A necesita 2 para la base; B ya está sobre la base (necesita 0).
    expect(plan.lines.find((line) => line.productId === "a")!.suggestedUnits).toBe(2)
    expect(plan.tier).toBe("between_base_and_tope")
  })

  it("plata intermedia: base cubierta y hacia el tope hasta donde alcance", () => {
    const plan = planSuggestion(8_000)(items)
    expect(plan.totalCost).toBeLessThanOrEqual(8_000)
    expect(plan.lines.every((line) => line.reached === "base" || line.reached === "tope")).toBe(true)
    expect(plan.tier).toBe("between_base_and_tope")
  })

  it("no alcanza ni para la base de todos", () => {
    const plan = planSuggestion(1_000)(items)
    expect(plan.lines.find((line) => line.productId === "a")!.reached).toBe("partial")
    expect(plan.tier).toBe("below_base")
  })

  it("no alcanza ni un empaque", () => {
    expect(planSuggestion(500)(items).tier).toBe("not_even_one_pack")
  })

  it("determinista: mismos datos, mismo plan", () => {
    expect(planSuggestion(8_000)(items)).toEqual(planSuggestion(8_000)(items))
  })
})

describe("movedUnitsSince: CM desde la última entrega", () => {
  const sales = [
    { barcode: "a", soldOn: "2026-09-16", units: 3 },
    { barcode: "a", soldOn: "2026-09-20", units: 2 },
    { barcode: "b", soldOn: "2026-09-18", units: 4 },
  ]

  it("cuenta solo lo vendido después del día de la entrega", () => {
    const moved = movedUnitsSince(new Map([["a", "2026-09-18"]]))(sales)
    expect(moved.get("a")).toBe(2)
    expect(moved.get("b")).toBe(4) // sin entrega: todas sus ventas
  })
})
