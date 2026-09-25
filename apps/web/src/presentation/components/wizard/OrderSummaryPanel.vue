<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { motion, animate, useMotionValue, useTransform, useMotionValueEvent } from "motion-v"
import type { OrderBudgetItem, SuggestionResponse } from "../../../infrastructure/apiTypes"
import { es } from "../../../i18n/es"
import { formatMoney, interpolateParams } from "../../../i18n/format"

const props = defineProps<{
  suggestion: SuggestionResponse
  /** Unidades editadas por el dueño (productId → units). Vacío = sin ajustes. */
  ownerUnits?: Record<string, number>
  /** De dónde salió la plata del pedido (caja, tope del proveedor). */
  budget?: OrderBudgetItem | null
}>()

const orderRange = computed(() => {
  if (!props.budget) return null
  const min = formatMoney(props.budget.minimumOrderAmount)
  return props.budget.maximumOrderAmount === null ? `${min} – ∞` : `${min} – ${formatMoney(props.budget.maximumOrderAmount)}`
})

const statusLabel = (status: string): string =>
  (es.orderStatus as unknown as Record<string, string>)[status] ?? status

const hasEdits = computed(() => Object.keys(props.ownerUnits ?? {}).length > 0)

const effectiveUnits = (line: { productId: string; finalUnits: number }): number =>
  props.ownerUnits?.[line.productId] ?? line.finalUnits

const items = computed(() => props.suggestion.groups.flatMap((group) => group.lines))

const finalCost = computed(() =>
  items.value.reduce((total, line) => total + effectiveUnits(line) * line.unitCost, 0),
)

const totalUnits = computed(() => items.value.reduce((total, line) => total + effectiveUnits(line), 0))

/** Con ajustes locales el estado exacto lo recalculamos al confirmar. */
const statusMessage = computed(() =>
  hasEdits.value
    ? es.summary.statusRecalculated
    : interpolateParams(
        (es.statusExplanation as unknown as Record<string, string>)[props.suggestion.statusExplanation.key] ?? props.suggestion.statusExplanation.key,
        props.suggestion.statusExplanation.params,
      ),
)

const animatedPesos = useMotionValue(0)
const animatedText = useTransform(animatedPesos, (pesos) => formatMoney(Math.round(pesos)))
const animatedTotal = ref(formatMoney(0))

useMotionValueEvent(animatedText, "change", (value) => {
  animatedTotal.value = value
})

watch(
  finalCost,
  (value) => {
    animate(animatedPesos, value, { duration: 0.25 })
  },
  { immediate: true },
)
</script>

<template>
  <aside class="rounded-xl border border-surface bg-surface-0 p-4 flex flex-col gap-3 self-start sticky top-4">
    <div class="flex items-center justify-between">
      <h2 class="text-sm font-semibold text-surface-900">{{ suggestion.supplier.name }}</h2>
      <n-tag round :type="hasEdits ? 'info' : suggestion.status === 'over_budget' ? 'error' : 'success'">{{ statusLabel(suggestion.status) }}</n-tag>
    </div>

    <motion.p
      :key="statusMessage"
      class="text-xs text-surface-500 leading-relaxed"
      aria-live="polite"
      :initial="{ opacity: 0, y: 4 }"
      :animate="{ opacity: 1, y: 0 }"
      :transition="{ duration: 0.2 }"
    >{{ statusMessage }}</motion.p>

    <dl class="flex flex-col gap-2 text-sm">
      <div class="flex justify-between gap-4">
        <dt class="text-surface-500">{{ es.summary.availableBudget }}</dt>
        <dd class="font-medium text-surface-800">{{ suggestion.availableBudget === null ? es.summary.noBudget : formatMoney(suggestion.availableBudget) }}</dd>
      </div>
      <div v-if="budget && budget.remainingCash !== null" class="flex justify-between gap-4">
        <dt class="text-surface-500">{{ es.summary.cashLeft }}</dt>
        <dd class="font-medium text-surface-800 tabular-nums">{{ formatMoney(budget.remainingCash) }}</dd>
      </div>
      <div v-if="orderRange !== null" class="flex justify-between gap-4">
        <dt class="text-surface-500">{{ es.summary.orderRange }}</dt>
        <dd class="font-medium text-surface-800 tabular-nums">{{ orderRange }}</dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="text-surface-500">{{ es.summary.maximum }}</dt>
        <dd class="font-medium text-surface-800">{{ formatMoney(suggestion.maximumOrderCost) }}</dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="text-surface-500">{{ es.summary.allocated }}</dt>
        <dd class="font-medium text-surface-800">{{ formatMoney(suggestion.allocatedOrderCost) }}</dd>
      </div>
      <div class="flex justify-between gap-4 border-t border-surface pt-2">
        <dt class="font-medium text-surface-700">{{ es.summary.final }}</dt>
        <dd class="font-semibold text-primary">{{ animatedTotal }}</dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="text-surface-500">{{ es.summary.remaining }}</dt>
        <dd class="font-medium text-surface-700">{{ hasEdits ? "—" : formatMoney(suggestion.remainingBudget) }}</dd>
      </div>
      <div v-if="(suggestion.estimatedCostLineCount ?? 0) > 0" class="flex justify-between gap-4">
        <dt class="text-surface-500">{{ es.summary.estimatedCosts }}</dt>
        <dd><n-tag round size="small" type="warning" :bordered="false">{{ suggestion.estimatedCostLineCount }}</n-tag></dd>
      </div>
      <div class="flex justify-between gap-4">
        <dt class="text-surface-500">{{ es.summary.units }}</dt>
        <dd class="font-medium text-surface-800">{{ es.summary.totalUnits(totalUnits) }}</dd>
      </div>
    </dl>
  </aside>
</template>