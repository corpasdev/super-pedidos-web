<script setup lang="ts">
import { computed } from "vue"
import { CheckmarkCircle } from "@vicons/ionicons5"
import type { SupplierListItem } from "../../../infrastructure/apiTypes"
import { es } from "../../../i18n/es"
import { formatDate, formatMoney, weekdayLabel } from "../../../i18n/format"

const props = defineProps<{
  supplier: SupplierListItem
  selected: boolean
}>()

const emit = defineEmits<{ select: [] }>()

const orderLabel = computed<string>(() =>
  props.supplier.orderWeekday === null
    ? ""
    : es.supplierStep.orderOn(weekdayLabel(props.supplier.orderWeekday)),
)

const deliveryLabel = computed<string>(() =>
  props.supplier.deliveryWeekday === null
    ? ""
    : es.supplierStep.deliversOn(weekdayLabel(props.supplier.deliveryWeekday)),
)

function handleClick(): void {
  if (props.supplier.hasSchedule) emit("select")
}
</script>

<template>
  <button
    type="button"
    :disabled="!supplier.hasSchedule"
    :class="[
      'w-full text-left rounded-xl border p-4 flex flex-col gap-2 transition-colors',
      !supplier.hasSchedule ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:border-primary',
      selected ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-surface bg-surface-0',
    ]"
    @click="handleClick"
  >
    <div class="flex items-start justify-between gap-3">
      <span class="font-medium text-surface-900">{{ supplier.name }}</span>
      <span
        v-if="selected"
        class="text-primary mt-1"
      ><n-icon :component="CheckmarkCircle" size="14" /></span>
      <span v-else class="size-3.5 mt-1 rounded-full border border-surface-400 shrink-0"></span>
    </div>

    <p v-if="supplier.hasSchedule" class="text-xs text-surface-500">
      <template v-if="orderLabel">{{ orderLabel }}</template>
      <template v-if="orderLabel && deliveryLabel"> · </template>
      <template v-if="deliveryLabel">{{ deliveryLabel }}</template>
    </p>
    <p v-else class="text-xs text-surface-500">{{ es.supplierStep.noSchedule }}</p>

    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-surface-600">
      <span>{{ es.supplierStep.productCount(supplier.productCount) }}</span>
      <span v-if="supplier.minimumOrderAmount > 0">{{ es.supplierStep.minOrder(formatMoney(supplier.minimumOrderAmount)) }}</span>
      <span v-if="supplier.nextOrderDate !== null">{{ es.supplierStep.nextOrderOn(formatDate(supplier.nextOrderDate)) }}</span>
    </div>

    <p v-if="!supplier.hasSchedule" class="text-xs text-danger">{{ es.supplierStep.noScheduleHint }}</p>
  </button>
</template>