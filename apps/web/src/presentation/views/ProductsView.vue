<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from "vue"
import { NButton, NFlex, NIcon, NInputNumber, NText, useNotification, type DataTableColumns } from "naive-ui"
import { AlertCircle, Barcode, Checkmark, CheckmarkCircle, SearchOutline, Sync } from "@vicons/ionicons5"
import { useProductsStore } from "../../stores/productsStore"
import { es } from "../../i18n/es"
import { formatMoney } from "../../i18n/format"
import type { ProductItem } from "../../infrastructure/apiTypes"
import { tablePagination, totalLabel } from "../tables"

const store = useProductsStore()
const notification = useNotification()

const search = ref("")

interface EditableFields {
  packSize: number
  unitCost: number
  maxStockUnits: number | null
}

const editValues = reactive<Record<string, EditableFields>>({})
const debouncers = new Map<string, ReturnType<typeof setTimeout>>()

const countTarget = ref<ProductItem | null>(null)
const countValue = ref(0)

const supplierOptions = computed(() => store.suppliers.map((s) => ({ label: s.name, value: s.id })))

/** Por defecto sin filtro: todos los productos de la tienda. Si se vuelve a la vista, se respeta el filtro elegido. */
onMounted(async () => {
  await Promise.all([store.loadSuppliers(), store.selectSupplier(store.selectedSupplierId)])
})

function ensureEdit(product: ProductItem): EditableFields {
  const current = editValues[product.id]
  if (current === undefined) {
    const fresh: EditableFields = { packSize: product.packSize, unitCost: product.unitCost, maxStockUnits: product.maxStockUnits }
    editValues[product.id] = fresh
    return fresh
  }
  return current
}

watch(
  () => store.products,
  (products) => {
    for (const product of products) {
      ensureEdit(product)
    }
  },
  { immediate: true },
)

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (term === "") return store.products
  return store.products.filter(
    (p) =>
      p.name.toLowerCase().includes(term) || p.barcode.includes(term) || (p.supplierName ?? "").toLowerCase().includes(term),
  )
})

function scheduleSave(product: ProductItem, field: keyof EditableFields): void {
  const key = `${product.id}:${field}`
  const previous = debouncers.get(key)
  if (previous !== undefined) clearTimeout(previous)
  debouncers.set(
    key,
    setTimeout(() => {
      debouncers.delete(key)
      void plainSave(product, field)
    }, 600),
  )
}

function setEditValue(product: ProductItem, field: keyof EditableFields, value: number | null): void {
  const edit = ensureEdit(product)
  if (field === "maxStockUnits") {
    edit.maxStockUnits = value
  } else if (value !== null) {
    edit[field] = value
  }
  scheduleSave(product, field)
}

function editOf(product: ProductItem, field: keyof EditableFields): number | null {
  return ensureEdit(product)[field]
}

async function plainSave(product: ProductItem, field: keyof EditableFields): Promise<void> {
  await store.saveSettings(product.id, { [field]: ensureEdit(product)[field] })
}

function openCountDialog(product: ProductItem): void {
  countTarget.value = product
  countValue.value = product.stockUnits
}

const pagination = tablePagination()

const saveStateIcon = (productId: string) => {
  const state = store.rowState[productId]
  if (state === "saving") return h(NIcon, { component: Sync, color: "var(--data)" })
  if (state === "saved") return h(NIcon, { component: CheckmarkCircle, color: "var(--success)" })
  if (state === "failed") return h(NIcon, { component: AlertCircle, color: "var(--danger)" })
  return null
}

const numberCell = (product: ProductItem, field: keyof EditableFields, props: Record<string, unknown>) =>
  h(NInputNumber, {
    value: editOf(product, field),
    min: 0,
    precision: 0,
    showButton: false,
    size: "small",
    "onUpdate:value": (value: number | null) => setEditValue(product, field, value),
    ...props,
  })

/** Sin filtro de proveedor se muestra de qué proveedor es cada producto. */
const supplierColumn: DataTableColumns<ProductItem>[number] = {
  key: "supplierName",
  title: es.products.columns.supplier,
  minWidth: 180,
  sorter: (left, right) => (left.supplierName ?? "").localeCompare(right.supplierName ?? "", "es"),
  render: (product) => product.supplierName ?? "—",
}

const columns = computed<DataTableColumns<ProductItem>>(() =>
  store.selectedSupplierId === null ? [baseColumns[0]!, supplierColumn, ...baseColumns.slice(1)] : baseColumns,
)

const baseColumns: DataTableColumns<ProductItem> = [
  {
    key: "name",
    title: es.products.columns.product,
    minWidth: 220,
    sorter: (left, right) => left.name.localeCompare(right.name, "es"),
    render: (product) =>
      h(NFlex, { vertical: true, size: 0 }, () => [
        h(NFlex, { align: "center", size: 6, wrap: false }, () => [h(NText, null, () => product.name), saveStateIcon(product.id)]),
        h(NText, { depth: 3, style: { fontSize: "11px", fontFamily: "ui-monospace, monospace" } }, () => product.barcode),
      ]),
  },
  { key: "packSize", title: es.products.columns.pack, width: 100, render: (product) => numberCell(product, "packSize", { min: 1, max: 10_000 }) },
  {
    key: "salePrice",
    title: es.products.columns.salePrice,
    align: "right",
    width: 140,
    sorter: (left, right) => left.salePrice - right.salePrice,
    render: (product) => h(NText, { class: "tabular-nums" }, () => formatMoney(product.salePrice)),
  },
  {
    key: "stockUnits",
    title: es.products.columns.stock,
    align: "right",
    sorter: (left, right) => left.stockUnits - right.stockUnits,
    render: (product) => es.products.stockUnits(product.stockUnits),
  },
  { key: "maxStockUnits", title: es.products.columns.maxStock, width: 100, render: (product) => numberCell(product, "maxStockUnits", {}) },
  {
    key: "actions",
    title: es.products.columns.actions,
    align: "right",
    render: (product) =>
      h(NButton, { size: "small", secondary: true, onClick: () => openCountDialog(product) }, {
        default: () => es.products.count,
        icon: () => h(NIcon, { component: Barcode }),
      }),
  },
]

async function saveCount(): Promise<void> {
  if (countTarget.value === null) return
  try {
    await store.countStock(countTarget.value.id, countValue.value)
    notification.success({ content: es.products.countSuccess, duration: 2000 })
    countTarget.value = null
  } catch {
    notification.error({ content: es.products.saveFailed, duration: 2500 })
  }
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <header class="flex flex-col gap-1">
      <h1 class="text-lg md:text-xl font-semibold text-surface-900">{{ es.products.title }}</h1>
      <p class="text-sm text-surface-500">{{ es.products.subtitle }} {{ es.products.actionsHint }}</p>
    </header>

    <!-- Filtro de proveedor y buscador en la misma línea (anchos fijos: Naive pone width 100% por defecto) -->
    <n-flex align="center" :size="12">
      <n-text :style="{ fontSize: '14px' }">{{ es.products.selectSupplier }}</n-text>
      <n-select
        :value="store.selectedSupplierId"
        :options="supplierOptions"
        :loading="store.suppliersLoading"
        :placeholder="es.products.allSuppliers"
        filterable
        clearable
        :style="{ width: '260px' }"
        @update:value="(id: string | null) => store.selectSupplier(id)"
      />
      <n-input v-model:value="search" :placeholder="es.products.search" clearable :style="{ width: '280px' }">
        <template #prefix><n-icon :component="SearchOutline" /></template>
      </n-input>
    </n-flex>

    <n-alert v-if="store.error !== null" type="error" :bordered="false">
      {{ store.error }}
    </n-alert>

    <n-card :bordered="false">
      <template #header>
        <n-text :style="{ fontSize: '16px', fontWeight: 500 }">{{ store.selectedSupplier?.name ?? es.products.allSuppliers }}</n-text>
      </template>
      <template #header-extra>
        <n-tag round :bordered="false">{{ totalLabel(filtered.length, "product") }}</n-tag>
      </template>
      <n-data-table
        :columns="columns"
        :data="filtered"
        :loading="store.productsLoading"
        :pagination="pagination"
        :row-key="(product: ProductItem) => product.id"
        :scroll-x="store.selectedSupplierId === null ? 960 : 780"
        :bordered="false"
      >
        <template #empty>
          <n-empty :description="es.products.noProducts" />
        </template>
      </n-data-table>
    </n-card>

    <n-modal
      :show="countTarget !== null"
      preset="card"
      :title="countTarget === null ? '' : `${es.products.countDialogTitle} · ${countTarget.name}`"
      class="w-[95%] max-w-sm"
      @update:show="(show: boolean) => { if (!show) countTarget = null }"
    >
      <div class="flex flex-col gap-4">
        <p class="text-sm text-surface-600">{{ es.products.countDialogHint }}</p>
        <div class="flex flex-col gap-1.5">
          <span class="text-sm text-surface-700">{{ es.products.currentStock }}: <b>{{ countTarget?.stockUnits ?? 0 }}</b></span>
          <n-input-number v-model:value="countValue" :min="0" :precision="0" :show-button="false" class="w-full" />
        </div>
        <div class="flex justify-end gap-2">
          <n-button secondary @click="countTarget = null">{{ es.common.cancel }}</n-button>
          <n-button type="primary" @click="saveCount">
            <template #icon><n-icon :component="Checkmark" /></template>
            {{ es.products.countNow }}
          </n-button>
        </div>
      </div>
    </n-modal>
  </div>
</template>