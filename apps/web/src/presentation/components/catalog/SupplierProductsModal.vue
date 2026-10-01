<script setup lang="ts">
import { computed, h, ref, watch } from "vue"
import { NFlex, NText, type DataTableColumns } from "naive-ui"
import { SearchOutline } from "@vicons/ionicons5"
import { apiClient } from "../../../infrastructure/apiClient"
import type { ProductItem, SupplierListItem } from "../../../infrastructure/apiTypes"
import { es } from "../../../i18n/es"
import { formatMoney } from "../../../i18n/format"
import { tablePagination, totalLabel } from "../../tables"

/** Productos asociados a un proveedor (al tocar su fila en la tabla de Proveedores). Solo consulta. */
const props = defineProps<{ supplier: SupplierListItem | null }>()
const emit = defineEmits<{ close: [] }>()

const products = ref<ProductItem[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const search = ref("")
const pagination = tablePagination()

watch(
  () => props.supplier,
  async (supplier) => {
    products.value = []
    search.value = ""
    loadError.value = null
    if (supplier === null) return
    loading.value = true
    try {
      const response = await apiClient.get<{ products: ProductItem[] }>(`/suppliers/${supplier.id}/products`)
      if (props.supplier?.id === supplier.id) products.value = response.products
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : es.common.error
    } finally {
      loading.value = false
    }
  },
)

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (term === "") return products.value
  return products.value.filter((product) => product.name.toLowerCase().includes(term) || product.barcode.includes(term))
})

const levels = (value: number | null): string => (value === null ? "—" : String(value))

const columns: DataTableColumns<ProductItem> = [
  {
    key: "name",
    title: es.products.columns.product,
    minWidth: 220,
    sorter: (left, right) => left.name.localeCompare(right.name, "es"),
    render: (product) =>
      h(NFlex, { vertical: true, size: 0 }, () => [
        h(NText, null, () => product.name),
        h(NText, { depth: 3, style: { fontSize: "11px", fontFamily: "ui-monospace, monospace" } }, () => product.barcode),
      ]),
  },
  {
    key: "stockUnits",
    title: es.products.columns.stock,
    align: "right",
    sorter: (left, right) => left.stockUnits - right.stockUnits,
    render: (product) => es.products.stockUnits(product.stockUnits),
  },
  {
    key: "unitCost",
    title: es.products.columns.purchasePrice,
    align: "right",
    sorter: (left, right) => left.unitCost - right.unitCost,
    render: (product) => h(NText, { class: "tabular-nums" }, () => formatMoney(product.unitCost)),
  },
  {
    key: "salePrice",
    title: es.products.columns.salePrice,
    align: "right",
    sorter: (left, right) => left.salePrice - right.salePrice,
    render: (product) => h(NText, { class: "tabular-nums" }, () => formatMoney(product.salePrice)),
  },
  { key: "minStockUnits", title: es.products.columns.minStock, align: "right", render: (product) => levels(product.minStockUnits) },
  { key: "maxStockUnits", title: es.products.columns.maxStock, align: "right", render: (product) => levels(product.maxStockUnits) },
]
</script>

<template>
  <n-modal
    :show="supplier !== null"
    preset="card"
    :title="supplier?.name ?? ''"
    :bordered="false"
    :style="{ width: '900px', maxWidth: 'calc(100vw - 32px)' }"
    @update:show="(value: boolean) => { if (!value) emit('close') }"
  >
    <n-flex vertical :size="12">
      <n-flex align="center" justify="space-between" :size="12">
        <n-input v-model:value="search" :placeholder="es.products.search" clearable :style="{ width: '280px' }">
          <template #prefix><n-icon :component="SearchOutline" /></template>
        </n-input>
        <n-tag round :bordered="false">{{ totalLabel(filtered.length, "product") }}</n-tag>
      </n-flex>
      <n-alert v-if="loadError !== null" type="error" :bordered="false">{{ loadError }}</n-alert>
      <n-data-table
        :columns="columns"
        :data="filtered"
        :loading="loading"
        :pagination="pagination"
        :row-key="(product: ProductItem) => product.id"
        :scroll-x="760"
        :bordered="true"
      >
        <template #empty>
          <n-empty :description="es.suppliersView.noProducts" />
        </template>
      </n-data-table>
    </n-flex>
  </n-modal>
</template>
