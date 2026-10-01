<script setup lang="ts">
import { h, reactive } from "vue"
import { NButton, NFlex, NIcon, NInputNumber, NTag, NText, NTooltip, type DataTableColumns } from "naive-ui"
import { Add, Remove } from "@vicons/ionicons5"
import type { SuggestionLine } from "../../../infrastructure/apiTypes"
import { es } from "../../../i18n/es"
import { formatMoney, moneyFormatter, moneyParser } from "../../../i18n/format"
import { moneyInputProps } from "../../numericInput"
import { tablePagination } from "../../tables"

/**
 * Pedido sugerido de un proveedor en tabla: una fila por producto, del más urgente al menos.
 * Columnas: producto (con su estado frente a la base y sus alertas), vendido, existencia, a cuánto llega con
 * el pedido, base, PD y tope, cantidad (−/+), precio de compra editable y subtotal.
 */
const props = defineProps<{
  lines: SuggestionLine[]
  unitsOf: (line: SuggestionLine) => number
  disabled?: boolean
}>()
const emit = defineEmits<{ step: [line: SuggestionLine, packDelta: number]; price: [line: SuggestionLine, unitCost: number] }>()

const pagination = tablePagination()

type TagType = "error" | "warning" | "success" | "default"
const STATUS_TYPE: Record<string, TagType> = { below_base: "error", at_base: "warning", above_base: "success", no_levels: "default" }

const tag = (label: string, type: TagType) => h(NTag, { size: "small", round: true, bordered: false, type }, () => label)
/** Urgente · En la base · Sobre la base · Sin niveles. */
const statusTag = (line: SuggestionLine) => {
  const status = line.stockPosition?.status ?? "no_levels"
  return tag(es.orderReview.table.statusChips[status] ?? status, STATUS_TYPE[status] ?? "default")
}

/** Cifra de unidades alineada (— si el producto no tiene ese dato). */
const units = (value: number | null, strong = false) =>
  value === null ? "—" : h(NText, { class: "tabular-nums", style: strong ? { fontWeight: 700 } : undefined }, () => String(value))

/** Precios que se están escribiendo (productId → precio); se envían al salir del campo o con Enter. */
const priceDrafts = reactive<Record<string, number | null>>({})

const priceCell = (line: SuggestionLine) => {
  const commit = () => {
    const draft = priceDrafts[line.productId]
    delete priceDrafts[line.productId]
    if (draft !== undefined && draft !== null && draft !== line.unitCost) emit("price", line, draft)
  }
  return h(NInputNumber, {
    value: line.productId in priceDrafts ? priceDrafts[line.productId] : line.unitCost,
    min: 0,
    precision: 0,
    showButton: false,
    size: "small",
    disabled: props.disabled,
    format: moneyFormatter,
    parse: moneyParser,
    inputProps: moneyInputProps({ "aria-label": es.reviewStep.unitCostInput(line.productName), style: "text-align: right" }),
    "onUpdate:value": (value: number | null) => {
      priceDrafts[line.productId] = value
    },
    onBlur: commit,
    onKeyup: (event: KeyboardEvent) => event.key === "Enter" && commit(),
  })
}

const columns: DataTableColumns<SuggestionLine> = [
  {
    key: "product",
    title: es.orderReview.table.product,
    minWidth: 220,
    render: (line) =>
      h(NFlex, { vertical: true, size: 4 }, () => [
        h(NText, { style: { fontWeight: 600 } }, () => line.productName),
        h(NText, { depth: 3, style: { fontSize: "11px", fontFamily: "ui-monospace, monospace" } }, () => line.barcode),
        // Alertas del producto: su estado frente a la base y, si aplica, el costo estimado
        h(NFlex, { size: 4 }, () => [statusTag(line), line.isCostEstimated ? tag(es.reviewStep.costEstimatedChip, "warning") : null]),
      ]),
  },
  {
    key: "sold",
    title: es.orderReview.table.sold,
    align: "right",
    width: 90,
    render: (line) => h(NText, { class: "tabular-nums" }, () => String(line.stockPosition?.movedUnits ?? line.unitsSold)),
  },
  {
    key: "stock",
    title: es.orderReview.table.stock,
    align: "right",
    width: 100,
    render: (line) => units(line.stockPosition?.estimatedStock ?? null),
  },
  {
    key: "arrives",
    title: es.orderReview.table.arrives,
    align: "right",
    width: 90,
    render: (line) => {
      const stock = line.stockPosition?.estimatedStock
      return units(stock === null || stock === undefined ? null : stock + props.unitsOf(line), true)
    },
  },
  { key: "base", title: es.orderReview.table.base, align: "right", width: 70, render: (line) => units(line.stockPosition?.base ?? null) },
  {
    key: "reorderPoint",
    // «PD» con el nombre completo al pasar el mouse.
    title: () =>
      h(NTooltip, null, {
        trigger: () => h("span", { style: { cursor: "help", textDecoration: "underline dotted" } }, es.orderReview.table.reorderPoint),
        default: () => es.orderReview.table.reorderPointFull,
      }),
    align: "right",
    width: 70,
    render: (line) => units(line.stockPosition?.reorderPoint ?? null),
  },
  { key: "tope", title: es.orderReview.table.tope, align: "right", width: 70, render: (line) => units(line.stockPosition?.tope ?? null) },
  {
    key: "order",
    title: es.orderReview.table.order,
    align: "center",
    width: 150,
    render: (line) => {
      const units = props.unitsOf(line)
      return h(NFlex, { align: "center", justify: "center", size: 6, wrap: false }, () => [
        h(
          NButton,
          { circle: true, secondary: true, size: "small", disabled: props.disabled || units <= 0, "aria-label": es.reviewStep.decrement(line.productName), onClick: () => emit("step", line, -1) },
          { icon: () => h(NIcon, { component: Remove }) },
        ),
        h(NText, { class: "tabular-nums", style: { fontWeight: 800, minWidth: "44px", textAlign: "center" } }, () => es.orderReview.units(units)),
        h(
          NButton,
          { circle: true, secondary: true, size: "small", disabled: props.disabled, "aria-label": es.reviewStep.increment(line.productName), onClick: () => emit("step", line, 1) },
          { icon: () => h(NIcon, { component: Add }) },
        ),
      ])
    },
  },
  { key: "cost", title: es.orderReview.table.cost, align: "right", width: 140, render: priceCell },
  {
    key: "subtotal",
    title: es.orderReview.table.subtotal,
    align: "right",
    width: 120,
    render: (line) => h(NText, { class: "tabular-nums", style: { fontWeight: 700 } }, () => formatMoney(props.unitsOf(line) * line.unitCost)),
  },
]
</script>

<template>
  <n-data-table
    :columns="columns"
    :data="lines"
    :pagination="pagination"
    :row-key="(line: SuggestionLine) => line.productId"
    :scroll-x="1070"
    :bordered="true"
    size="small"
  >
    <template #empty>
      <n-empty :description="es.orderReview.table.empty" />
    </template>
  </n-data-table>
</template>
