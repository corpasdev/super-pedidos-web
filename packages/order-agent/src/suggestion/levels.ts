import { roundUpToMultipleOf } from "../functional/arithmetic.js"
import type { ProductPosition, StockLevels, StockStatus, SuggestionItem } from "./types.js"

/** EA = PD − (B + CM). Puede ser negativa: NO usar valor absoluto. */
export const unitsAboveBase = (reorderPoint: number, base: number) => (movedUnits: number): number =>
  reorderPoint - (base + movedUnits)

export const stockStatusOf = (unitsAboveBaseValue: number): StockStatus =>
  unitsAboveBaseValue < 0 ? "below_base" : unitsAboveBaseValue === 0 ? "at_base" : "above_base"

/** Existencia física = max(0, EA + B). */
export const physicalStock = (base: number) => (unitsAboveBaseValue: number): number => Math.max(0, unitsAboveBaseValue + base)

type CompleteLevels = { readonly base: number; readonly reorderPoint: number; readonly tope: number }

export const hasCompleteLevels = (levels: StockLevels): levels is CompleteLevels =>
  levels.base !== null && levels.reorderPoint !== null && levels.tope !== null

/** 0 < B < PD < T. Devuelve el problema en palabras del dueño, o null si los niveles están bien. */
export const levelsProblem = (levels: StockLevels): string | null => {
  const { base, reorderPoint, tope } = levels
  if ([base, reorderPoint, tope].some((value) => value !== null && value < 0)) return "Los niveles no pueden ser negativos."
  if (base !== null && reorderPoint !== null && !(base < reorderPoint)) return "La base debe ser menor que el punto de pedido."
  if (reorderPoint !== null && tope !== null && !(reorderPoint < tope)) return "El punto de pedido debe ser menor que el tope."
  if (base !== null && tope !== null && !(base < tope)) return "La base debe ser menor que el tope."
  return null
}

/** Unidades que faltan para llegar a un nivel, redondeadas al empaque. */
const unitsToReach = (packSize: number, stock: number) => (level: number): number =>
  roundUpToMultipleOf(packSize)(Math.max(0, level - stock))

/**
 * Posición del producto. Con niveles: existencia = PD − CM, y lo que falta para base y tope.
 * Sin niveles (aún no configurados): se repone lo movido (CM) en las dos metas.
 */
export const positionOf = (item: SuggestionItem): ProductPosition => {
  const levels = item.levels
  if (!hasCompleteLevels(levels)) {
    const replenish = roundUpToMultipleOf(item.packSize)(item.movedUnits)
    return { ...item, unitsAboveBase: null, estimatedStock: null, status: "no_levels", unitsToBase: replenish, unitsToTope: replenish }
  }
  const ea = unitsAboveBase(levels.reorderPoint, levels.base)(item.movedUnits)
  const stock = physicalStock(levels.base)(ea)
  const toLevel = unitsToReach(item.packSize, stock)
  return {
    ...item,
    unitsAboveBase: ea,
    estimatedStock: stock,
    status: stockStatusOf(ea),
    unitsToBase: toLevel(levels.base),
    unitsToTope: Math.max(toLevel(levels.base), toLevel(levels.tope)),
  }
}

/** Entra al sugerido todo producto que se haya movido (CM > 0). */
export const hasMoved = (item: SuggestionItem): boolean => item.movedUnits > 0
