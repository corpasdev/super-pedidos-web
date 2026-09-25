import { InvalidBarcodeError } from "../errors/DomainErrors.js"

/** Objeto de valor: código de barras normalizado (trim + sin espacios). */
export class Barcode {
  private constructor(private readonly normalizedValue: string) {}

  static parse(rawValue: string | number): Barcode {
    const normalized = String(rawValue).trim().replace(/\s+/g, "")
    if (normalized.length === 0) throw new InvalidBarcodeError(rawValue)
    return new Barcode(normalized)
  }

  get value(): string {
    return this.normalizedValue
  }

  equals(other: Barcode): boolean {
    return this.normalizedValue === other.normalizedValue
  }
}