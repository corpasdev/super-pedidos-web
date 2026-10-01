<script setup lang="ts">
import { computed, h, ref, watch } from "vue"
import { NButton, NFlex, NIcon, NInputNumber, NTag, NText, type DataTableColumns } from "naive-ui"
import { Add, Checkmark, Remove } from "@vicons/ionicons5"
import { useWizardStore } from "../../../stores/wizardStore"
import { es } from "../../../i18n/es"
import { formatMoney, moneyFormatter, moneyParser } from "../../../i18n/format"
import type { SuggestionLine } from "../../../infrastructure/apiTypes"
import { tablePagination, totalLabel } from "../../tables"
import { moneyInputProps, unitsInputProps } from "../../numericInput"

const wizard = useWizardStore()
const confirmError = ref<string | null>(null)

interface EditableLine {
  line: SuggestionLine
  units: number
}

const editableLines = ref<EditableLine[]>([])

watch(
  () => wizard.suggestion,
  (suggestion) => {
    if (suggestion === null) return
    editableLines.value = suggestion.groups.flatMap((group) => group.lines).map((line) => ({
      line,
      units: wizard.ownerUnits[line.productId] ?? line.finalUnits,
    }))
  },
  { immediate: true },
)

function applyUnits(line: EditableLine, value: number): void {
  const clamped = Math.max(0, Math.min(Math.round(value), line.line.suggestedMaximumUnits))
  line.units = clamped
  wizard.setOwnerUnits(line.line.productId, clamped)
}

function adjustByPacks(line: EditableLine, packDelta: number): void {
  applyUnits(line, line.units + packDelta * line.line.packSize)
}

const orderTotal = computed(() => editableLines.value.reduce((total, entry) => total + entry.units * entry.line.unitCost, 0))

/** Lo que el dueño va escribiendo en "Costo unit."; se aplica (y el pedido se recalcula) al salir del campo o con Enter. */
const costDrafts = ref<Record<string, number | null>>({})

async function commitUnitCost(entry: EditableLine): Promise<void> {
  const draft = costDrafts.value[entry.line.productId]
  if (draft === undefined || draft === null || draft === entry.line.unitCost) return
  try {
    await wizard.setUnitCost(entry.line.productId, draft)
    const next = { ...costDrafts.value }
    delete next[entry.line.productId]
    costDrafts.value = next
  } catch {
    // wizard.actionError ya muestra el problema
  }
}

/** Estado del inventario (EA) y hasta qué nivel llegó la plata. */
const levelChips = (line: SuggestionLine) => {
  const position = line.stockPosition
  if (position === null) return []
  const statusChip =
    position.status === "below_base"
      ? h(NTag, { round: true, size: "small", type: "error", bordered: false }, () => es.reviewStep.belowBaseChip)
      : position.status === "at_base"
        ? h(NTag, { round: true, size: "small", type: "warning", bordered: false }, () => es.reviewStep.atBaseChip)
        : position.status === "no_levels"
          ? h(NTag, { round: true, size: "small", bordered: false }, () => es.reviewStep.noLevelsChip)
          : null
  const reachedChip = h(
    NTag,
    { round: true, size: "small", bordered: false, type: position.reached === "tope" ? "success" : position.reached === "none" ? "error" : "info" },
    () => es.reviewStep.reachedChips[position.reached] ?? position.reached,
  )
  return [statusChip, reachedChip]
}

const costChip = (line: SuggestionLine) => {
  if (line.hasNoCost) return h(NTag, { round: true, size: "small", type: "error", bordered: false }, () => es.reviewStep.noCostChip)
  if (line.isCostEstimated) return h(NTag, { round: true, size: "small", type: "warning", bordered: false }, () => es.reviewStep.costEstimatedChip)
  if (line.costSource === "order") return h(NTag, { round: true, size: "small", type: "success", bordered: false }, () => es.reviewStep.vendorPriceChip)
  return null
}

const pagination = tablePagination()

const columns: DataTableColumns<EditableLine> = [
  {
    key: "product",
    title: es.reviewStep.header.product,
    minWidth: 220,
    render: (entry) =>
      h(NFlex, { vertical: true, size: 2 }, () => [
        h(NText, null, () => entry.line.productName),
        h(NText, { depth: 3, style: { fontSize: "11px" } }, () => es.reviewStep.packMeta(entry.line.packSize, entry.line.category)),
        h(NFlex, { size: 4 }, () => [
          ...levelChips(entry.line),
          costChip(entry.line),
          entry.line.isCutByBudget ? h(NTag, { round: true, size: "small", type: "warning", bordered: false }, () => es.reviewStep.cutChip) : null,
          wizard.ownerTouched.has(entry.line.productId)
            ? h(NTag, { round: true, size: "small", type: "info", bordered: false }, () => es.reviewStep.adjustChip)
            : null,
        ]),
      ]),
  },
  {
    key: "levels",
    title: es.reviewStep.header.levels,
    align: "center",
    render: (entry) => {
      const position = entry.line.stockPosition
      return h(NText, { depth: 3, class: "tabular-nums" }, () =>
        position === null ? "—" : es.reviewStep.levels(position.base, position.reorderPoint, position.tope),
      )
    },
  },
  {
    key: "moved",
    title: es.reviewStep.header.moved,
    align: "right",
    sorter: (left, right) => left.line.unitsSold - right.line.unitsSold,
    render: (entry) => entry.line.stockPosition?.movedUnits ?? entry.line.unitsSold,
  },
  {
    key: "stock",
    title: es.reviewStep.header.estimatedStock,
    align: "right",
    sorter: (left, right) => (left.line.stockPosition?.unitsAboveBase ?? 0) - (right.line.stockPosition?.unitsAboveBase ?? 0),
    render: (entry) => {
      const position = entry.line.stockPosition
      if (position === null || position.estimatedStock === null) return h(NText, { depth: 3 }, () => "—")
      return h(NText, { type: position.status === "below_base" ? "error" : undefined, class: "tabular-nums" }, () =>
        String(position.estimatedStock),
      )
    },
  },
  {
    key: "toTope",
    title: es.reviewStep.header.toTope,
    align: "right",
    render: (entry) => entry.line.stockPosition?.unitsToTope ?? entry.line.suggestedMaximumUnits,
  },
  {
    key: "final",
    title: es.reviewStep.header.final,
    align: "right",
    width: 170,
    render: (entry) =>
      h(NFlex, { align: "center", justify: "end", size: 4, wrap: false }, () => [
        h(NButton, {
          text: true,
          size: "small",
          disabled: entry.units <= 0,
          "aria-label": es.reviewStep.decrement(entry.line.productName),
          onClick: () => adjustByPacks(entry, -1),
        }, { icon: () => h(NIcon, { component: Remove }) }),
        h(NInputNumber, {
          value: entry.units,
          min: 0,
          max: entry.line.suggestedMaximumUnits,
          step: entry.line.packSize,
          precision: 0,
          showButton: false,
          size: "small",
          style: { width: "72px" },
          inputProps: unitsInputProps({ "aria-label": entry.line.productName }),
          "onUpdate:value": (value: number | null) => applyUnits(entry, value ?? 0),
        }),
        h(NButton, {
          text: true,
          size: "small",
          disabled: entry.units >= entry.line.suggestedMaximumUnits,
          "aria-label": es.reviewStep.increment(entry.line.productName),
          onClick: () => adjustByPacks(entry, 1),
        }, { icon: () => h(NIcon, { component: Add }) }),
      ]),
  },
  {
    key: "unitCost",
    title: es.reviewStep.header.unitCost,
    align: "right",
    width: 130,
    render: (entry) =>
      h(NInputNumber, {
        value: costDrafts.value[entry.line.productId] ?? entry.line.unitCost,
        min: 0,
        precision: 0,
        showButton: false,
        size: "small",
        format: moneyFormatter,
        parse: moneyParser,
        status: entry.line.hasNoCost ? "error" : entry.line.isCostEstimated ? "warning" : undefined,
        disabled: wizard.suggestionLoading,
        inputProps: moneyInputProps({ "aria-label": es.reviewStep.unitCostInput(entry.line.productName) }),
        "onUpdate:value": (value: number | null) => {
          costDrafts.value = { ...costDrafts.value, [entry.line.productId]: value }
        },
        onBlur: () => commitUnitCost(entry),
        onKeyup: (event: KeyboardEvent) => {
          if (event.key === "Enter") void commitUnitCost(entry)
        },
      }),
  },
  {
    key: "lineCost",
    title: es.reviewStep.header.lineCost,
    align: "right",
    render: (entry) => h(NText, { style: { fontWeight: 500 } }, () => formatMoney(entry.units * entry.line.unitCost)),
  },
]

/** Fila de total al pie de cada página: el costo de todo el pedido, no solo de la página. */
const summary = () => ({
  product: { value: h(NText, { style: { fontWeight: 600 } }, () => es.reviewStep.total), colSpan: 7 },
  lineCost: { value: h(NText, { style: { fontWeight: 600 } }, () => formatMoney(orderTotal.value)) },
})

async function handleConfirm(): Promise<void> {
  confirmError.value = null
  try {
    await wizard.confirmOrder()
    confirmError.value = null
  } catch (error) {
    confirmError.value = error instanceof Error ? error.message : es.common.error
  }
}
</script>

<template>
  <div v-if="wizard.suggestion" class="flex flex-col gap-4">
    <n-flex justify="space-between" align="center" :size="12">
      <p class="text-sm text-surface-600">{{ es.reviewStep.hint }}</p>
      <n-tag round :bordered="false">{{ totalLabel(editableLines.length, "product") }}</n-tag>
    </n-flex>

    <!-- Qué permitió la plata (regla del dueño: base, tope o hasta donde alcance) -->
    <n-alert
      v-if="wizard.suggestion.budgetTier"
      :type="wizard.suggestion.budgetTier === 'tope' ? 'success' : wizard.suggestion.budgetTier === 'between_base_and_tope' ? 'info' : 'warning'"
      :bordered="false"
    >
      {{ es.reviewStep.tierMessages[wizard.suggestion.budgetTier] }}
      <template v-if="(wizard.agentDecision?.belowBaseCount ?? 0) > 0">
        {{ es.reviewStep.belowBaseAlert(wizard.agentDecision!.belowBaseCount) }}
      </template>
    </n-alert>

    <n-alert
      v-if="wizard.suggestion.estimatedCostLineCount > 0 || wizard.suggestion.noCostLineCount > 0"
      type="warning"
      :bordered="false"
    >
      {{ es.reviewStep.costAlert(wizard.suggestion.estimatedCostLineCount, wizard.suggestion.noCostLineCount) }}
    </n-alert>

    <n-data-table
      :columns="columns"
      :data="editableLines"
      :loading="wizard.suggestionLoading"
      :pagination="pagination"
      :row-key="(entry: EditableLine) => entry.line.productId"
      :summary="summary"
      :scroll-x="1040"
      size="small"
    />

    <n-alert v-if="confirmError !== null" type="error">
      {{ confirmError }}
    </n-alert>

    <div class="flex justify-end">
      <n-button type="primary" :loading="wizard.suggestionLoading" @click="handleConfirm">
        <template #icon><n-icon :component="Checkmark" /></template>
        {{ es.reviewStep.confirm }}
      </n-button>
    </div>
  </div>
</template>
