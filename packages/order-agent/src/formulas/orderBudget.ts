export interface OrderBudgetSources {
  /** Lo que queda en caja hoy (efectivo al abrir − pedidos ya confirmados hoy). null = el dueño no escribió la caja. */
  remainingCash: number | null
  /** Tope por pedido del proveedor ($250.000 por defecto). null = sin tope. */
  maximumOrderAmount: number | null
  /** Límite que el dueño escribe a mano para este pedido. null = no escribió. */
  ownerBudget: number | null
}

/** Plata del pedido (B) = el menor de los límites conocidos; null si no hay ninguno (sin límite). */
export const calculateOrderBudget = (sources: OrderBudgetSources): number | null => {
  const knownLimits = [sources.remainingCash, sources.maximumOrderAmount, sources.ownerBudget]
    .filter((limit): limit is number => limit !== null)
    .map((limit) => Math.max(0, limit))
  return knownLimits.length === 0 ? null : Math.min(...knownLimits)
}

/** Caja que queda hoy = efectivo al abrir − lo ya pedido hoy (nunca negativa). */
export const calculateRemainingCash = (openingCash: number) => (spentToday: number) => Math.max(0, openingCash - spentToday)
