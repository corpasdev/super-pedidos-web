<script setup lang="ts">
import { computed, ref } from "vue"
import type { DataTableColumns } from "naive-ui"
import { Car, Checkmark, CheckmarkCircle, Copy, LogoWhatsapp, Add } from "@vicons/ionicons5"
import { useWizardStore } from "../../../stores/wizardStore"
import { es } from "../../../i18n/es"
import { formatMoney, interpolateParams, shortId } from "../../../i18n/format"
import { tablePagination, totalLabel } from "../../tables"

const wizard = useWizardStore()
const emit = defineEmits<{ restart: [] }>()

const copied = ref(false)
const receiveError = ref<string | null>(null)

const statusLabel = computed<string>(
  () =>
    (es.orderStatus as unknown as Record<string, string>)[wizard.suggestion?.status ?? ""] ?? wizard.suggestion?.status ?? "",
)

const statusMessage = computed<string>(() => {
  const suggestion = wizard.suggestion
  if (suggestion === null) return ""
  const template = (es.statusExplanation as unknown as Record<string, string>)[suggestion.statusExplanation.key]
  return interpolateParams(template ?? suggestion.statusExplanation.key, suggestion.statusExplanation.params)
})

const productNames = computed<Record<string, string>>(() => {
  const names: Record<string, string> = {}
  for (const group of wizard.suggestion?.groups ?? []) {
    for (const line of group.lines) names[line.productId] = line.productName
  }
  return names
})

interface DeliveredRow {
  productId: string
  unitsDelivered: number
}

const deliveredPagination = tablePagination()

const deliveredColumns: DataTableColumns<DeliveredRow> = [
  {
    key: "product",
    title: es.sendStep.deliveredColumns.product,
    render: (row) => productNames.value[row.productId] ?? row.productId,
  },
  {
    key: "unitsDelivered",
    title: es.sendStep.deliveredColumns.units,
    align: "right",
    render: (row) => `${row.unitsDelivered} u`,
  },
]

async function handleCopy(): Promise<void> {
  if (wizard.suggestion === null) return
  try {
    await navigator.clipboard.writeText(wizard.suggestion.plainText)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // sin permiso de portapapeles: el texto queda visible para copiar a mano
  }
}

function openWhatsApp(): void {
  if (wizard.suggestion === null) return
  window.open(`https://wa.me/?text=${encodeURIComponent(wizard.suggestion.plainText)}`, "_blank", "noopener")
}

async function handleReceive(): Promise<void> {
  receiveError.value = null
  try {
    await wizard.receiveOrder()
  } catch (error) {
    receiveError.value = error instanceof Error ? error.message : es.common.error
  }
}
</script>

<template>
  <div v-if="wizard.order" class="flex flex-col gap-5">
    <div class="flex flex-col gap-5">
      <div class="rounded-xl border border-success bg-success/5 p-5 flex flex-col gap-2">
        <div class="flex items-center gap-3">
          <span class="text-success"><n-icon :component="CheckmarkCircle" size="28" /></span>
          <div class="flex flex-col">
            <h2 class="font-semibold text-surface-900">{{ es.sendStep.title }}</h2>
            <p class="text-xs text-surface-500">{{ es.sendStep.hint }}</p>
          </div>
        </div>
        <dl class="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div>
            <dt class="text-xs text-surface-500">{{ es.sendStep.orderId }}</dt>
            <dd class="font-mono text-surface-800">{{ shortId(wizard.order.id) }}</dd>
          </div>
          <div>
            <dt class="text-xs text-surface-500">{{ es.summary.final }}</dt>
            <dd class="font-semibold text-surface-900">{{ formatMoney(wizard.order.totalCost) }}</dd>
          </div>
          <div class="flex items-center gap-2">
            <dt class="text-xs text-surface-500">{{ es.summary.remaining }}</dt>
            <dd><n-tag round :type="wizard.suggestion?.status === 'over_budget' ? 'error' : 'success'">{{ statusLabel }}</n-tag></dd>
          </div>
        </dl>
        <p class="text-sm text-surface-700">{{ statusMessage }}</p>
      </div>

      <div class="rounded-xl border border-surface bg-surface-0 p-4 flex flex-col gap-3">
        <h3 class="text-sm font-semibold text-surface-800">{{ es.reviewStep.title }}</h3>
        <textarea
          readonly
          rows="10"
          class="w-full rounded-lg border border-surface bg-surface-50 p-3 text-sm font-mono text-surface-800 resize-y"
          :value="wizard.suggestion?.plainText ?? ''"
        ></textarea>
        <div class="flex flex-wrap gap-2">
          <n-button secondary @click="handleCopy">
            <template #icon><n-icon :component="copied ? Checkmark : Copy" /></template>
            {{ copied ? es.sendStep.copied : es.sendStep.copy }}
          </n-button>
          <n-button type="success" @click="openWhatsApp">
            <template #icon><n-icon :component="LogoWhatsapp" /></template>
            {{ es.sendStep.whatsapp }}
          </n-button>
        </div>
      </div>

      <div v-if="wizard.receiveDelivery === null" class="flex flex-col gap-2">
        <n-alert v-if="receiveError !== null" type="error">
          {{ receiveError }}
        </n-alert>
        <n-button
          type="success"
          secondary
          class="self-start"
          @click="handleReceive"
        >
          <template #icon><n-icon :component="Car" /></template>
          {{ es.sendStep.receive }}
        </n-button>
      </div>

      <div v-else class="rounded-xl border border-surface bg-surface-0 p-4 flex flex-col gap-2">
        <n-flex justify="space-between" align="center">
          <div class="flex items-center gap-2 text-success">
            <n-icon :component="CheckmarkCircle" />
            <span class="text-sm font-medium">{{ es.sendStep.receiveSuccess }}</span>
          </div>
          <n-tag round :bordered="false">{{ totalLabel(wizard.receiveDelivery.products.length, "product") }}</n-tag>
        </n-flex>
        <n-data-table
          :columns="deliveredColumns"
          :data="wizard.receiveDelivery.products"
          :pagination="deliveredPagination"
          :row-key="(row: DeliveredRow) => row.productId"
          size="small"
        />
      </div>

      <div class="flex justify-end">
        <n-button secondary @click="wizard.reset(); emit('restart')">
          <template #icon><n-icon :component="Add" /></template>
          {{ es.sendStep.newOrder }}
        </n-button>
      </div>
    </div>
  </div>
</template>