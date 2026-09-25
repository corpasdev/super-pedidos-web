import { InvalidPackSizeError } from "../errors/DomainErrors.js"

/** Objeto de valor: unidades por empaque (entero >= 1). */
export class PackSize {
  private constructor(private readonly unitsPerPack: number) {}

  static of(unitsPerPack: number): PackSize {
    if (!Number.isSafeInteger(unitsPerPack) || unitsPerPack < 1) {
      throw new InvalidPackSizeError(unitsPerPack)
    }
    return new PackSize(unitsPerPack)
  }

  get units(): number {
    return this.unitsPerPack
  }
}