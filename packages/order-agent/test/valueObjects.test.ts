import { describe, expect, it } from "vitest"
import { Money } from "../src/domain/value-objects/Money.js"
import { PackSize } from "../src/domain/value-objects/PackSize.js"
import { Barcode } from "../src/domain/value-objects/Barcode.js"
import { DateRange } from "../src/domain/value-objects/DateRange.js"
import {
  InvalidBarcodeError,
  InvalidMoneyError,
  InvalidPackSizeError,
  NegativeMoneyResultError,
} from "../src/domain/errors/DomainErrors.js"

describe("Money", () => {
  it("solo acepta enteros mayores o iguales a 0", () => {
    expect(Money.fromPesos(0).pesos).toBe(0)
    expect(Money.fromPesos(1_500).pesos).toBe(1_500)
    expect(() => Money.fromPesos(-1)).toThrow(InvalidMoneyError)
    expect(() => Money.fromPesos(1.5)).toThrow(InvalidMoneyError)
    expect(Money.zero().pesos).toBe(0)
  })

  it("suma, resta y multiplica sin pasar de cero", () => {
    const a = Money.fromPesos(10_000)
    const b = Money.fromPesos(2_500)
    expect(a.add(b).pesos).toBe(12_500)
    expect(a.subtract(b).pesos).toBe(7_500)
    expect(a.multiplyByUnits(3).pesos).toBe(30_000)
    expect(a.isGreaterThan(b)).toBe(true)
  })

  it("restar más de lo que hay lanza NegativeMoneyResultError", () => {
    expect(() => Money.fromPesos(100).subtract(Money.fromPesos(200))).toThrow(NegativeMoneyResultError)
  })
})

describe("PackSize", () => {
  it("solo acepta enteros mayores o iguales a 1", () => {
    expect(PackSize.of(6).units).toBe(6)
    expect(() => PackSize.of(0)).toThrow(InvalidPackSizeError)
    expect(() => PackSize.of(1.5)).toThrow(InvalidPackSizeError)
  })
})

describe("Barcode", () => {
  it("normaliza quitando espacios", () => {
    const barcode = Barcode.parse(" 7702020111645 ")
    expect(barcode.value).toBe("7702020111645")
    expect(barcode.equals(Barcode.parse("7702020111645"))).toBe(true)
    expect(barcode.equals(Barcode.parse("111"))).toBe(false)
    expect(Barcode.parse(7702020111645).value).toBe("7702020111645")
  })

  it("rechaza códigos vacíos", () => {
    expect(() => Barcode.parse("   ")).toThrow(InvalidBarcodeError)
  })
})

describe("DateRange", () => {
  it("cuenta los días calendario inclusivos", () => {
    const rango = new DateRange(new Date(2026, 8, 16), new Date(2026, 8, 16))
    expect(rango.coveredDays).toBe(1)
    const otra = new DateRange(new Date(2026, 8, 10), new Date(2026, 8, 15))
    expect(otra.coveredDays).toBe(6)
  })

  it("valida que el inicio sea antes del fin", () => {
    expect(() => new DateRange(new Date(2026, 8, 20), new Date(2026, 8, 10))).toThrow()
  })
})