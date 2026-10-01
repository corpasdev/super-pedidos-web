<script setup lang="ts">
import { computed, h, onMounted, ref, type VNodeChild } from "vue"
import { NFlex, NInputNumber, NSwitch, NTag, NText, useMessage, type DataTableColumns } from "naive-ui"
import { useHistoryStore } from "../../stores/historyStore"
import { es } from "../../i18n/es"
import { formatDate, formatMoney, moneyFormatter, moneyParser } from "../../i18n/format"
import type { OrderListItem, OrderPaymentChange } from "../../infrastructure/apiTypes"
import { tablePagination, totalCount, totalLabel } from "../tables"
import { toolbarControlOverrides, toolbarTagOverrides } from "../../theme/naiveOverrides"
import { SearchOutline } from "@vicons/ionicons5"
import { moneyInputProps } from "../numericInput"

const history = useHistoryStore()

const search = ref("")
/** Pedidos que coinciden con la búsqueda (por proveedor). */
const filteredOrders = computed(() => {
  const term = search.value.trim().toLowerCase()
  if (term === "") return history.orders
  return history.orders.filter((order) => (order.supplierName ?? "").toLowerCase().includes(term))
})
const message = useMessage()

/** Lo que el dueño va escribiendo en "Pendiente por pagar"; se guarda al salir del campo o con Enter. */
const pendingDrafts = ref<Record<string, number | null>>({})

const totalPending = computed(() => history.orders.reduce((total, order) => total + order.pendingAmount, 0))

async function savePayment(order: OrderListItem, change: OrderPaymentChange): Promise<void> {
  try {
    await history.updatePayment(order.id, change)
    const next = { ...pendingDrafts.value }
    delete next[order.id]
    pendingDrafts.value = next
    message.success(es.history.paymentSaved)
  } catch (error) {
    message.error(error instanceof Error ? error.message : es.history.paymentFailed)
  }
}

function commitPending(order: OrderListItem): void {
  const draft = pendingDrafts.value[order.id]
  if (draft === undefined || draft === null || draft === order.pendingAmount) return
  void savePayment(order, { pendingAmount: draft })
}

/** Las celdas editables no deben abrir el detalle del pedido al hacer clic. */
const editableCell = (content: () => VNodeChild) =>
  h("div", { onClick: (event: MouseEvent) => event.stopPropagation() }, [content()])

onMounted(async () => {
  await history.loadOrders()
})

const statusLabel = (status: string): string =>
  (es.orderStatus as unknown as Record<string, string>)[status] ?? status

/** Realizado (ya se entregó) en verde; pendiente (se espera la entrega) en amarillo. */
const statusSeverity = (status: string): "warning" | "success" | "default" =>
  status === "received" ? "success" : status === "confirmed" ? "warning" : "default"

interface DetailLine {
  productId: string
  units: number
  unitCost: number
  lineCost: number
  name: string
  barcode: string | null
}

const detailLines = computed<DetailLine[]>(() =>
  (history.detail?.lines ?? []).map((line) => ({
    ...line,
    name: history.detailProducts[line.productId]?.name ?? line.productId.slice(0, 8),
    barcode: history.detailProducts[line.productId]?.barcode ?? null,
  })),
)

const ordersPagination = tablePagination()
const detailPagination = tablePagination()

const orderColumns: DataTableColumns<OrderListItem> = [
  {
    key: "createdAt",
    title: es.history.columns.date,
    sorter: (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    render: (order) => formatDate(order.createdAt),
  },
  {
    key: "supplierName",
    title: es.history.columns.supplier,
    render: (order) => h(NText, { style: { fontWeight: 500 } }, () => order.supplierName ?? "—"),
  },
  {
    key: "status",
    title: es.history.columns.status,
    render: (order) => h(NTag, { round: true, size: "small", bordered: false, type: statusSeverity(order.status) }, () => statusLabel(order.status)),
  },
  {
    key: "totalCost",
    title: es.history.columns.total,
    align: "right",
    sorter: (left, right) => left.totalCost - right.totalCost,
    render: (order) => h(NText, { class: "tabular-nums", style: { fontWeight: 600 } }, () => formatMoney(order.totalCost)),
  },
  {
    key: "isSettled",
    title: es.history.columns.settled,
    width: 150,
    filterOptions: [
      { label: es.history.settledYes, value: "yes" },
      { label: es.history.settledNo, value: "no" },
    ],
    filter: (value, order) => (value === "yes") === order.isSettled,
    render: (order) =>
      editableCell(() =>
        h(NFlex, { vertical: true, size: 2 }, () => [
          h(
            NSwitch,
            {
              value: order.isSettled,
              loading: history.savingPayment.has(order.id),
              "aria-label": es.history.toggleSettled(order.supplierName ?? ""),
              "onUpdate:value": (settled: boolean) => savePayment(order, { settled }),
            },
            { checked: () => es.history.settledYes, unchecked: () => es.history.settledNo },
          ),
          order.isSettled && order.paidAt
            ? h(NText, { depth: 3, style: { fontSize: "11px" } }, () => es.history.settledOn(formatDate(order.paidAt!)))
            : null,
        ]),
      ),
  },
  {
    key: "pendingAmount",
    title: es.history.columns.pending,
    align: "right",
    width: 170,
    sorter: (left, right) => left.pendingAmount - right.pendingAmount,
    render: (order) =>
      editableCell(() =>
        h(NInputNumber, {
          value: pendingDrafts.value[order.id] ?? order.pendingAmount,
          min: 0,
          max: order.totalCost,
          precision: 0,
          showButton: false,
          size: "small",
          format: moneyFormatter,
          parse: moneyParser,
          status: order.pendingAmount > 0 ? "warning" : undefined,
          disabled: history.savingPayment.has(order.id),
          inputProps: moneyInputProps({ "aria-label": es.history.pendingInput(order.supplierName ?? "") }),
          "onUpdate:value": (value: number | null) => {
            pendingDrafts.value = { ...pendingDrafts.value, [order.id]: value }
          },
          onBlur: () => commitPending(order),
          onKeyup: (event: KeyboardEvent) => {
            if (event.key === "Enter") commitPending(order)
          },
        }),
      ),
  },
]

const detailColumns: DataTableColumns<DetailLine> = [
  {
    key: "name",
    title: es.history.columnsDetail.product,
    render: (line) =>
      h(NFlex, { vertical: true, size: 0 }, () => [
        h(NText, null, () => line.name),
        line.barcode ? h(NText, { depth: 3, style: { fontSize: "11px", fontFamily: "ui-monospace, monospace" } }, () => line.barcode) : null,
      ]),
  },
  { key: "units", title: es.history.columnsDetail.units, align: "right", render: (line) => `${line.units} u` },
  { key: "unitCost", title: es.history.columnsDetail.unitCost, align: "right", render: (line) => formatMoney(line.unitCost) },
  {
    key: "lineCost",
    title: es.history.columnsDetail.lineCost,
    align: "right",
    render: (line) => h(NText, { style: { fontWeight: 500 } }, () => formatMoney(line.lineCost)),
  },
]

const orderRowProps = (order: OrderListItem) => ({
  style: { cursor: "pointer" },
  onClick: () => history.openDetail(order.id, order.supplierId),
})
</script>

<template>
  <n-flex vertical :size="16">
    <n-text :style="{ fontSize: '20px', fontWeight: 500 }">{{ es.history.title }}</n-text>

    <n-alert v-if="history.error !== null" type="error" :bordered="false">{{ history.error }}</n-alert>

    <!-- Buscador y totales fuera de la tabla, como en Proveedores y Productos -->
    <n-flex align="center" justify="space-between" :size="12">
      <n-input
        v-model:value="search"
        :placeholder="es.suppliersView.search"
        clearable
        size="large"
        :theme-overrides="toolbarControlOverrides"
        :style="{ width: '440px', maxWidth: '100%' }"
      >
        <template #prefix><n-icon :component="SearchOutline" /></template>
      </n-input>
      <n-flex align="center" :size="12">
        <n-tag
          round
          size="large"
          :bordered="false"
          :theme-overrides="toolbarTagOverrides"
          :type="totalPending > 0 ? 'warning' : 'success'"
          class="tabular-nums"
        >
          {{ totalPending > 0 ? es.history.pendingTotal(formatMoney(totalPending)) : es.history.allSettled }}
        </n-tag>
        <n-tag
          round
          size="large"
          :bordered="false"
          :theme-overrides="toolbarTagOverrides"
          class="tabular-nums"
          :aria-label="totalLabel(filteredOrders.length, 'order')"
          :title="totalLabel(filteredOrders.length, 'order')"
        >
          {{ totalCount(filteredOrders.length) }}
        </n-tag>
      </n-flex>
    </n-flex>

    <n-data-table
      :columns="orderColumns"
      :scroll-x="900"
      :data="filteredOrders"
      :loading="history.ordersLoading"
      :pagination="ordersPagination"
      :row-key="(order: OrderListItem) => order.id"
      :row-props="orderRowProps"
      :bordered="true"
    >
      <template #empty>
        <n-empty :description="es.history.empty" />
      </template>
    </n-data-table>

    <n-modal
      :show="history.detail !== null"
      preset="card"
      :title="es.history.detailTitle"
      :style="{ width: '95%', maxWidth: '680px' }"
      @update:show="(show: boolean) => { if (!show) history.closeDetail() }"
    >
      <n-flex v-if="history.detail" vertical :size="16">
        <n-flex align="center" justify="space-between" :size="12">
          <n-flex align="center" :size="12">
            <n-text depth="3">{{ formatDate(history.detail.createdAt) }}</n-text>
            <n-tag round size="small" :bordered="false" :type="statusSeverity(history.detail.status)">{{ statusLabel(history.detail.status) }}</n-tag>
            <n-tag round size="small" :bordered="false">{{ totalLabel(detailLines.length, "line") }}</n-tag>
          </n-flex>
          <n-text :style="{ fontWeight: 600 }">{{ es.history.totalLine(formatMoney(history.detail.totalCost)) }}</n-text>
        </n-flex>

        <n-data-table
          :columns="detailColumns"
          :data="detailLines"
          :loading="history.detailLoading"
          :pagination="detailPagination"
          :row-key="(line: DetailLine) => line.productId"
          :scroll-x="480"
          :bordered="true"
          size="small"
        />

        <n-flex justify="end">
          <n-button secondary @click="history.closeDetail">{{ es.history.close }}</n-button>
        </n-flex>
      </n-flex>
    </n-modal>
  </n-flex>
</template>
