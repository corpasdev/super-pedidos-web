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

/** Factura (pedido) que todavía tiene saldo por pagar. */
export interface PendingInvoice {
  readonly orderId: string
  /** YYYY-MM-DD del pedido. */
  readonly orderDay: string
  readonly totalCost: number
  readonly pendingAmount: number
}

/** Facturas con saldo de cada distribuidor, de la más vieja a la más reciente. */
export const pendingInvoicesBySupplier = (orders: readonly InboxOrder[]): ReadonlyMap<string, readonly PendingInvoice[]> =>
  [...orders]
    .filter((order) => order.pendingAmount > 0)
    .sort((left, right) => left.orderDay.localeCompare(right.orderDay))
    .reduce(
      (bySupplier, order) =>
        bySupplier.set(order.supplierId, [
          ...(bySupplier.get(order.supplierId) ?? []),
          { orderId: order.id, orderDay: order.orderDay, totalCost: order.totalCost, pendingAmount: order.pendingAmount },
        ]),
      new Map<string, PendingInvoice[]>(),
    )

/**
 * Plata de la caja que se aparta para pagar las facturas pendientes de los proveedores que vienen ese día
 * (regla del dueño: lo que se les debe se paga de la caja antes de repartirla en los sugeridos).
 * Solo cuentan los pedidos de días anteriores a hoy: los de hoy ya están descontados de la caja.
 */
export const debtReserveFor = (supplierIds: ReadonlySet<string>, today: string) => (orders: readonly InboxOrder[]): number =>
  orders
    .filter((order) => order.pendingAmount > 0 && order.orderDay < today && supplierIds.has(order.supplierId))
    .reduce((total, order) => total + order.pendingAmount, 0)

/** Lo que se le debe a cada distribuidor: Σ pendiente por pagar de sus pedidos. */
export const debtsBySupplier = (orders: readonly InboxOrder[]): ReadonlyMap<string, number> =>
  orders
    .filter((order) => order.pendingAmount > 0)
    // Acumulador local: la función sigue siendo pura.
    .reduce((totals, order) => totals.set(order.supplierId, (totals.get(order.supplierId) ?? 0) + order.pendingAmount), new Map<string, number>())
