import { computed, ref } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"
import { apiClient } from "../infrastructure/apiClient"
import type {
  AgentDecisionItem,
  BuildSuggestionResponse,
  ConfirmOrderResponse,
  DailyCashItem,
  OrderBudgetItem,
  ProductItem,
  PurchaseOrderItem,
  ReceiveOrderResponse,
  ReplenishmentModeValue,
  SalesReportItem,
  SuggestionResponse,
  SupplierListItem,
} from "../infrastructure/apiTypes"

export type ReplenishmentMode = ReplenishmentModeValue
export type ReportChoice = "latest" | "uploaded" | "none"

const SUGGESTION_PATH = (supplierId: string): string => `/order-suggestions/suppliers/${supplierId}`

export const useWizardStore = defineStore("wizard", () => {
  const suppliers = ref<SupplierListItem[]>([])
  const suppliersLoading = ref(false)
  const suppliersLoadError = ref<string | null>(null)
  const selectedSupplierId = ref<string | null>(null)

  const latestReport = ref<SalesReportItem | null>(null)
  const uploadedReport = ref<SalesReportItem | null>(null)
  const reportChoice = ref<ReportChoice>("latest")
  const reportLoading = ref(false)
  const unmatchedSalesCount = ref(0)

  /** Modelo del dueño: niveles B < PD < T y CM; la plata decide si llega a la base, al tope o hasta donde alcance. */
  const replenishmentMode = ref<ReplenishmentMode>("levels")
  /** Límite opcional que el dueño escribe para este pedido (además de la caja y el tope del proveedor). */
  const budgetPesos = ref<number | null>(null)

  const dailyCash = ref<DailyCashItem | null>(null)
  const dailyCashLoading = ref(false)

  /** Productos del proveedor con base: el dueño revisa su existencia antes de calcular. */
  const baseProducts = ref<ProductItem[]>([])
  const baseProductsLoading = ref(false)

  const suggestion = ref<SuggestionResponse | null>(null)
  const orderBudget = ref<OrderBudgetItem | null>(null)
  /** Qué decidió el agente: qué permitió la plata y cuántos productos están bajo la base. */
  const agentDecision = ref<AgentDecisionItem | null>(null)
  const suggestionLoading = ref(false)

  /** Precio que dio el vendedor para ESTE pedido (productId → pesos). No se guarda en el producto: el costo varía. */
  const unitCostOverrides = ref<Record<string, number>>({})

  const unitCostOverridesPayload = (): { productId: string; unitCost: number }[] =>
    Object.entries(unitCostOverrides.value).map(([productId, unitCost]) => ({ productId, unitCost }))

  /** Unidades finales del dueño, solo para productos que tocó (productId → units). */
  const ownerUnits = ref<Record<string, number>>({})
  const ownerTouched = ref<Set<string>>(new Set())

  const order = ref<PurchaseOrderItem | null>(null)
  const receiveDelivery = ref<ReceiveOrderResponse["delivery"] | null>(null)

  const actionError = ref<string | null>(null)

  const selectedSupplier = computed<SupplierListItem | null>(() => suppliers.value.find((s) => s.id === selectedSupplierId.value) ?? null)

  const effectiveReport = computed<SalesReportItem | null>(() => {
    if (reportChoice.value === "uploaded") return uploadedReport.value
    if (reportChoice.value === "latest") return latestReport.value
    return null
  })

  async function loadSuppliers(): Promise<void> {
    suppliersLoading.value = true
    suppliersLoadError.value = null
    try {
      const response = await apiClient.get<{ suppliers: SupplierListItem[] }>("/suppliers")
      suppliers.value = response.suppliers
    } catch (error) {
      suppliersLoadError.value = error instanceof Error ? error.message : "No se pudieron cargar los proveedores."
    } finally {
      suppliersLoading.value = false
    }
  }

  async function loadLatestReport(): Promise<void> {
    reportLoading.value = true
    try {
      const response = await apiClient.get<{ report: SalesReportItem | null }>("/sales-reports/latest")
      latestReport.value = response.report
    } finally {
      reportLoading.value = false
    }
  }

  async function uploadReport(file: File): Promise<void> {
    reportLoading.value = true
    actionError.value = null
    try {
      const response = await apiClient.postFile<{ report: SalesReportItem; unmatchedSales: { issueCode: string }[] }>(
        "/sales-reports/import",
        file,
        file.name,
      )
      uploadedReport.value = response.report
      unmatchedSalesCount.value = response.unmatchedSales.length
      reportChoice.value = "uploaded"
    } finally {
      reportLoading.value = false
    }
  }

  /**
   * Calcula el pedido en el servidor. Al entrar a revisar se parte de cero; al recalcular por un cambio
   * de costo (`keepOwnerChanges`) se conservan las cantidades y los costos que el dueño ya escribió.
   */
  /** Reemplaza el Excel cargado por otro (la API valida el nuevo antes de quitar el anterior). */
  async function replaceReport(reportId: string, file: File): Promise<void> {
    reportLoading.value = true
    actionError.value = null
    try {
      const response = await apiClient.postFile<{ report: SalesReportItem; unmatchedSales: { issueCode: string }[] }>(
        `/sales-reports/${reportId}/replace`,
        file,
        file.name,
      )
      uploadedReport.value = response.report
      latestReport.value = response.report
      unmatchedSalesCount.value = response.unmatchedSales.length
    } finally {
      reportLoading.value = false
    }
  }

  /** Quita el Excel de ventas; queda como más reciente el anterior (o ninguno). */
  async function removeReport(reportId: string): Promise<void> {
    reportLoading.value = true
    actionError.value = null
    try {
      const response = await apiClient.delete<{ report: SalesReportItem | null }>(`/sales-reports/${reportId}`)
      latestReport.value = response.report
      uploadedReport.value = null
      unmatchedSalesCount.value = 0
    } finally {
      reportLoading.value = false
    }
  }

  async function buildSuggestion(options: { keepOwnerChanges?: boolean } = {}): Promise<void> {
    if (selectedSupplierId.value === null) return
    suggestionLoading.value = true
    actionError.value = null
    if (!options.keepOwnerChanges) {
      ownerUnits.value = {}
      ownerTouched.value = new Set()
      unitCostOverrides.value = {}
    }
    try {
      const response = await apiClient.post<BuildSuggestionResponse>(SUGGESTION_PATH(selectedSupplierId.value), {
        replenishmentMode: replenishmentMode.value,
        budgetPesos: budgetPesos.value,
        unitCostOverrides: unitCostOverridesPayload(),
      })
      suggestion.value = response.suggestion
      orderBudget.value = response.budget
      agentDecision.value = response.decision
    } catch (error) {
      actionError.value = error instanceof Error ? error.message : "No se pudo calcular el pedido sugerido."
      throw error
    } finally {
      suggestionLoading.value = false
    }
  }

  /** El dueño escribe el precio que le da el vendedor: el pedido se recalcula (el reparto de la plata cambia). */
  async function setUnitCost(productId: string, unitCost: number): Promise<void> {
    unitCostOverrides.value = { ...unitCostOverrides.value, [productId]: Math.max(0, Math.round(unitCost)) }
    await buildSuggestion({ keepOwnerChanges: true })
  }

  function setOwnerUnits(productId: string, units: number): void {
    ownerUnits.value = { ...ownerUnits.value, [productId]: units }
    ownerTouched.value = new Set(ownerTouched.value).add(productId)
  }

  /** Vendedor que tomó el pedido (bandeja): define cuándo llega y si se recibe en el acto. */
  const selectedSellerId = ref<string | null>(null)
  /** Resultado del último confirmar: si quedó recibido y pagado (entrega en el acto). */
  const lastConfirm = ref<{ received: boolean; paid: boolean } | null>(null)

  async function confirmOrder(options: { paidNow?: boolean } = {}): Promise<void> {
    if (selectedSupplierId.value === null || suggestion.value === null) return
    actionError.value = null
    const adjustments = [...ownerTouched.value].map((productId) => ({
      productId,
      units: ownerUnits.value[productId] ?? 0,
    }))
    const body = {
      replenishmentMode: replenishmentMode.value,
      budgetPesos: budgetPesos.value,
      unitCostOverrides: unitCostOverridesPayload(),
      ...(selectedSellerId.value !== null ? { sellerId: selectedSellerId.value } : {}),
      ...(options.paidNow !== undefined ? { paidNow: options.paidNow } : {}),
      ...(adjustments.length > 0 ? { adjustments } : {}),
    }
    const response = await apiClient.post<ConfirmOrderResponse>(`${SUGGESTION_PATH(selectedSupplierId.value)}/confirm`, body)
    order.value = response.order
    suggestion.value = response.suggestion
    orderBudget.value = response.budget
    agentDecision.value = response.decision
    dailyCash.value = response.dailyCash
    lastConfirm.value = { received: response.received, paid: response.paid }
  }

  async function loadDailyCash(): Promise<void> {
    dailyCashLoading.value = true
    try {
      const response = await apiClient.get<{ dailyCash: DailyCashItem }>("/daily-cash/today")
      dailyCash.value = response.dailyCash
    } finally {
      dailyCashLoading.value = false
    }
  }

  async function openDailyCash(openingAmount: number): Promise<void> {
    dailyCashLoading.value = true
    actionError.value = null
    try {
      const response = await apiClient.put<{ dailyCash: DailyCashItem }>("/daily-cash/today", { openingAmount })
      dailyCash.value = response.dailyCash
    } catch (error) {
      actionError.value = error instanceof Error ? error.message : "No se pudo guardar la caja de hoy."
    } finally {
      dailyCashLoading.value = false
    }
  }

  async function loadBaseProducts(): Promise<void> {
    if (selectedSupplierId.value === null) return
    baseProductsLoading.value = true
    try {
      const response = await apiClient.get<{ products: ProductItem[] }>(`/suppliers/${selectedSupplierId.value}/products`)
      baseProducts.value = response.products.filter((product) => product.maxStockUnits !== null)
    } finally {
      baseProductsLoading.value = false
    }
  }

  /** El dueño revisó la existencia: queda como stock contado. */
  async function countBaseProductStock(productId: string, units: number): Promise<void> {
    await apiClient.patch<{ ok: true }>(`/products/${productId}/stock`, { units })
    baseProducts.value = baseProducts.value.map((product) =>
      product.id === productId ? { ...product, stockUnits: units, isStockReliable: true } : product,
    )
  }

  async function receiveOrder(): Promise<void> {
    if (order.value === null) return
    actionError.value = null
    const response = await apiClient.post<ReceiveOrderResponse>(`/purchase-orders/${order.value.id}/receive`)
    receiveDelivery.value = response.delivery
  }

  function reset(): void {
    selectedSupplierId.value = null
    replenishmentMode.value = "levels"
    budgetPesos.value = null
    baseProducts.value = []
    suggestion.value = null
    orderBudget.value = null
    agentDecision.value = null
    selectedSellerId.value = null
    lastConfirm.value = null
    ownerUnits.value = {}
    ownerTouched.value = new Set()
    unitCostOverrides.value = {}
    order.value = null
    receiveDelivery.value = null
    actionError.value = null
  }

  return {
    suppliers,
    suppliersLoading,
    suppliersLoadError,
    selectedSupplierId,
    selectedSupplier,
    latestReport,
    uploadedReport,
    reportChoice,
    effectiveReport,
    reportLoading,
    unmatchedSalesCount,
    replenishmentMode,
    budgetPesos,
    dailyCash,
    dailyCashLoading,
    baseProducts,
    baseProductsLoading,
    suggestion,
    orderBudget,
    agentDecision,
    selectedSellerId,
    lastConfirm,
    suggestionLoading,
    ownerUnits,
    ownerTouched,
    unitCostOverrides,
    order,
    receiveDelivery,
    actionError,
    loadSuppliers,
    loadLatestReport,
    uploadReport,
    replaceReport,
    removeReport,
    buildSuggestion,
    setOwnerUnits,
    setUnitCost,
    confirmOrder,
    receiveOrder,
    loadDailyCash,
    openDailyCash,
    loadBaseProducts,
    countBaseProductStock,
    reset,
  }
})

// Recarga en caliente (Vite): reemplaza el store en memoria cuando cambia este archivo, sin recargar la página.
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useWizardStore, import.meta.hot))
