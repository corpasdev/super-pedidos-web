<script setup lang="ts">
import { computed } from "vue"
import type { InboxVendorItem } from "../../../infrastructure/apiTypes"
import { formatMoney } from "../../../i18n/format"
import { es } from "../../../i18n/es"
import { palette } from "../../../theme/naiveOverrides"

/**
 * Contenido de la card del proveedor en la grilla: el proveedor en grande, el total del sugerido
 * (o del pedido ya hecho hoy) y quién lo atiende. Si el sugerido tiene plata de la caja, una etiqueta
 * con su color en la barra de caja y qué parte de la caja se lleva.
 */
const props = defineProps<{ vendor: InboxVendorItem; color?: string | null; cashPercent?: number | null }>()

const total = computed(() => props.vendor.orderToday?.totalCost ?? props.vendor.ready?.totalCost ?? 0)
</script>

<template>
  <n-flex vertical :size="2" :style="{ minWidth: 0 }">
    <n-flex justify="space-between" align="center" :size="8" :wrap="false">
      <n-ellipsis :style="{ fontSize: '19px', fontWeight: 800, lineHeight: 1.25 }">{{ vendor.supplierName }}</n-ellipsis>
      <n-tag
        v-if="color && cashPercent !== null && cashPercent !== undefined"
        round
        size="small"
        :bordered="false"
        :color="{ color, textColor: palette.brandDeep }"
        :style="{ fontWeight: 700, flexShrink: 0 }"
      >
        {{ es.inbox.cashShareTag(cashPercent) }}
      </n-tag>
    </n-flex>
    <n-text class="tabular-nums" :style="{ fontSize: '17px', fontWeight: 700 }">{{ formatMoney(total) }}</n-text>
    <n-ellipsis depth="3" :style="{ fontSize: '13px' }">{{ vendor.sellerName ?? "—" }}</n-ellipsis>
  </n-flex>
</template>
