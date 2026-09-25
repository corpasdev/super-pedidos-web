import { computed, ref } from "vue"
import { defineStore } from "pinia"
import { apiClient } from "../infrastructure/apiClient"
import type { ProductItem, ProductSettingsPatch, SupplierListItem } from "../infrastructure/apiTypes"

export type RowSaveState = "saving" | "saved" | "failed"

export const useProductsStore = defineStore("products", () => {
  const suppliers = ref<SupplierListItem[]>([])
  const suppliersLoading = ref(false)
  const selectedSupplierId = ref<string | null>(null)
  const products = ref<ProductItem[]>([])
  const productsLoading = ref(false)
  const error = ref<string | null>(null)
  const rowState = ref<Record<string, RowSaveState | undefined>>({})

  const selectedSupplier = computed<SupplierListItem | null>(() => suppliers.value.find((s) => s.id === selectedSupplierId.value) ?? null)

  async function loadSuppliers(): Promise<void> {
    suppliersLoading.value = true
    error.value = null
    try {
      const response = await apiClient.get<{ suppliers: SupplierListItem[] }>("/suppliers")
      suppliers.value = response.suppliers
    } catch (err) {
      error.value = err instanceof Error ? err.message : "No se pudieron cargar los proveedores."
    } finally {
      suppliersLoading.value = false
    }
  }

  /** null = todos los productos de la tienda (sin filtro de proveedor, el valor por defecto). */
  async function selectSupplier(supplierId: string | null): Promise<void> {
    selectedSupplierId.value = supplierId
    products.value = []
    productsLoading.value = true
    error.value = null
    try {
      const path = supplierId === null ? "/products" : `/suppliers/${supplierId}/products`
      const response = await apiClient.get<{ products: ProductItem[] }>(path)
      products.value = response.products
    } catch (err) {
      error.value = err instanceof Error ? err.message : "No se pudieron cargar los productos."
    } finally {
      productsLoading.value = false
    }
  }

  async function saveSettings(productId: string, patch: ProductSettingsPatch): Promise<void> {
    rowState.value = { ...rowState.value, [productId]: "saving" }
    try {
      const response = await apiClient.patch<{ product: ProductItem }>(`/products/${productId}/settings`, patch)
      products.value = products.value.map((p) => (p.id === productId ? response.product : p))
      rowState.value = { ...rowState.value, [productId]: "saved" }
    } catch {
      rowState.value = { ...rowState.value, [productId]: "failed" }
    } finally {
      setTimeout(() => {
        if (rowState.value[productId] !== "saving") {
          const next = { ...rowState.value }
          delete next[productId]
          rowState.value = next
        }
      }, 2000)
    }
  }

  async function countStock(productId: string, units: number): Promise<void> {
    await apiClient.patch<{ ok: true }>(`/products/${productId}/stock`, { units })
    products.value = products.value.map((p) => (p.id === productId ? { ...p, stockUnits: units } : p))
  }

  return {
    suppliers,
    suppliersLoading,
    selectedSupplierId,
    selectedSupplier,
    products,
    productsLoading,
    error,
    rowState,
    loadSuppliers,
    selectSupplier,
    saveSettings,
    countStock,
  }
})