<script setup lang="ts">
import { computed, h, onMounted, ref } from "vue"
import { useRouter } from "vue-router"
import { NButton, NFlex, NIcon, NTag, NText, type DataTableColumns } from "naive-ui"
import { CartOutline, SearchOutline } from "@vicons/ionicons5"
import { apiClient } from "../../infrastructure/apiClient"
import type { SupplierListItem } from "../../infrastructure/apiTypes"
import { useWizardStore } from "../../stores/wizardStore"
import { palette } from "../../theme/naiveOverrides"
import { es } from "../../i18n/es"
import { formatDate, formatMoney } from "../../i18n/format"
import { tablePagination, totalLabel } from "../tables"

const router = useRouter()
const wizard = useWizardStore()

const suppliers = ref<SupplierListItem[]>([])
const loading = ref(false)
const loadError = ref<string | null>(null)
const search = ref("")
const pagination = tablePagination()

onMounted(async () => {
  loading.value = true
  try {
    const response = await apiClient.get<{ suppliers: SupplierListItem[] }>("/suppliers")
    suppliers.value = response.suppliers
  } catch (error) {
    loadError.value = error instanceof Error ? error.message : es.suppliersView.loadError
  } finally {
    loading.value = false
  }
})

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

function makeOrder(supplierId: string): void {
  wizard.reset()
  wizard.selectedSupplierId = supplierId
  void router.push("/pedido")
}

const columns: DataTableColumns<SupplierListItem> = [
  {
    key: "name",
    title: es.suppliersView.columns.supplier,
    minWidth: 200,
    sorter: (left, right) => left.name.localeCompare(right.name, "es"),
    render: (supplier) =>
      h(NFlex, { vertical: true, size: 0 }, () => [
        h(NText, { style: { fontWeight: 500 } }, () => supplier.name),
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
    render: (supplier) => formatMoney(supplier.minimumOrderAmount),
  },
  {
    key: "maximumOrderAmount",
    title: es.suppliersView.columns.maximum,
    align: "right",
    render: (supplier) => (supplier.maximumOrderAmount === null ? es.suppliersView.noMaximum : formatMoney(supplier.maximumOrderAmount)),
  },
  {
    key: "productCount",
    title: es.suppliersView.columns.products,
    align: "right",
    sorter: (left, right) => left.productCount - right.productCount,
  },
  {
    key: "lastOrderAt",
    title: es.suppliersView.columns.lastOrder,
    render: (supplier) => (supplier.lastOrderAt ? formatDate(supplier.lastOrderAt) : es.suppliersView.never),
  },
  {
    key: "nextOrderDate",
    title: es.suppliersView.columns.nextVisit,
    sorter: (left, right) =>
      (left.nextOrderDate ? new Date(left.nextOrderDate).getTime() : Infinity) -
      (right.nextOrderDate ? new Date(right.nextOrderDate).getTime() : Infinity),
    render: (supplier) => {
      if (supplier.isVisitingToday) {
        return h(NTag, { size: "small", round: true, bordered: false, color: { color: palette.accent, textColor: palette.brandDeep } }, () => es.suppliersView.today)
      }
      return supplier.nextOrderDate ? formatDate(supplier.nextOrderDate) : "—"
    },
  },
  {
    key: "actions",
    title: es.suppliersView.columns.actions,
    align: "right",
    render: (supplier) =>
      h(
        NButton,
        { size: "small", type: "primary", disabled: !supplier.hasSchedule, onClick: () => makeOrder(supplier.id) },
        { default: () => es.suppliersView.makeOrder, icon: () => h(NIcon, { component: CartOutline }) },
      ),
  },
]
</script>

<template>
  <n-flex vertical :size="20">
    <n-flex vertical :size="2">
      <n-text :style="{ fontSize: '20px', fontWeight: 500 }">{{ es.suppliersView.title }}</n-text>
      <n-text depth="3" :style="{ fontSize: '12px' }">{{ es.suppliersView.subtitle }}</n-text>
    </n-flex>

    <n-alert v-if="loadError !== null" type="error" :bordered="false">{{ loadError }}</n-alert>

    <n-card :bordered="false">
      <template #header>
        <n-input v-model:value="search" :placeholder="es.suppliersView.search" clearable :style="{ maxWidth: '320px' }">
          <template #prefix><n-icon :component="SearchOutline" /></template>
        </n-input>
      </template>
      <template #header-extra>
        <n-tag round :bordered="false">{{ totalLabel(filtered.length, "supplier") }}</n-tag>
      </template>
      <n-data-table
        :columns="columns"
        :data="filtered"
        :loading="loading"
        :pagination="pagination"
        :row-key="(supplier: SupplierListItem) => supplier.id"
        :scroll-x="1100"
        :bordered="false"
      />
    </n-card>
  </n-flex>
</template>
