<script setup lang="ts">
import { computed, ref, watch } from "vue"
import { Add, Remove } from "@vicons/ionicons5"
import type { SuggestionLine } from "../../../infrastructure/apiTypes"
import { es } from "../../../i18n/es"
import { moneyFormatter, moneyParser } from "../../../i18n/format"
import { moneyInputProps } from "../../numericInput"

/**
 * Fila de revisión con semáforo: barra con lo que hay (verde), lo que llega con el pedido (lima)
 * y las marcas de base, punto de pedido y tope. Se ajusta de a un empaque y se puede cambiar el precio del vendedor.
 */
const props = defineProps<{ line: SuggestionLine; units: number; disabled?: boolean }>()
const emit = defineEmits<{ step: [packDelta: number]; price: [unitCost: number] }>()

const position = computed(() => props.line.stockPosition)
const hasLevels = computed(() => position.value !== null && position.value.status !== "no_levels" && position.value.tope !== null)
const stock = computed(() => position.value?.estimatedStock ?? 0)
const after = computed(() => stock.value + props.units)
const scale = computed(() => Math.max(1, (position.value?.tope ?? after.value) * 1.12))
const percent = (value: number): string => `${Math.min(100, (value / scale.value) * 100)}%`
const ateBase = computed(() => position.value?.status === "below_base")
const packs = computed(() => props.units / Math.max(1, props.line.packSize))

const priceDraft = ref<number | null>(props.line.unitCost)
watch(
  () => props.line.unitCost,
  (cost) => {
    priceDraft.value = cost
  },
)
function commitPrice(): void {
  if (priceDraft.value !== null && priceDraft.value !== props.line.unitCost) emit("price", priceDraft.value)
}
</script>

<template>
  <n-card :bordered="false" size="small" :content-style="{ padding: '12px 14px' }">
    <n-flex vertical :size="8">
      <n-flex justify="space-between" align="baseline" :size="8">
        <n-text :style="{ fontWeight: 700, fontSize: '14px' }">{{ line.productName }}</n-text>
        <n-text depth="3" :style="{ fontSize: '12px', textAlign: 'right' }">{{ es.orderReview.sold(position?.movedUnits ?? line.unitsSold) }}</n-text>
      </n-flex>
      <n-flex :size="6">
        <n-tag v-if="ateBase" round size="small" type="error" :bordered="false">{{ es.orderReview.ateBase }}</n-tag>
        <n-tag v-if="!hasLevels" round size="small" :bordered="false">{{ es.orderReview.noLevels }}</n-tag>
        <n-tag v-if="line.isCostEstimated" round size="small" type="warning" :bordered="false">{{ es.reviewStep.costEstimatedChip }}</n-tag>
      </n-flex>

      <!-- Semáforo: hay (verde) + llega (lima); marcas de base, punto de pedido y tope -->
      <template v-if="hasLevels && position">
        <div
          role="img"
          :aria-label="es.orderReview.barLabel(stock, after, position.base!, position.reorderPoint!, position.tope!)"
          :style="{ position: 'relative', height: '14px', borderRadius: '999px', background: 'var(--line)' }"
        >
          <span :style="{ position: 'absolute', left: 0, top: 0, bottom: 0, width: percent(stock), borderRadius: '999px', background: 'var(--data)' }" />
          <span
            v-if="units > 0"
            :style="{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: percent(stock),
              width: `calc(${percent(after)} - ${percent(stock)})`,
              background: 'var(--accent)',
              outline: '1px solid var(--brand-deep-2)',
              borderRadius: '0 999px 999px 0',
            }"
          />
          <span
            v-for="mark in [position.base!, position.reorderPoint!, position.tope!]"
            :key="mark"
            :style="{ position: 'absolute', top: '-4px', bottom: '-4px', width: '2px', left: percent(mark), background: 'var(--ink)', opacity: 0.55 }"
          />
        </div>
        <n-flex justify="space-between" :size="6">
          <n-text depth="3" class="tabular-nums" :style="{ fontSize: '11px' }">{{ es.orderReview.stockLine(stock, after) }}</n-text>
          <n-text depth="3" class="tabular-nums" :style="{ fontSize: '11px' }">
            {{ es.orderReview.levelsLine(position.base!, position.reorderPoint!, position.tope!) }}
          </n-text>
        </n-flex>
      </template>

      <n-flex align="center" :size="10">
        <n-button circle secondary size="large" :disabled="disabled || units <= 0" :aria-label="es.reviewStep.decrement(line.productName)" @click="emit('step', -1)">
          <template #icon><n-icon :component="Remove" /></template>
        </n-button>
        <n-flex vertical align="center" :size="0" :style="{ minWidth: '84px' }">
          <n-text class="tabular-nums" :style="{ fontWeight: 800, fontSize: '16px' }">{{ es.orderReview.units(units) }}</n-text>
          <n-text depth="3" :style="{ fontSize: '11px' }">
            {{ line.packSize > 1 ? es.orderReview.packs(packs, line.packSize) : es.orderReview.perUnit }}
          </n-text>
        </n-flex>
        <n-button circle secondary size="large" :disabled="disabled" :aria-label="es.reviewStep.increment(line.productName)" @click="emit('step', 1)">
          <template #icon><n-icon :component="Add" /></template>
        </n-button>
        <n-flex align="center" :size="6" :style="{ marginLeft: 'auto' }">
          <n-text depth="3" :style="{ fontSize: '13px' }">{{ es.orderReview.price }}</n-text>
          <n-input-number
            v-model:value="priceDraft"
            size="large"
            :min="0"
            :precision="0"
            :show-button="false"
            :format="moneyFormatter"
            :parse="moneyParser"
            :disabled="disabled"
            :input-props="moneyInputProps({ 'aria-label': es.reviewStep.unitCostInput(line.productName) })"
            :style="{ width: '128px' }"
            @blur="commitPrice"
            @keyup.enter="commitPrice"
          />
        </n-flex>
      </n-flex>
    </n-flex>
  </n-card>
</template>
