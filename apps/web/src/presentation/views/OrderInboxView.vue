<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue"
import { useMessage } from "naive-ui"
import { RefreshOutline } from "@vicons/ionicons5"
import { useInboxStore } from "../../stores/inboxStore"
import { useWizardStore } from "../../stores/wizardStore"
import type { InboxVendorItem } from "../../infrastructure/apiTypes"
import { es } from "../../i18n/es"
import { formatDay, formatLongDay, formatMoney } from "../../i18n/format"
import { palette, SUGGESTION_COLORS } from "../../theme/naiveOverrides"
import { useOrderEditor } from "../composables/useOrderEditor"
import CashBar from "../components/inbox/CashBar.vue"
import SalesUploadPanel from "../components/inbox/SalesUploadPanel.vue"
import VendorCard from "../components/inbox/VendorCard.vue"
import VendorHeader from "../components/inbox/VendorHeader.vue"
import VendorSummary from "../components/inbox/VendorSummary.vue"
import SuggestionTable from "../components/inbox/SuggestionTable.vue"
import ConfirmSheet from "../components/inbox/ConfirmSheet.vue"
import ExpiredExchangesCard from "../components/inbox/ExpiredExchangesCard.vue"

/**
 * Sugeridos del día en grilla con patrón F:
 * bento con caja → Excel arriba, la grilla de cards por proveedor debajo y «Le debes» a la derecha, a toda la altura. Al tocar una card, su pedido se edita en un panel lateral.
 */
const inbox = useInboxStore()
const wizard = useWizardStore()
const message = useMessage()
const editor = useOrderEditor()

const openSellerId = ref<string | null>(null)
const showSheet = ref(false)
const confirming = ref(false)

const vendors = computed(() => inbox.inbox?.vendors ?? [])
/** Le debes: solo los proveedores que vienen hoy y a los que se les tiene plata pendiente. */
const debts = computed(() => {
  const comingToday = new Set(vendors.value.map((vendor) => vendor.supplierId))
  return (inbox.inbox?.debts ?? []).filter((debt) => comingToday.has(debt.supplierId))
})
const openVendor = computed(() => vendors.value.find((vendor) => vendor.sellerId === openSellerId.value) ?? null)

/** Se abren los que aún no hicieron el pedido hoy (aunque no tengan nada que pedir, para ver el resumen). */
const canOpen = (vendor: InboxVendorItem): boolean => vendor.orderToday === null
const hasSomethingToOrder = (vendor: InboxVendorItem): boolean => canOpen(vendor) && (vendor.ready?.productCount ?? 0) > 0


/** Reparto de la caja: cada sugerido pendiente con plata asignada recibe un color (barra de caja y su tarjeta). */
const cashSegments = computed(() =>
  vendors.value
    .filter((vendor) => vendor.orderToday === null && (vendor.ready?.totalCost ?? 0) > 0)
    .map((vendor, index) => ({
      sellerId: vendor.sellerId,
      name: vendor.supplierName,
      amount: vendor.ready!.totalCost,
      color: SUGGESTION_COLORS[index % SUGGESTION_COLORS.length]!,
    })),
)
const segmentOf = (sellerId: string) => cashSegments.value.find((segment) => segment.sellerId === sellerId) ?? null
/** Parte de la caja del día que se lleva ese sugerido (para su etiqueta de color). */
const cashPercent = (amount: number): number => {
  const opening = inbox.inbox?.cash.openingAmount ?? 0
  return opening > 0 ? Math.round((amount / opening) * 100) : 0
}

/** Solo el día de la visita se confirma; los otros días el sugerido se puede revisar. */
const isSelectedToday = computed(() => inbox.inbox === null || inbox.inbox.day === inbox.inbox.today)

onMounted(async () => {
  void wizard.loadDailyCash()
  await inbox.loadDays().catch(() => undefined)
  await inbox.load()
})

/** Si la página queda abierta, al pasar la medianoche se recarga sola con el nuevo día. */
const localDay = (): string => new Date().toLocaleDateString("en-CA")
let dayWatcher: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  dayWatcher = setInterval(() => {
    const today = inbox.inbox?.today
    if (today && today !== localDay() && !inbox.loading) void reload()
  }, 60_000)
})
onUnmounted(() => clearInterval(dayWatcher))

async function reload(): Promise<void> {
  openSellerId.value = null
  await inbox.loadDays().catch(() => undefined)
  await inbox.load()
}

/** Abre el pedido del proveedor en el panel lateral y arma su sugerido. */
async function open(vendor: InboxVendorItem): Promise<void> {
  if (!canOpen(vendor)) return
  openSellerId.value = vendor.sellerId
  wizard.reset()
  wizard.replenishmentMode = "levels"
  wizard.selectedSupplierId = vendor.supplierId
  wizard.selectedSellerId = vendor.sellerId
  // Mismo reparto de la caja que la tarjeta: este pedido sale de lo que dejan los anteriores.
  wizard.budgetPesos = vendor.ready?.cashShare ?? null
  if (!hasSomethingToOrder(vendor)) return
  try {
    await wizard.buildSuggestion()
  } catch {
    message.error(wizard.actionError ?? es.inbox.readyError)
  }
}

function closeDrawer(show: boolean): void {
  if (!show) openSellerId.value = null
}

async function price(lineProductId: string, unitCost: number): Promise<void> {
  const line = editor.lines.value.find((item) => item.productId === lineProductId)
  if (!line) return
  try {
    await editor.price(line, unitCost)
  } catch {
    message.error(wizard.actionError ?? es.common.error)
  }
}

async function confirm(paidNow: boolean): Promise<void> {
  const vendor = openVendor.value
  if (vendor === null) return
  confirming.value = true
  try {
    await wizard.confirmOrder({ paidNow })
    message.success(
      wizard.lastConfirm?.received
        ? es.orderReview.doneReceived(vendor.supplierName)
        : es.orderReview.donePending(vendor.supplierName, formatDay(vendor.expectedDeliveryDay)),
    )
    showSheet.value = false
    openSellerId.value = null
    await Promise.all([inbox.load(), wizard.loadDailyCash()])
  } catch (error) {
    message.error(error instanceof Error ? error.message : es.common.error)
  } finally {
    confirming.value = false
  }
}

async function openCash(amount: number): Promise<void> {
  await wizard.openDailyCash(amount)
  await inbox.load()
}

const tileTitleStyle = { fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }
</script>

<template>
  <!--
    Bento: arriba caja → Excel → le debes; «Le debes» baja por la derecha hasta el final de la grilla de proveedores.
    n-grid no permite que una celda ocupe varias filas, por eso este contenedor usa la grilla de Tailwind.
    En celular todo se apila en una columna (caja, Excel, le debes, proveedores).
  -->
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
    <!-- Caja (lo que más limita el pedido) -->
    <div class="lg:col-start-1">
      <CashBar
        :cash="inbox.inbox?.cash ?? null"
        :saving="wizard.dailyCashLoading"
        :segments="cashSegments"
        @open="openCash"
      />
    </div>

    <!-- Receptor del Excel de ventas -->
    <div class="lg:col-start-2">
      <SalesUploadPanel @changed="inbox.load()" />
    </div>

    <!-- Columna derecha (ocupa las dos filas): a quién de los de hoy se le debe plata y los vencidos para cambio -->
    <div class="flex flex-col gap-4 lg:col-start-3 lg:row-span-2">
      <n-card :bordered="false" :content-style="{ padding: '14px 16px' }">
        <n-flex vertical :size="8">
          <n-text :style="tileTitleStyle">{{ es.inbox.owed }}</n-text>
          <!-- Por proveedor: total que se le debe y, debajo, cada factura con su fecha y saldo -->
          <n-flex v-for="debt in debts" :key="debt.supplierId" vertical :size="2">
            <n-flex justify="space-between" :size="8" :wrap="false">
              <n-ellipsis :style="{ fontWeight: 600 }">{{ debt.supplierName }}</n-ellipsis>
              <n-text class="tabular-nums" :style="{ fontWeight: 700, whiteSpace: 'nowrap' }">{{ formatMoney(debt.amount) }}</n-text>
            </n-flex>
            <n-flex v-for="invoice in debt.invoices" :key="invoice.orderId" justify="space-between" :size="8" :wrap="false">
              <n-text depth="3" :style="{ fontSize: '12px' }">{{ es.inbox.invoiceOf(formatDay(invoice.orderDay), formatMoney(invoice.totalCost)) }}</n-text>
              <n-text depth="3" class="tabular-nums" :style="{ fontSize: '12px', whiteSpace: 'nowrap' }">
                {{ es.inbox.invoiceBalance(formatMoney(invoice.pendingAmount)) }}
              </n-text>
            </n-flex>
          </n-flex>
          <n-text v-if="debts.length === 0" depth="3">—</n-text>
        </n-flex>
      </n-card>
      <ExpiredExchangesCard :suppliers-coming-today="vendors.map((vendor) => vendor.supplierId)" />
    </div>

    <!-- Debajo de caja y Excel: pedidos sugeridos por proveedor, en grilla de cards -->
    <div class="lg:col-span-2 lg:col-start-1">
      <n-alert v-if="inbox.error" type="error" :bordered="false" :style="{ marginBottom: '12px' }">{{ inbox.error }}</n-alert>

      <!-- El día que se muestra: hoy, o la próxima visita si hoy no viene nadie -->
      <n-flex align="center" :size="6" :style="{ marginBottom: '12px' }">
        <n-text :style="{ fontSize: '18px', fontWeight: 700, textTransform: 'capitalize' }">
          {{ formatLongDay(inbox.inbox?.day ?? "") }}
        </n-text>
        <n-button quaternary circle size="small" :loading="inbox.loading" :aria-label="es.inbox.reload" @click="reload">
          <template #icon><n-icon :component="RefreshOutline" /></template>
        </n-button>
      </n-flex>

      <n-spin :show="inbox.loading">
        <!-- Tantas cards por fila como quepan (cada una de ~260px como mínimo), según el ancho disponible -->
        <n-grid v-if="vendors.length > 0" cols="1 540:2 820:3 1100:4 1380:5" :x-gap="12" :y-gap="12" responsive="self">
          <n-gi v-for="vendor in vendors" :key="vendor.sellerId">
            <n-card
              :bordered="openSellerId === vendor.sellerId"
              :hoverable="canOpen(vendor)"
              role="button"
              :tabindex="canOpen(vendor) ? 0 : -1"
              :aria-disabled="!canOpen(vendor)"
              :content-style="{ padding: '14px 16px' }"
              :style="{
                height: '100%',
                cursor: canOpen(vendor) ? 'pointer' : 'default',
                borderColor: openSellerId === vendor.sellerId ? palette.accent : undefined,
              }"
              @click="open(vendor)"
              @keydown.enter="open(vendor)"
            >
              <VendorCard
                :vendor="vendor"
                :color="segmentOf(vendor.sellerId)?.color ?? null"
                :cash-percent="segmentOf(vendor.sellerId) ? cashPercent(segmentOf(vendor.sellerId)!.amount) : null"
              />
            </n-card>
          </n-gi>
        </n-grid>
        <n-card v-else-if="!inbox.loading" :bordered="false">
          <n-empty :description="es.inbox.nobodyToday" />
        </n-card>
      </n-spin>
    </div>
  </div>

  <!-- Pedido del proveedor elegido: se edita y se confirma en un panel lateral -->
  <n-drawer :show="openVendor !== null" placement="right" :width="1100" :style="{ maxWidth: '100vw' }" @update:show="closeDrawer">
    <n-drawer-content v-if="openVendor" closable :native-scrollbar="false">
      <template #header>
        <VendorHeader :vendor="openVendor" />
      </template>
      <n-spin :show="wizard.suggestionLoading">
        <n-flex vertical :size="10">
          <VendorSummary :vendor="openVendor" :total="editor.total.value" :product-count="editor.productCount.value" />
          <!-- Pedido en tabla: del más urgente al menos, con sus alertas -->
          <SuggestionTable
            :lines="editor.lines.value"
            :units-of="editor.unitsOf"
            :disabled="wizard.suggestionLoading"
            @step="(line, delta) => editor.step(line, delta)"
            @price="(line, cost) => price(line.productId, cost)"
          />
        </n-flex>
      </n-spin>
      <template v-if="editor.lines.value.length > 0" #footer>
        <n-flex justify="space-between" align="center" :size="10" :style="{ width: '100%' }">
          <n-flex vertical :size="0">
            <n-text class="tabular-nums" :style="{ fontSize: '18px', fontWeight: 800 }">{{ formatMoney(editor.total.value) }}</n-text>
            <n-text v-if="editor.remainingCash.value !== null" depth="3" class="tabular-nums" :style="{ fontSize: '12px' }">
              {{ es.orderReview.cashAfter(formatMoney(Math.max(0, editor.remainingCash.value - editor.total.value))) }}
            </n-text>
          </n-flex>
          <n-button
            v-if="isSelectedToday"
            type="primary"
            size="large"
            :disabled="editor.productCount.value === 0 || wizard.suggestionLoading"
            @click="showSheet = true"
          >
            {{ openVendor.deliversSameDay ? es.inbox.confirmAndReceive : es.inbox.confirm }}
          </n-button>
          <!-- Otro día: se revisa, pero se confirma el día que viene el proveedor -->
          <n-tag v-else round size="large" :bordered="false">{{ es.inbox.confirmOnVisitDay(formatDay(inbox.inbox?.day ?? "")) }}</n-tag>
        </n-flex>
      </template>
    </n-drawer-content>
  </n-drawer>

  <ConfirmSheet
    :show="showSheet"
    :supplier-name="openVendor?.supplierName ?? ''"
    :total-cost="editor.total.value"
    :product-count="editor.productCount.value"
    :delivers-same-day="openVendor?.deliversSameDay ?? false"
    :expected-delivery-day="openVendor?.expectedDeliveryDay ?? ''"
    :cash-left="editor.remainingCash.value === null ? null : editor.remainingCash.value - editor.total.value"
    :loading="confirming"
    @confirm="confirm"
    @close="showSheet = false"
  />
</template>
