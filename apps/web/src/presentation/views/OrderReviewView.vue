<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useRoute, useRouter } from "vue-router"
import { useMessage } from "naive-ui"
import { useInboxStore } from "../../stores/inboxStore"
import { useWizardStore } from "../../stores/wizardStore"
import type { SuggestionLine } from "../../infrastructure/apiTypes"
import { es } from "../../i18n/es"
import { formatDay, formatMoney } from "../../i18n/format"
import LevelRow from "../components/inbox/LevelRow.vue"
import ConfirmSheet from "../components/inbox/ConfirmSheet.vue"
import { useOrderEditor } from "../composables/useOrderEditor"

/** Revisión del pedido listo de un vendedor: semáforo por producto, ajuste de a un empaque y precio del vendedor. */
const route = useRoute()
const router = useRouter()
const message = useMessage()
const wizard = useWizardStore()
const inbox = useInboxStore()

const supplierId = computed(() => String(route.params.supplierId))
const sellerId = computed(() => (typeof route.query.seller === "string" ? route.query.seller : null))
const vendor = computed(() => inbox.inbox?.vendors.find((item) => item.sellerId === sellerId.value) ?? null)
const showSheet = ref(false)
const confirming = ref(false)

onMounted(async () => {
  wizard.reset()
  wizard.replenishmentMode = "levels"
  wizard.selectedSupplierId = supplierId.value
  wizard.selectedSellerId = sellerId.value
  await Promise.all([inbox.inbox === null ? inbox.load() : Promise.resolve(), wizard.loadDailyCash(), wizard.buildSuggestion().catch(() => undefined)])
})

const { lines, unitsOf, total, productCount, remainingCash, step, price: setPrice } = useOrderEditor()
const orderBudget = computed(() => wizard.orderBudget?.orderBudget ?? null)

async function price(line: SuggestionLine, unitCost: number): Promise<void> {
  try {
    await setPrice(line, unitCost)
  } catch {
    message.error(wizard.actionError ?? es.common.error)
  }
}

async function confirm(paidNow: boolean): Promise<void> {
  confirming.value = true
  try {
    await wizard.confirmOrder({ paidNow })
    const name = vendor.value?.supplierName ?? wizard.suggestion?.supplier.name ?? ""
    message.success(
      wizard.lastConfirm?.received
        ? es.orderReview.doneReceived(name)
        : es.orderReview.donePending(name, formatDay(vendor.value?.expectedDeliveryDay ?? "")),
    )
    showSheet.value = false
    await inbox.load()
    await router.push({ name: "order-wizard" })
  } catch (error) {
    message.error(error instanceof Error ? error.message : es.common.error)
  } finally {
    confirming.value = false
  }
}
</script>

<template>
  <n-flex vertical :size="14" :style="{ maxWidth: '720px', paddingBottom: '88px' }">
    <n-button text type="primary" :style="{ alignSelf: 'flex-start' }" @click="router.push({ name: 'order-wizard' })">
      {{ es.orderReview.back }}
    </n-button>

    <n-flex vertical :size="2">
      <n-text :style="{ fontSize: '22px', fontWeight: 800 }">{{ vendor?.supplierName ?? wizard.suggestion?.supplier.name ?? "" }}</n-text>
      <n-text depth="3" :style="{ fontSize: '13px' }">
        {{
          es.orderReview.subtitle(
            es.inbox.seller(vendor?.sellerName ?? null, vendor?.supplierName ?? ""),
            vendor?.deliversSameDay ? es.inbox.deliverySame : es.inbox.deliveryOn(formatDay(vendor?.expectedDeliveryDay ?? "")),
            orderBudget === null ? es.orderReview.unlimited : formatMoney(orderBudget),
          )
        }}
      </n-text>
    </n-flex>

    <n-alert v-if="wizard.actionError" type="error" :bordered="false">{{ wizard.actionError }}</n-alert>
    <n-alert
      v-if="wizard.suggestion?.budgetTier"
      :type="wizard.suggestion.budgetTier === 'tope' ? 'success' : wizard.suggestion.budgetTier === 'between_base_and_tope' ? 'info' : 'warning'"
      :bordered="false"
    >
      {{ es.reviewStep.tierMessages[wizard.suggestion.budgetTier] }}
    </n-alert>

    <n-spin :show="wizard.suggestionLoading">
      <n-flex vertical :size="10">
        <LevelRow
          v-for="line in lines"
          :key="line.productId"
          :line="line"
          :units="unitsOf(line)"
          :disabled="wizard.suggestionLoading"
          @step="(delta: number) => step(line, delta)"
          @price="(cost: number) => price(line, cost)"
        />
        <n-empty v-if="!wizard.suggestionLoading && lines.length === 0" :description="es.orderReview.empty" />
      </n-flex>
    </n-spin>

    <!-- Pie fijo: total y confirmar -->
    <div
      v-if="lines.length > 0"
      :style="{
        position: 'sticky',
        bottom: 0,
        background: 'var(--surface)',
        borderTop: '1px solid var(--line)',
        padding: '12px 4px calc(12px + env(safe-area-inset-bottom, 0px))',
      }"
    >
      <n-flex justify="space-between" align="center" :size="10">
        <n-flex vertical :size="0">
          <n-text class="tabular-nums" :style="{ fontSize: '18px', fontWeight: 800 }">{{ formatMoney(total) }}</n-text>
          <n-text v-if="remainingCash !== null" depth="3" class="tabular-nums" :style="{ fontSize: '12px' }">
            {{ es.orderReview.cashAfter(formatMoney(Math.max(0, remainingCash - total))) }}
          </n-text>
        </n-flex>
        <n-button type="primary" size="large" :disabled="productCount === 0 || wizard.suggestionLoading" @click="showSheet = true">
          {{ vendor?.deliversSameDay ? es.inbox.confirmAndReceive : es.inbox.confirm }}
        </n-button>
      </n-flex>
    </div>

    <ConfirmSheet
      :show="showSheet"
      :supplier-name="vendor?.supplierName ?? wizard.suggestion?.supplier.name ?? ''"
      :total-cost="total"
      :product-count="productCount"
      :delivers-same-day="vendor?.deliversSameDay ?? false"
      :expected-delivery-day="vendor?.expectedDeliveryDay ?? ''"
      :cash-left="remainingCash === null ? null : remainingCash - total"
      :loading="confirming"
      @confirm="confirm"
      @close="showSheet = false"
    />
  </n-flex>
</template>
