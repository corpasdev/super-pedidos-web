import { InvalidMoneyError, NegativeMoneyResultError } from "../errors/DomainErrors.js"

/** Objeto de valor: cantidad de dinero en pesos colombianos enteros, siempre >= 0. */
export class Money {
  private constructor(private readonly amountInPesos: number) {}

  static fromPesos(amountInPesos: number): Money {
    if (!Number.isSafeInteger(amountInPesos) || amountInPesos < 0) {
      throw new InvalidMoneyError(amountInPesos)
    }
    return new Money(amountInPesos)
  }

  static zero(): Money {
    return new Money(0)
  }

  get pesos(): number {
    return this.amountInPesos
  }

  add(other: Money): Money {
    return Money.fromPesos(this.amountInPesos + other.amountInPesos)
  }

  subtract(other: Money): Money {
    if (other.amountInPesos > this.amountInPesos) {
      throw new NegativeMoneyResultError(this.amountInPesos, other.amountInPesos)
    }
    return Money.fromPesos(this.amountInPesos - other.amountInPesos)
  }

  multiplyByUnits(units: number): Money {
    if (!Number.isSafeInteger(units) || units < 0) {
      throw new InvalidMoneyError(this.amountInPesos * units)
    }
    return Money.fromPesos(this.amountInPesos * units)
  }

  isGreaterThan(other: Money): boolean {
    return this.amountInPesos > other.amountInPesos
  }
}