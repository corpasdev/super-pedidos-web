<script setup lang="ts">
import { computed } from "vue"
import type { InboxVendorItem } from "../../../infrastructure/apiTypes"
import { formatMoney } from "../../../i18n/format"

/**
 * Contenido de la card del proveedor en la grilla: solo tres datos.
 * El proveedor en grande, el total del sugerido (o del pedido ya hecho hoy) y quién lo atiende.
 */
const props = defineProps<{ vendor: InboxVendorItem }>()

const total = computed(() => props.vendor.orderToday?.totalCost ?? props.vendor.ready?.totalCost ?? 0)
</script>

<template>
  <n-flex vertical :size="2" :style="{ minWidth: 0 }">
    <n-ellipsis :style="{ fontSize: '19px', fontWeight: 800, lineHeight: 1.25 }">{{ vendor.supplierName }}</n-ellipsis>
    <n-text class="tabular-nums" :style="{ fontSize: '17px', fontWeight: 700 }">{{ formatMoney(total) }}</n-text>
    <n-ellipsis depth="3" :style="{ fontSize: '13px' }">{{ vendor.sellerName ?? "—" }}</n-ellipsis>
  </n-flex>
</template>
