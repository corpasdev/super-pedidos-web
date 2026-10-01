<script setup lang="ts">
import { computed } from "vue"
import type { InboxVendorItem } from "../../../infrastructure/apiTypes"
import { es } from "../../../i18n/es"
import { formatDay, formatMoney } from "../../../i18n/format"

/**
 * Resumen del pedido, en la card y en el panel del pedido: cuándo entrega (si no es el mismo día), productos bajo la base,
 * cuántos productos y el total (el total sigue los ajustes del dueño).
 */
const props = defineProps<{ vendor: InboxVendorItem; total: number; productCount: number }>()

const ready = computed(() => props.vendor.ready)
</script>

<template>
  <n-flex justify="space-between" align="center" :size="10">
    <n-flex align="center" :size="8">
      <!-- Solo se avisa cuando entrega otro día; «hoy mismo» no hace falta decirlo -->
      <n-tag v-if="!vendor.deliversSameDay" round size="small" :style="{ fontWeight: 700 }">
        {{ es.inbox.deliveryOn(formatDay(vendor.expectedDeliveryDay)) }}
      </n-tag>
      <template v-if="ready">
        <n-tag v-if="ready.belowBaseCount > 0" round size="small" :bordered="false" type="error">{{ es.inbox.belowBase(ready.belowBaseCount) }}</n-tag>
      </template>
      <n-text depth="3" :style="{ fontSize: '13px' }">{{ es.inbox.products(productCount) }}</n-text>
    </n-flex>
    <n-text class="tabular-nums" :style="{ fontSize: '17px', fontWeight: 800, whiteSpace: 'nowrap' }">{{ formatMoney(total) }}</n-text>
  </n-flex>
</template>
