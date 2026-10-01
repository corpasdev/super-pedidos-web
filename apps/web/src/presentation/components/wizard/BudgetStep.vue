<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useWizardStore } from "../../../stores/wizardStore"
import { es } from "../../../i18n/es"
import { formatMoney, moneyFormatter, moneyParser } from "../../../i18n/format"
import { moneyInputProps } from "../../numericInput"

/**
 * Paso de la plata. El sugerido usa el modelo de niveles (B < PD < T): la existencia se calcula (PD − CM),
 * así que aquí ya no se cuenta stock ni se elige modo; solo la caja del día y el límite opcional.
 */
const wizard = useWizardStore()

const cashDraft = ref<number | null>(null)
const editingCash = ref(false)

const hasCash = computed(() => wizard.dailyCash?.openingAmount !== null && wizard.dailyCash?.openingAmount !== undefined)
const showCashForm = computed(() => !hasCash.value || editingCash.value)

const minimumOrderAmount = computed(() => wizard.selectedSupplier?.minimumOrderAmount ?? 0)
const maximumOrderAmount = computed(() => wizard.selectedSupplier?.maximumOrderAmount ?? null)

/** Vista previa de la plata del pedido: el menor entre la caja que queda, el tope del proveedor y el límite propio. */
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
  wizard.replenishmentMode = "levels"
  await wizard.loadDailyCash()
})

async function saveCash(): Promise<void> {
  if (cashDraft.value === null) return
  await wizard.openDailyCash(cashDraft.value)
  editingCash.value = false
}

function startEditingCash(): void {
  cashDraft.value = wizard.dailyCash?.openingAmount ?? null
  editingCash.value = true
}
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
            :format="moneyFormatter"
            :input-props="moneyInputProps()"
            :parse="moneyParser"
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
          :format="moneyFormatter"
            :input-props="moneyInputProps()"
          :parse="moneyParser"
        />
        <p class="text-xs text-surface-500">{{ wizard.budgetPesos === null ? es.budgetStep.budgetEmptyHint : es.budgetStep.budgetHelp }}</p>
      </div>
    </section>

    <!-- Cómo decide la plata (regla del dueño) -->
    <n-alert type="info" :bordered="false" :title="es.budgetStep.levelsTitle">
      {{ es.budgetStep.levelsHint }}
    </n-alert>
  </div>
</template>
