import { ref } from "vue"
import { defineStore } from "pinia"
import { apiClient } from "../infrastructure/apiClient"
import type {
  OrderDetailItem,
  OrderListItem,
  OrderPaymentChange,
  OrderPaymentItem,
  ProductItem,
} from "../infrastructure/apiTypes"

export const useHistoryStore = defineStore("history", () => {
  const orders = ref<OrderListItem[]>([])
  const ordersLoading = ref(false)
  const error = ref<string | null>(null)

  const detail = ref<OrderDetailItem | null>(null)
  const detailProducts = ref<Record<string, { name: string; barcode: string }>>({})
  const detailLoading = ref(false)

  async function loadOrders(): Promise<void> {
    ordersLoading.value = true
    error.value = null
    try {
      const response = await apiClient.get<{ orders: OrderListItem[] }>("/purchase-orders")
      orders.value = response.orders
    } catch (err) {
      error.value = err instanceof Error ? err.message : "No se pudieron cargar los pedidos."
    } finally {
      ordersLoading.value = false
    }
  }

  async function openDetail(orderId: string, supplierId: string): Promise<void> {
    detailLoading.value = true
    error.value = null
    try {
      const [orderResponse, productsResponse] = await Promise.all([
        apiClient.get<{ order: OrderDetailItem }>(`/purchase-orders/${orderId}`),
        apiClient.get<{ products: ProductItem[] }>(`/suppliers/${supplierId}/products`),
      ])
      detail.value = orderResponse.order
      detailProducts.value = Object.fromEntries(
        productsResponse.products.map((p) => [p.id, { name: p.name, barcode: p.barcode }]),
      )
    } catch (err) {
      error.value = err instanceof Error ? err.message : "No se pudo abrir el detalle."
    } finally {
      detailLoading.value = false
    }
  }

  function closeDetail(): void {
    detail.value = null
    detailProducts.value = {}
  }

  /** Pedidos cuyo pago se está guardando (para mostrar el indicador en la fila). */
  const savingPayment = ref<Set<string>>(new Set())

  /** Marca el pedido saldado o registra cuánto queda pendiente; la fila se actualiza con lo que devuelve la API. */
  async function updatePayment(orderId: string, change: OrderPaymentChange): Promise<void> {
    savingPayment.value = new Set(savingPayment.value).add(orderId)
    try {
      const response = await apiClient.patch<{ payment: OrderPaymentItem }>(`/purchase-orders/${orderId}/payment`, change)
      const payment = response.payment
      orders.value = orders.value.map((order) =>
        order.id === orderId
          ? { ...order, paidAmount: payment.paidAmount, pendingAmount: payment.pendingAmount, isSettled: payment.isSettled, paidAt: payment.paidAt }
          : order,
      )
    } finally {
      const next = new Set(savingPayment.value)
      next.delete(orderId)
      savingPayment.value = next
    }
  }

  return {
    orders,
    ordersLoading,
    error,
    detail,
    detailProducts,
    detailLoading,
    savingPayment,
    loadOrders,
    openDetail,
    closeDetail,
    updatePayment,
  }
})