<script setup lang="ts">
import { ref, watch } from "vue"
import { es } from "../../../i18n/es"
import { formatDay, formatMoney } from "../../../i18n/format"

/**
 * Hoja de confirmación que sube desde abajo.
 * Entrega en el acto: «Confirmar y recibir ahora» + «Pagado ahora». Entrega otro día: «Confirmar · llega …».
 */
const props = defineProps<{
  show: boolean
  supplierName: string
  totalCost: number
  productCount: number
  deliversSameDay: boolean
  expectedDeliveryDay: string
  cashLeft: number | null
  loading?: boolean
}>()
const emit = defineEmits<{ confirm: [paidNow: boolean]; close: [] }>()

const paidNow = ref(true)
watch(
  () => props.show,
  (show) => {
    if (show) paidNow.value = true
  },
)
</script>

<template>
  <n-drawer :show="show" placement="bottom" height="auto" :auto-focus="true" @update:show="(value: boolean) => !value && emit('close')">
    <n-drawer-content
      :title="deliversSameDay ? es.orderReview.sheetTitleReceive(supplierName) : es.orderReview.sheetTitle(supplierName)"
      :native-scrollbar="false"
    >
      <n-flex vertical :size="14" :style="{ maxWidth: '520px', margin: '0 auto' }">
        <n-descriptions :column="1" label-placement="left" size="small" :bordered="false">
          <n-descriptions-item :label="es.orderReview.sheetTotal">
            <n-text class="tabular-nums" :style="{ fontWeight: 800 }">{{ formatMoney(totalCost) }}</n-text>
          </n-descriptions-item>
          <n-descriptions-item :label="es.orderReview.sheetProducts">{{ productCount }}</n-descriptions-item>
          <n-descriptions-item :label="es.orderReview.sheetDelivery">
            {{ deliversSameDay ? es.inbox.deliverySame : es.inbox.deliveryOn(formatDay(expectedDeliveryDay)) }}
          </n-descriptions-item>
          <n-descriptions-item v-if="cashLeft !== null" :label="es.orderReview.sheetCashLeft">
            <n-text class="tabular-nums">{{ formatMoney(Math.max(0, cashLeft)) }}</n-text>
          </n-descriptions-item>
        </n-descriptions>

        <n-card v-if="deliversSameDay" embedded :bordered="false" size="small">
          <n-flex justify="space-between" align="center">
            <label for="paid-now">{{ es.orderReview.paidNow }}</label>
            <n-switch id="paid-now" v-model:value="paidNow" size="large" />
          </n-flex>
        </n-card>

        <n-button type="primary" size="large" block :loading="loading" @click="emit('confirm', deliversSameDay && paidNow)">
          {{ deliversSameDay ? es.orderReview.confirmNow : es.orderReview.confirmLater(formatDay(expectedDeliveryDay)) }}
        </n-button>
        <n-button secondary block size="large" @click="emit('close')">{{ es.orderReview.keepReviewing }}</n-button>
      </n-flex>
    </n-drawer-content>
  </n-drawer>
</template>
