/** Pedido tal como lo necesita la bandeja (solo datos). */
export interface InboxOrder {
  readonly id: string
  readonly supplierId: string
  readonly status: "confirmed" | "received"
  readonly totalCost: number
  readonly pendingAmount: number
  /** YYYY-MM-DD en que se hizo el pedido. */
  readonly orderDay: string
  /** YYYY-MM-DD en que debe llegar; null en pedidos anteriores a este dato. */
  readonly expectedDeliveryDay: string | null
}

/** Pedidos por recibir cuya llegada es hoy o ya pasó (los atrasados también se muestran). */
export const arrivalsDueOn = (day: string) => (orders: readonly InboxOrder[]): readonly InboxOrder[] =>
  orders.filter((order) => order.status === "confirmed" && order.expectedDeliveryDay !== null && order.expectedDeliveryDay <= day)

/** Pedido que un proveedor ya tiene hecho ese día (para no sugerirle otro). */
export const orderOfSupplierOn = (day: string) => (supplierId: string) => (orders: readonly InboxOrder[]): InboxOrder | null =>
  orders.find((order) => order.supplierId === supplierId && order.orderDay === day) ?? null

/** Lo que se le debe a cada distribuidor: Σ pendiente por pagar de sus pedidos. */
export const debtsBySupplier = (orders: readonly InboxOrder[]): ReadonlyMap<string, number> =>
  orders
    .filter((order) => order.pendingAmount > 0)
    // Acumulador local: la función sigue siendo pura.
    .reduce((totals, order) => totals.set(order.supplierId, (totals.get(order.supplierId) ?? 0) + order.pendingAmount), new Map<string, number>())
