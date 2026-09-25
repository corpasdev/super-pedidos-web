/** Cada una de estas primitivas hace una sola cosa. Ver sección 6.2 de la especificación. */

export const divideBy = (divisor: number) => (dividend: number) => dividend / Math.max(divisor, 1)

export const multiplyBy = (factor: number) => (value: number) => value * factor

export const subtract = (subtrahend: number) => (minuend: number) => minuend - subtrahend

export const add = (addend: number) => (value: number) => value + addend

export const clampToZero = (value: number) => Math.max(0, value)

export const roundUp = (value: number) => Math.max(0, Math.ceil(value - 1e-9))

export const roundUpToMultipleOf =
  (multiple: number) =>
  (value: number): number =>
    value <= 0 ? 0 : Math.ceil(value / Math.max(multiple, 1) - 1e-9) * Math.max(multiple, 1)

export const capAt = (limit: number | null) => (value: number) =>
  limit === null ? value : Math.min(value, limit)

export const sumBy =
  <Item>(selectValue: (item: Item) => number) =>
  (items: Item[]): number =>
    items.reduce((total, item) => total + selectValue(item), 0)

export const ratioOf = (denominator: number) => (numerator: number) =>
  denominator > 0 ? numerator / denominator : 1

export const identity = <Value>(value: Value) => value

/** Módulo siempre positivo (F0a: (díaEntrega − díaPedido) mod 7). */
export const modulo = (divisor: number) => (value: number) => {
  const safeDivisor = Math.max(divisor, 1)
  return ((value % safeDivisor) + safeDivisor) % safeDivisor
}