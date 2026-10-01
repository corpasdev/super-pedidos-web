<script setup lang="ts">
import type { InboxVendorItem } from "../../../infrastructure/apiTypes"
import { es } from "../../../i18n/es"
import { formatDay, formatMoney } from "../../../i18n/format"

/**
 * Encabezado de la card del proveedor: el proveedor y quién atiende.
 * Si el pedido de hoy ya se hizo, su estado (recibido / pendiente). El detalle va en VendorSummary al desplegar.
 */
defineProps<{ vendor: InboxVendorItem }>()
</script>

<template>
  <n-flex align="center" justify="space-between" :size="10" :wrap="false" :style="{ width: '100%', minWidth: 0 }">
    <n-flex vertical :size="0" :style="{ minWidth: 0 }">
      <n-ellipsis :style="{ fontSize: '17px', fontWeight: 700 }">{{ vendor.supplierName }}</n-ellipsis>
      <n-text v-if="vendor.sellerName" depth="3" :style="{ fontSize: '13px' }">{{ es.inbox.seller(vendor.sellerName, vendor.supplierName) }}</n-text>
    </n-flex>

    <!-- Ya se hizo el pedido de hoy -->
    <n-flex v-if="vendor.orderToday" :size="6" :wrap="false">
      <template v-if="vendor.orderToday.status === 'received'">
        <n-tag round size="small" :bordered="false" type="success">{{ es.inbox.receivedToday }}</n-tag>
        <n-tag round size="small" :bordered="false" :type="vendor.orderToday.pendingAmount > 0 ? 'warning' : 'success'">
          {{ vendor.orderToday.pendingAmount > 0 ? es.inbox.owes(formatMoney(vendor.orderToday.pendingAmount)) : es.inbox.paid }}
        </n-tag>
      </template>
      <n-tag v-else round size="small" :bordered="false" type="warning">{{ es.inbox.pendingArrival(formatDay(vendor.expectedDeliveryDay)) }}</n-tag>
    </n-flex>
  </n-flex>
</template>
