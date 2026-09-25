import { describe, expect, it } from "vitest"
import { add, capAt, clampToZero, divideBy, modulo, multiplyBy, ratioOf, roundUp, roundUpToMultipleOf, subtract, sumBy } from "../src/functional/arithmetic.js"
import { pipe } from "../src/functional/pipe.js"

describe("pipe", () => {
  it("aplica las funciones de izquierda a derecha", () => {
    const resultado = pipe(subtract(3), multiplyBy(2), add(1))(10)
    expect(resultado).toBe(15)
  })
})

describe("roundUpToMultipleOf", () => {
  it.each([
    [5, 12],
    [13, 24],
    [0, 0],
    [-4, 0],
  ])("redondea %i al múltiplo de 12 más cercano hacia arriba = %i", (value, expected) => {
    expect(roundUpToMultipleOf(12)(value)).toBe(expected)
  })
})

describe("primitivas", () => {
  it("divideBy evita dividir por cero devolviendo el dividendo", () => {
    expect(pipe(divideBy(0))(5)).toBe(5)
    expect(pipe(divideBy(4))(8)).toBe(2)
  })

  it("capAt limita solo cuando hay tope", () => {
    expect(capAt(12)(20)).toBe(12)
    expect(capAt(null)(20)).toBe(20)
  })

  it("ratioOf devuelve 1 cuando el denominador no es positivo", () => {
    expect(ratioOf(0)(4)).toBe(1)
    expect(ratioOf(4)(2)).toBe(0.5)
  })

  it("modulo siempre devuelve un valor positivo", () => {
    expect(modulo(7)(-5)).toBe(2)
    expect(modulo(7)(1)).toBe(1)
  })

  it("clampToZero no deja valores negativos", () => {
    expect(clampToZero(-3)).toBe(0)
    expect(clampToZero(0)).toBe(0)
    expect(clampToZero(9)).toBe(9)
  })

  it("sumBy suma la propiedad seleccionada", () => {
    expect(sumBy((item: { value: number }) => item.value)([{ value: 1 }, { value: 2 }, { value: 3 }])).toBe(6)
  })

  it("roundUp redondea hacia arriba con tolerancia de flotantes", () => {
    expect(roundUp(19.8)).toBe(20)
    expect(roundUp(20.0)).toBe(20)
    expect(roundUp(0)).toBe(0)
    expect(roundUp(-1)).toBe(0)
  })
})