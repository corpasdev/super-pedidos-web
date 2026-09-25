/** Lo que el dueño cambia en la tabla del historial: marcarlo saldado, o escribir cuánto queda pendiente. */
export type OrderPaymentChange = { settled: boolean } | { pendingAmount: number }

export interface OrderPayment {
  paidAmount: number
  pendingAmount: number
  isSettled: boolean
}

const clamp = (value: number, max: number): number => Math.min(Math.max(0, Math.round(value)), max)

/**
 * Pago de un pedido: pendiente = total − pagado; saldado cuando no queda nada pendiente.
 * - settled: true  → se pagó todo.
 * - settled: false → vuelve a quedar todo pendiente.
 * - pendingAmount  → pagado = total − pendiente (nunca negativo ni más que el total).
 */
export const applyOrderPayment = (totalCost: number, change: OrderPaymentChange): OrderPayment => {
  const total = Math.max(0, Math.round(totalCost))
  const paidAmount =
    "settled" in change ? (change.settled ? total : 0) : total - clamp(change.pendingAmount, total)
  return { paidAmount, pendingAmount: total - paidAmount, isSettled: paidAmount >= total }
}
