<script setup lang="ts">
import { computed, h, onMounted, ref, watch } from "vue"
import { NFlex, NInputNumber, NTag, NText, type DataTableColumns } from "naive-ui"
import { Cube, Layers, StatsChart } from "@vicons/ionicons5"
import { useWizardStore } from "../../../stores/wizardStore"
import { es } from "../../../i18n/es"
import { formatMoney, moneyFormatter, moneyParser } from "../../../i18n/format"
import type { ProductItem } from "../../../infrastructure/apiTypes"
import { tablePagination, totalLabel } from "../../tables"

const wizard = useWizardStore()

const modes = [
  { value: "fill_to_base", label: es.budgetStep.modeBase, hint: es.budgetStep.modeBaseHint, icon: Cube },
  { value: "replenish_sold", label: es.budgetStep.modeSold, hint: es.budgetStep.modeSoldHint, icon: StatsChart },
  { value: "fill_to_target", label: es.budgetStep.modeFill, hint: es.budgetStep.modeFillHint, icon: Layers },
] as const

const cashDraft = ref<number | null>(null)
const editingCash = ref(false)
const stockDrafts = ref<Record<string, number | null>>({})
const stockFailed = ref<Record<string, boolean>>({})

const hasCash = computed(() => wizard.dailyCash?.openingAmount !== null && wizard.dailyCash?.openingAmount !== undefined)
const showCashForm = computed(() => !hasCash.value || editingCash.value)

const minimumOrderAmount = computed(() => wizard.selectedSupplier?.minimumOrderAmount ?? 0)
const maximumOrderAmount = computed(() => wizard.selectedSupplier?.maximumOrderAmount ?? null)

/** Vista previa de B: el menor entre la caja que queda, el tope del proveedor y el límite propio. */
const orderBudgetPreview = computed<number | null>(() => {
  const limits = [wizard.dailyCash?.remainingAmount ?? null, maximumOrderAmount.value, wizard.budgetPesos].filter(
    (limit): limit is number => limit !== null,
  )
  return limits.length === 0 ? null : Math.min(...limits)
})

const cashBelowMinimum = computed(
  () => orderBudgetPreview.value !== null && minimumOrderAmount.value > 0 && orderBudgetPreview.value < minimumOrderAmount.value,
)

onMounted(async () => {
  await Promise.all([wizard.loadDailyCash(), wizard.loadBaseProducts()])
})

watch(
  () => wizard.baseProducts,
  (products) => {
    stockDrafts.value = Object.fromEntries(products.map((product) => [product.id, product.stockUnits]))
  },
  { immediate: true },
)

async function saveCash(): Promise<void> {
  if (cashDraft.value === null) return
  await wizard.openDailyCash(cashDraft.value)
  editingCash.value = false
}

function startEditingCash(): void {
  cashDraft.value = wizard.dailyCash?.openingAmount ?? null
  editingCash.value = true
}

async function saveStock(productId: string): Promise<void> {
  const units = stockDrafts.value[productId]
  const current = wizard.baseProducts.find((product) => product.id === productId)
  if (units === null || units === undefined || current === undefined) return
  if (units === current.stockUnits && current.isStockReliable) return
  try {
    await wizard.countBaseProductStock(productId, units)
    stockFailed.value = { ...stockFailed.value, [productId]: false }
  } catch {
    stockFailed.value = { ...stockFailed.value, [productId]: true }
  }
}

const missingUnits = (productId: string, base: number | null): number =>
  Math.max(0, (base ?? 0) - (stockDrafts.value[productId] ?? 0))

const stockPagination = tablePagination()

const stockColumns: DataTableColumns<ProductItem> = [
  {
    key: "name",
    title: es.budgetStep.stockColumns.product,
    minWidth: 200,
    render: (product) =>
      h(NFlex, { align: "center", size: 8 }, () => [
        h(NText, null, () => product.name),
        product.isStockReliable ? h(NTag, { size: "small", round: true, type: "success", bordered: false }, () => es.budgetStep.stockCounted) : null,
        stockFailed.value[product.id] ? h(NText, { type: "error", style: { fontSize: "11px" } }, () => es.budgetStep.stockSaveFailed) : null,
      ]),
  },
  { key: "maxStockUnits", title: es.budgetStep.stockColumns.base, align: "right", width: 90 },
  {
    key: "stock",
    title: es.budgetStep.stockColumns.stock,
    align: "right",
    width: 120,
    render: (product) =>
      h(NInputNumber, {
        id: `stock-${product.id}`,
        value: stockDrafts.value[product.id] ?? null,
        min: 0,
        precision: 0,
        showButton: false,
        size: "small",
        "onUpdate:value": (value: number | null) => {
          stockDrafts.value = { ...stockDrafts.value, [product.id]: value }
        },
        onBlur: () => saveStock(product.id),
      }),
  },
  {
    key: "missing",
    title: es.budgetStep.stockColumns.missing,
    align: "right",
    width: 90,
    render: (product) => h(NText, { style: { fontWeight: 500 } }, () => String(missingUnits(product.id, product.maxStockUnits))),
  },
]
</script>

<template>
  <div class="flex flex-col gap-6">
    <!-- Caja de hoy -->
    <section class="flex flex-col gap-3">
      <div class="flex items-center justify-between gap-3">
        <h3 class="text-sm font-semibold text-surface-700">{{ es.budgetStep.cashTitle }}</h3>
        <n-button v-if="hasCash && !editingCash" size="small" quaternary @click="startEditingCash">{{ es.budgetStep.cashEdit }}</n-button>
      </div>
      <p class="text-xs text-surface-500 max-w-prose">{{ es.budgetStep.cashHint }}</p>

      <div v-if="showCashForm" class="flex flex-wrap items-end gap-3">
        <div class="flex flex-col gap-1 w-56">
          <label for="cash-input" class="text-xs font-medium text-surface-600">{{ es.budgetStep.cashInputLabel }}</label>
          <n-input-number
            id="cash-input"
            v-model:value="cashDraft"
            :min="0"
            :precision="0"
            :show-button="false"
            :formatter="moneyFormatter"
            :parser="moneyParser"
          />
        </div>
        <n-button type="primary" :loading="wizard.dailyCashLoading" :disabled="cashDraft === null" @click="saveCash">
          {{ es.budgetStep.cashSave }}
        </n-button>
      </div>

      <dl v-if="hasCash && !editingCash" class="grid grid-cols-3 gap-3 max-w-xl">
        <div class="rounded-lg border border-surface p-3">
          <dt class="text-xs text-surface-500">{{ es.budgetStep.cashOpening }}</dt>
          <dd class="font-medium text-surface-900 tabular-nums">{{ formatMoney(wizard.dailyCash?.openingAmount ?? 0) }}</dd>
        </div>
        <div class="rounded-lg border border-surface p-3">
          <dt class="text-xs text-surface-500">{{ es.budgetStep.cashSpent }}</dt>
          <dd class="font-medium text-surface-900 tabular-nums">{{ formatMoney(wizard.dailyCash?.spentAmount ?? 0) }}</dd>
        </div>
        <div class="rounded-lg border border-primary p-3">
          <dt class="text-xs text-surface-500">{{ es.budgetStep.cashRemaining }}</dt>
          <dd class="font-semibold text-primary tabular-nums">{{ formatMoney(wizard.dailyCash?.remainingAmount ?? 0) }}</dd>
        </div>
      </dl>
      <p v-if="!hasCash" class="text-xs font-medium text-surface-600">{{ es.budgetStep.cashMissing }}</p>
    </section>

    <!-- Plata del pedido -->
    <section class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold text-surface-700">{{ es.budgetStep.rangeTitle }}</h3>
      <p class="text-lg font-semibold text-surface-900 tabular-nums">
        {{ orderBudgetPreview === null ? es.budgetStep.orderBudgetUnlimited : es.budgetStep.orderBudget(formatMoney(orderBudgetPreview)) }}
      </p>
      <p class="text-xs text-surface-500">
        {{
          maximumOrderAmount === null
            ? es.budgetStep.rangeNoMax(formatMoney(minimumOrderAmount))
            : es.budgetStep.rangeLine(formatMoney(minimumOrderAmount), formatMoney(maximumOrderAmount))
        }}
      </p>
      <n-alert v-if="cashBelowMinimum" type="warning" :show-icon="false">
        {{ es.budgetStep.belowMinimumCash(formatMoney(minimumOrderAmount)) }}
      </n-alert>
      <div class="flex flex-col gap-1 max-w-sm pt-2">
        <label for="budget-input" class="text-xs font-medium text-surface-600">{{ es.budgetStep.budgetLabel }}</label>
        <n-input-number
          id="budget-input"
          v-model:value="wizard.budgetPesos"
          :min="0"
          :precision="0"
          :show-button="false"
          :formatter="moneyFormatter"
          :parser="moneyParser"
        />
        <p class="text-xs text-surface-500">{{ wizard.budgetPesos === null ? es.budgetStep.budgetEmptyHint : es.budgetStep.budgetHelp }}</p>
      </div>
    </section>

    <!-- Modo -->
    <section class="flex flex-col gap-2">
      <h3 class="text-sm font-semibold text-surface-700">{{ es.budgetStep.modeLabel }}</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button
          v-for="mode in modes"
          :key="mode.value"
          type="button"
          :class="[
            'rounded-xl border p-4 text-left flex flex-col gap-2 cursor-pointer transition-colors',
            wizard.replenishmentMode === mode.value ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-surface bg-surface-0 hover:border-primary',
          ]"
          @click="wizard.replenishmentMode = mode.value"
        >
          <div class="flex items-center gap-2">
            <span class="text-primary"><n-icon :component="mode.icon" size="18" /></span>
            <span class="font-medium text-surface-900">{{ mode.label }}</span>
          </div>
          <p class="text-xs text-surface-500">{{ mode.hint }}</p>
        </button>
      </div>
    </section>

    <!-- Existencias -->
    <section v-if="wizard.replenishmentMode === 'fill_to_base'" class="flex flex-col gap-2">
      <n-flex justify="space-between" align="center">
        <h3 class="text-sm font-semibold text-surface-700">{{ es.budgetStep.stockTitle }}</h3>
        <n-tag round :bordered="false">{{ totalLabel(wizard.baseProducts.length, "product") }}</n-tag>
      </n-flex>
      <p class="text-xs text-surface-500 max-w-prose">{{ es.budgetStep.stockHint }}</p>
      <n-data-table
        :columns="stockColumns"
        :data="wizard.baseProducts"
        :loading="wizard.baseProductsLoading"
        :pagination="stockPagination"
        :row-key="(product: ProductItem) => product.id"
        :scroll-x="520"
        size="small"
      >
        <template #empty>
          <n-empty :description="es.budgetStep.stockEmpty" />
        </template>
      </n-data-table>
    </section>
  </div>
</template>
