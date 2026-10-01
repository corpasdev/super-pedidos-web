/**
 * Módulo de sugerido de pedido — tipos inmutables.
 *
 * Glosario (modelo del dueño):
 *   B  = Base: inventario mínimo.            PD = Punto de pedido.            T = Tope: inventario máximo.
 *   CM = Cantidad movida: unidades vendidas desde la última entrega del producto (Excel de ventas).
 *   EA = Existencia sobre la base = PD − (B + CM). Con signo: < 0 = ya se consumió la base.
 * Relación: 0 < B < PD < T. Tras cada entrega el producto queda en su PD.
 */

export interface StockLevels {
  readonly base: number | null
  readonly reorderPoint: number | null
  readonly tope: number | null
}

/** Lo que el agente sabe de un producto antes de calcular. */
export interface SuggestionItem {
  readonly productId: string
  readonly barcode: string
  readonly name: string
  readonly category: string
  readonly packSize: number
  /** Costo unitario de este pedido (el del vendedor, el del Excel o el estimado). */
  readonly unitCost: number
  readonly levels: StockLevels
  /** CM. */
  readonly movedUnits: number
}

/**
 * below_base: EA < 0, se consumió la base (urgente) · at_base: EA = 0 · above_base: EA > 0
 * no_levels: el producto aún no tiene B/PD/T; se repone lo movido.
 */
export type StockStatus = "below_base" | "at_base" | "above_base" | "no_levels"

/** Posición del producto: dónde está su inventario y cuánto le falta para cada nivel. */
export interface ProductPosition extends SuggestionItem {
  /** EA con signo; null sin niveles. */
  readonly unitsAboveBase: number | null
  /** Existencia física estimada = max(0, EA + B) = PD − CM; null sin niveles. */
  readonly estimatedStock: number | null
  readonly status: StockStatus
  /** Unidades para llegar a la base, redondeadas al empaque. */
  readonly unitsToBase: number
  /** Unidades para llegar al tope, redondeadas al empaque (≥ unitsToBase). */
  readonly unitsToTope: number
}

/** Hasta qué nivel llegó la línea con la plata disponible. */
export type LevelReached = "tope" | "base" | "partial" | "none"

export interface SuggestedLine extends ProductPosition {
  readonly suggestedUnits: number
  readonly lineCost: number
  readonly reached: LevelReached
}

/**
 * Qué permitió la plata (regla del dueño):
 * tope: alcanzó para llevar todo al tope · between_base_and_tope: base cubierta, hacia el tope hasta donde alcanzó
 * below_base: ni siquiera alcanzó para cubrir la base de todos · not_even_one_pack · nothing_to_order
 */
export type BudgetTier = "tope" | "between_base_and_tope" | "below_base" | "not_even_one_pack" | "nothing_to_order"

export interface SuggestionPlan {
  readonly lines: readonly SuggestedLine[]
  /** null = sin límite de plata. */
  readonly budget: number | null
  readonly totalCost: number
  readonly remainingBudget: number | null
  readonly tier: BudgetTier
}
