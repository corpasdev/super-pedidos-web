<script setup lang="ts">
import { computed, h, onMounted, reactive, ref, watch } from "vue"
import { NFlex, NIcon, NInputNumber, NText, useNotification, type DataTableColumns } from "naive-ui"
import { AddOutline, AlertCircle, CheckmarkCircle, SearchOutline, Sync } from "@vicons/ionicons5"
import CreateProductModal from "../components/catalog/CreateProductModal.vue"
import { useProductsStore } from "../../stores/productsStore"
import { es } from "../../i18n/es"
import { toolbarControlOverrides, toolbarTagOverrides } from "../../theme/naiveOverrides"
import { moneyFormatter, moneyParser } from "../../i18n/format"
import type { ProductItem } from "../../infrastructure/apiTypes"
import { tablePagination, totalCount, totalLabel } from "../tables"
import { moneyInputProps, unitsInputProps } from "../numericInput"

const store = useProductsStore()
const notification = useNotification()

const search = ref("")

interface EditableFields {
  /** Unidades actuales (conteo real). */
  stockUnits: number
  /** Precio de venta de la tienda. */
  salePrice: number
  packSize: number
  unitCost: number
  /** Tope (T). */
  maxStockUnits: number | null
  /** Base (B). */
  minStockUnits: number | null
  /** Punto de pedido (PD). */
  reorderPointUnits: number | null
}

/** Niveles que se pueden dejar vacíos (producto aún sin niveles: se repone lo movido). */
const NULLABLE_FIELDS: ReadonlySet<keyof EditableFields> = new Set(["maxStockUnits", "minStockUnits", "reorderPointUnits"])

const editValues = reactive<Record<string, EditableFields>>({})
const debouncers = new Map<string, ReturnType<typeof setTimeout>>()

/** Una sola tabla con todos los productos de la tienda; el proveedor es solo una columna. */
onMounted(async () => {
  await Promise.all([store.selectSupplier(null), store.loadSuppliers()])
})

const showCreate = ref(false)
const categories = computed(() => [...new Set(store.products.map((product) => product.category))].sort((a, b) => a.localeCompare(b, "es")))

async function onProductCreated(): Promise<void> {
  showCreate.value = false
  await store.selectSupplier(null)
}

function ensureEdit(product: ProductItem): EditableFields {
  const current = editValues[product.id]
  if (current === undefined) {
    const fresh: EditableFields = {
      stockUnits: product.stockUnits,
      salePrice: product.salePrice,
      packSize: product.packSize,
      unitCost: product.unitCost,
      maxStockUnits: product.maxStockUnits,
      minStockUnits: product.minStockUnits,
      reorderPointUnits: product.reorderPointUnits,
    }
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
  // Los niveles se pueden dejar vacíos; el empaque no.
  if (value === null && !NULLABLE_FIELDS.has(field)) return
  ;(edit as Record<keyof EditableFields, number | null>)[field] = value
  scheduleSave(product, field)
}

function editOf(product: ProductItem, field: keyof EditableFields): number | null {
  return ensureEdit(product)[field]
}

async function plainSave(product: ProductItem, field: keyof EditableFields): Promise<void> {
  const value = ensureEdit(product)[field]
  const problem =
    field === "stockUnits" ? await store.saveStock(product.id, value ?? 0) : await store.saveSettings(product.id, { [field]: value })
  if (problem !== null) notification.error({ title: product.name, content: problem, duration: 4000 })
}

const pagination = tablePagination()

const saveStateIcon = (productId: string) => {
  const state = store.rowState[productId]
  if (state === "saving") return h(NIcon, { component: Sync, color: "var(--data)" })
  if (state === "saved") return h(NIcon, { component: CheckmarkCircle, color: "var(--success)" })
  if (state === "failed") return h(NIcon, { component: AlertCircle, color: "var(--danger)" })
  return null
}

/** Nombre de cada campo tal como lo ve el dueño (para lectores de pantalla). */
const FIELD_LABELS: Record<keyof EditableFields, string> = {
  stockUnits: es.products.columns.stock,
  salePrice: es.products.columns.salePrice,
  packSize: es.products.columns.pack,
  unitCost: es.products.columns.purchasePrice,
  minStockUnits: es.products.columns.minStock,
  reorderPointUnits: es.products.columns.reorderPoint,
  maxStockUnits: es.products.columns.maxStock,
}

const numberCell = (product: ProductItem, field: keyof EditableFields, props: Record<string, unknown>) =>
  h(NInputNumber, {
    value: editOf(product, field),
    min: 0,
    precision: 0,
    showButton: false,
    size: "small",
    inputProps: unitsInputProps({ "aria-label": `${product.name}: ${FIELD_LABELS[field]}` }),
    "onUpdate:value": (value: number | null) => setEditValue(product, field, value),
    ...props,
  })

/** Precio en pesos, editable: se ve como $3.800 y solo acepta números. */
const moneyCell = (product: ProductItem, field: "unitCost" | "salePrice") =>
  h(NInputNumber, {
    value: editOf(product, field),
    min: 0,
    precision: 0,
    showButton: false,
    size: "small",
    format: moneyFormatter,
    parse: moneyParser,
    inputProps: moneyInputProps({ "aria-label": `${product.name}: ${FIELD_LABELS[field]}`, style: "text-align: right" }),
    "onUpdate:value": (value: number | null) => setEditValue(product, field, value),
  })

/** De qué proveedor es cada producto (se puede ordenar por esta columna). */
const supplierColumn: DataTableColumns<ProductItem>[number] = {
  key: "supplierName",
  title: es.products.columns.supplier,
  minWidth: 180,
  sorter: (left, right) => (left.supplierName ?? "").localeCompare(right.supplierName ?? "", "es"),
  render: (product) => product.supplierName ?? "—",
}

const columns = computed<DataTableColumns<ProductItem>>(() => [baseColumns[0]!, supplierColumn, ...baseColumns.slice(1)])

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
  {
    key: "stockUnits",
    title: es.products.columns.stock,
    align: "right",
    sorter: (left, right) => left.stockUnits - right.stockUnits,
    width: 150,
    render: (product) => numberCell(product, "stockUnits", {}),
  },
  {
    key: "unitCost",
    title: es.products.columns.purchasePrice,
    align: "right",
    width: 150,
    sorter: (left, right) => left.unitCost - right.unitCost,
    // Precio al que lo compra la tienda; al escribirlo queda como dato del dueño.
    render: (product) => moneyCell(product, "unitCost"),
  },
  {
    key: "salePrice",
    title: es.products.columns.salePrice,
    align: "right",
    width: 150,
    sorter: (left, right) => left.salePrice - right.salePrice,
    render: (product) => moneyCell(product, "salePrice"),
  },
  // Niveles del sugerido: base y tope. El punto de pedido no se muestra aquí (sí en Sugeridos, en la barra de cada producto).
  { key: "minStockUnits", title: es.products.columns.minStock, width: 90, render: (product) => numberCell(product, "minStockUnits", {}) },
  { key: "maxStockUnits", title: es.products.columns.maxStock, width: 90, render: (product) => numberCell(product, "maxStockUnits", {}) },
]

</script>

<template>
  <div class="flex flex-col gap-4">
    <header class="flex flex-col gap-1">
      <h1 class="text-lg md:text-xl font-semibold text-surface-900">{{ es.products.title }}</h1>
    </header>

    <!-- Buscador (ancho fijo: Naive pone width 100% por defecto) -->
    <n-flex align="center" justify="space-between" :size="12">
      <n-input
        v-model:value="search"
        :placeholder="es.products.search"
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
          :aria-label="totalLabel(filtered.length, 'product')"
          :title="totalLabel(filtered.length, 'product')"
        >
          {{ totalCount(filtered.length) }}
        </n-tag>
        <n-button type="primary" size="large" :theme-overrides="toolbarControlOverrides" @click="showCreate = true">
          <template #icon><n-icon :component="AddOutline" /></template>
          {{ es.catalogEntry.newProduct }}
        </n-button>
      </n-flex>
    </n-flex>

    <n-alert v-if="store.error !== null" type="error" :bordered="false">
      {{ store.error }}
    </n-alert>

    <n-data-table
      :columns="columns"
      :data="filtered"
      :loading="store.productsLoading"
      :pagination="pagination"
      :row-key="(product: ProductItem) => product.id"
      :scroll-x="1110"
      :bordered="true"
    >
      <template #empty>
        <n-empty :description="es.products.noProducts" />
      </template>
    </n-data-table>

    <CreateProductModal
      :show="showCreate"
      :suppliers="store.suppliers"
      :categories="categories"
      @close="showCreate = false"
      @created="onProductCreated"
    />
  </div>
</template>