import { ref } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"
import { apiClient } from "../infrastructure/apiClient"
import type { DailyCashItem, OrderListItem, SalesReportItem, SupplierListItem } from "../infrastructure/apiTypes"

interface DashboardSummary {
  supplierCount: number
  issueCount: number
  pendingOrderCount: number
  latestReport: SalesReportItem | null
}

/** Datos del inicio: resumen, proveedores, pedidos y caja del día. */
export const useDashboardStore = defineStore("dashboard", () => {
  const summary = ref<DashboardSummary | null>(null)
  const suppliers = ref<SupplierListItem[]>([])
  const orders = ref<OrderListItem[]>([])
  const dailyCash = ref<DailyCashItem | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  /** Solo el resumen (lo usa el encabezado para el aviso de calidad de datos). */
  async function loadSummary(): Promise<void> {
    try {
      summary.value = await apiClient.get<DashboardSummary>("/dashboard")
    } catch {
      summary.value = null
    }
  }

  async function loadAll(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const [summaryResponse, suppliersResponse, ordersResponse, cashResponse] = await Promise.all([
        apiClient.get<DashboardSummary>("/dashboard"),
        apiClient.get<{ suppliers: SupplierListItem[] }>("/suppliers"),
        apiClient.get<{ orders: OrderListItem[] }>("/purchase-orders"),
        apiClient.get<{ dailyCash: DailyCashItem }>("/daily-cash/today"),
      ])
      summary.value = summaryResponse
      suppliers.value = suppliersResponse.suppliers
      orders.value = ordersResponse.orders
      dailyCash.value = cashResponse.dailyCash
    } catch (err) {
      error.value = err instanceof Error ? err.message : "No se pudo cargar el inicio."
    } finally {
      loading.value = false
    }
  }

  return { summary, suppliers, orders, dailyCash, loading, error, loadSummary, loadAll }
})

// Recarga en caliente (Vite): reemplaza el store en memoria cuando cambia este archivo, sin recargar la página.
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useDashboardStore, import.meta.hot))
