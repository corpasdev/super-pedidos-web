<script setup lang="ts">
import { computed, h, onMounted, ref } from "vue"
import { NFlex, NIcon, NInputNumber, NTag, NText, useNotification, type DataTableColumns } from "naive-ui"
import { AddOutline, AlertCircle, CheckmarkCircle, SearchOutline, Sync } from "@vicons/ionicons5"
import CreateSupplierModal from "../components/catalog/CreateSupplierModal.vue"
import SupplierProductsModal from "../components/catalog/SupplierProductsModal.vue"
import { apiClient } from "../../infrastructure/apiClient"
import type { SupplierListItem } from "../../infrastructure/apiTypes"
import { es } from "../../i18n/es"
import { toolbarControlOverrides, toolbarTagOverrides } from "../../theme/naiveOverrides"
import { moneyFormatter, moneyParser } from "../../i18n/format"
import { moneyInputProps } from "../numericInput"
import { tablePagination, totalCount, totalLabel } from "../tables"


const suppliers = ref<SupplierListItem[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const search = ref("")
const pagination = tablePagination()

async function loadSuppliers(): Promise<void> {
  loading.value = true
  loadError.value = null
  try {
    const response = await apiClient.get<{ suppliers: SupplierListItem[] }>("/suppliers")
    suppliers.value = response.suppliers
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : es.suppliersView.loadError
  } finally {
    loading.value = false
  }
}

onMounted(loadSuppliers)

const showCreate = ref(false)

/** Al tocar una fila se abren los productos de ese proveedor (salvo si se toca un campo editable). */
const productsOf = ref<SupplierListItem | null>(null)
const rowProps = (supplier: SupplierListItem) => ({
  style: "cursor: pointer",
  onClick: (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest("input, button, .n-input-number")) return
    productsOf.value = supplier
  },
})

async function onSupplierCreated(): Promise<void> {
  showCreate.value = false
  await loadSuppliers()
}

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (term === "") return suppliers.value
  return suppliers.value.filter(
    (supplier) => supplier.name.toLowerCase().includes(term) || (supplier.taxId ?? "").toLowerCase().includes(term),
  )
})

const weekday = (value: number | null): string => (value === null ? "—" : (es.dashboard.weekdays[value] ?? "—"))

const frequencyLabel = (supplier: SupplierListItem): string => {
  if (!supplier.hasSchedule) return es.suppliersView.noSchedule
  return supplier.visitFrequencyDays === 14 ? es.suppliersView.biweekly : es.suppliersView.weekly
}

// ── Mínimo y tope editables en la tabla (se guardan solos, como en Productos) ──
type AmountField = "minimumOrderAmount" | "maximumOrderAmount"
const notification = useNotification()
const rowState = ref<Record<string, "saving" | "saved" | "failed">>({})
const debouncers = new Map<string, ReturnType<typeof setTimeout>>()

const setRowState = (supplierId: string, state: "saving" | "saved" | "failed" | null): void => {
  const next = { ...rowState.value }
  if (state === null) delete next[supplierId]
  else next[supplierId] = state
  rowState.value = next
}

/** El mínimo no puede quedar por encima del tope (sin tope = sin límite). */
const amountProblem = (supplier: SupplierListItem): string | null =>
  supplier.maximumOrderAmount !== null && supplier.minimumOrderAmount > supplier.maximumOrderAmount ? es.catalogEntry.maximumBelowMinimum : null

async function saveAmount(supplier: SupplierListItem, field: AmountField): Promise<void> {
  const problem = amountProblem(supplier)
  if (problem !== null) {
    setRowState(supplier.id, "failed")
    notification.error({ title: supplier.name, content: problem, duration: 4000 })
    return
  }
  setRowState(supplier.id, "saving")
  try {
    await apiClient.patch(`/suppliers/${supplier.id}`, { [field]: supplier[field] })
    setRowState(supplier.id, "saved")
    setTimeout(() => {
      if (rowState.value[supplier.id] === "saved") setRowState(supplier.id, null)
    }, 2000)
  } catch (error) {
    setRowState(supplier.id, "failed")
    notification.error({ title: supplier.name, content: error instanceof Error ? error.message : es.common.error, duration: 4000 })
  }
}

function setAmount(supplier: SupplierListItem, field: AmountField, value: number | null): void {
  if (field === "minimumOrderAmount") supplier.minimumOrderAmount = value ?? 0
  else supplier.maximumOrderAmount = value
  const key = `${supplier.id}:${field}`
  const previous = debouncers.get(key)
  if (previous !== undefined) clearTimeout(previous)
  debouncers.set(
    key,
    setTimeout(() => {
      debouncers.delete(key)
      void saveAmount(supplier, field)
    }, 600),
  )
}

const saveStateIcon = (supplierId: string) => {
  const state = rowState.value[supplierId]
  if (state === "saving") return h(NIcon, { component: Sync, color: "var(--data)" })
  if (state === "saved") return h(NIcon, { component: CheckmarkCircle, color: "var(--success)" })
  if (state === "failed") return h(NIcon, { component: AlertCircle, color: "var(--danger)" })
  return null
}

const amountCell = (supplier: SupplierListItem, field: AmountField, label: string) =>
  h(NInputNumber, {
    value: supplier[field],
    min: 0,
    precision: 0,
    showButton: false,
    size: "small",
    clearable: field === "maximumOrderAmount",
    placeholder: field === "maximumOrderAmount" ? es.suppliersView.noMaximum : undefined,
    format: moneyFormatter,
    parse: moneyParser,
    inputProps: moneyInputProps({ "aria-label": `${supplier.name}: ${label}`, style: "text-align: right" }),
    "onUpdate:value": (value: number | null) => setAmount(supplier, field, value),
  })

const columns: DataTableColumns<SupplierListItem> = [
  {
    key: "name",
    title: es.suppliersView.columns.supplier,
    minWidth: 200,
    sorter: (left, right) => left.name.localeCompare(right.name, "es"),
    render: (supplier) =>
      h(NFlex, { vertical: true, size: 0 }, () => [
        h(NFlex, { align: "center", size: 6, wrap: false }, () => [h(NText, { style: { fontWeight: 500 } }, () => supplier.name), saveStateIcon(supplier.id)]),
        supplier.taxId ? h(NText, { depth: 3, style: { fontSize: "11px" } }, () => es.suppliersView.taxId(supplier.taxId!)) : null,
      ]),
  },
  { key: "orderWeekday", title: es.suppliersView.columns.orderDay, render: (supplier) => weekday(supplier.orderWeekday) },
  { key: "deliveryWeekday", title: es.suppliersView.columns.deliveryDay, render: (supplier) => weekday(supplier.deliveryWeekday) },
  {
    key: "frequency",
    title: es.suppliersView.columns.frequency,
    render: (supplier) =>
      h(NTag, { size: "small", round: true, bordered: false, type: supplier.hasSchedule ? "default" : "warning" }, () => frequencyLabel(supplier)),
  },
  {
    key: "minimumOrderAmount",
    title: es.suppliersView.columns.minimum,
    align: "right",
    width: 150,
    render: (supplier) => amountCell(supplier, "minimumOrderAmount", es.suppliersView.columns.minimum),
  },
  {
    key: "maximumOrderAmount",
    title: es.suppliersView.columns.maximum,
    align: "right",
    width: 150,
    render: (supplier) => amountCell(supplier, "maximumOrderAmount", es.suppliersView.columns.maximum),
  },
  {
    key: "productCount",
    title: es.suppliersView.columns.products,
    align: "right",
    sorter: (left, right) => left.productCount - right.productCount,
  },
]
</script>

<template>
  <n-flex vertical :size="16">
    <n-text :style="{ fontSize: '20px', fontWeight: 500 }">{{ es.suppliersView.title }}</n-text>

    <!-- Buscador fuera de la tabla, como en Productos (ancho fijo: Naive pone width 100% por defecto) -->
    <n-flex align="center" justify="space-between" :size="12">
      <n-input
        v-model:value="search"
        :placeholder="es.suppliersView.search"
        clearable
        size="large"
        :theme-overrides="toolbarControlOverrides"
        :style="{ width: '440px', maxWidth: '100%' }">
        <template #prefix><n-icon :component="SearchOutline" /></template>
      </n-input>
      <n-flex align="center" :size="12">
        <n-tag
          round
          size="large"
          :bordered="false"
          :theme-overrides="toolbarTagOverrides"
          class="tabular-nums"
          :aria-label="totalLabel(filtered.length, 'supplier')"
          :title="totalLabel(filtered.length, 'supplier')"
        >
          {{ totalCount(filtered.length) }}
        </n-tag>
        <n-button type="primary" size="large" :theme-overrides="toolbarControlOverrides" @click="showCreate = true">
          <template #icon><n-icon :component="AddOutline" /></template>
          {{ es.catalogEntry.newSupplier }}
        </n-button>
      </n-flex>
    </n-flex>

    <n-alert v-if="loadError !== null" type="error" :bordered="false">{{ loadError }}</n-alert>

    <n-data-table
      :columns="columns"
      :data="filtered"
      :loading="loading"
      :pagination="pagination"
      :row-key="(supplier: SupplierListItem) => supplier.id"
      :scroll-x="780"
      :bordered="true"
      :row-props="rowProps"
    />

    <SupplierProductsModal :supplier="productsOf" @close="productsOf = null" />

    <CreateSupplierModal :show="showCreate" @close="showCreate = false" @created="onSupplierCreated" />
  </n-flex>
</template>
