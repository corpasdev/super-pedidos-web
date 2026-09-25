<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue"
import { motion, AnimatePresence } from "motion-v"
import { ArrowBack, ArrowForward, Calculator } from "@vicons/ionicons5"
import { useWizardStore } from "../../stores/wizardStore"
import { useSessionStore } from "../../stores/sessionStore"
import { es } from "../../i18n/es"
import SupplierStep from "../components/wizard/SupplierStep.vue"
import SalesReportStep from "../components/wizard/SalesReportStep.vue"
import BudgetStep from "../components/wizard/BudgetStep.vue"
import ReviewStep from "../components/wizard/ReviewStep.vue"
import SendStep from "../components/wizard/SendStep.vue"
import OrderSummaryPanel from "../components/wizard/OrderSummaryPanel.vue"

const wizard = useWizardStore()
const session = useSessionStore()

const stepKeys = ["supplier", "report", "budget", "review", "send"] as const
type StepKey = (typeof stepKeys)[number]

const stepsModel = computed(() =>
  stepKeys.map((key) => ({
    label: (es.wizard.steps as Record<StepKey, string>)[key],
  })),
)

const activeIndex = ref(0)

const canProceed = computed<boolean>(() => {
  switch (stepKeys[activeIndex.value]) {
    case "supplier":
      return wizard.selectedSupplierId !== null
    case "report":
    case "budget":
    case "review":
      return true
    case "send":
      return false
    default:
      return false
  }
})

const isBuilding = computed(() => wizard.suggestionLoading)

onMounted(async () => {
  if (wizard.suppliers.length === 0) await wizard.loadSuppliers()
})

function handleStepChange(next: number): void {
  if (next < activeIndex.value) {
    activeIndex.value = next
    return
  }
  if (next === activeIndex.value + 1 && canProceed.value) {
    activeIndex.value = next
  }
}

async function handleNext(): Promise<void> {
  if (activeIndex.value === 2) {
    try {
      await wizard.buildSuggestion()
      if (wizard.suggestion !== null) activeIndex.value = 3
    } catch {
      // wizard.actionError ya muestra el problema en la vista
    }
    return
  }
  if (canProceed.value) activeIndex.value += 1
}

watch(
  () => wizard.order,
  (order) => {
    if (order !== null) activeIndex.value = 4
  },
)
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
    <div class="flex flex-col gap-6 max-w-none min-w-0">
      <header class="flex flex-col gap-1">
        <div class="flex items-baseline justify-between gap-4 flex-wrap">
          <h1 class="text-lg md:text-xl font-semibold text-surface-900">{{ es.wizard.title }}</h1>
          <p v-if="session.store" class="text-sm text-surface-500">{{ session.store.name }}</p>
        </div>
        <p class="text-sm text-surface-500">{{ es.wizard.subtitle }}</p>
      </header>

      <n-steps :current="activeIndex" size="small" @update:current="handleStepChange">
        <n-step v-for="step in stepsModel" :key="step.label" :title="step.label" />
      </n-steps>

      <n-alert
        v-if="wizard.actionError !== null"
        type="error"
        closable
        @close="wizard.actionError = null"
      >
        {{ wizard.actionError }}
      </n-alert>

      <AnimatePresence mode="wait">
        <motion.section
          :key="activeIndex"
          :initial="{ opacity: 0, x: 16 }"
          :animate="{ opacity: 1, x: 0 }"
          :exit="{ opacity: 0, x: -16 }"
          :transition="{ duration: 0.2 }"
        >
          <component
            :is="stepKeys[activeIndex] === 'supplier' ? SupplierStep : stepKeys[activeIndex] === 'report' ? SalesReportStep : stepKeys[activeIndex] === 'budget' ? BudgetStep : stepKeys[activeIndex] === 'review' ? ReviewStep : SendStep"
            @restart="activeIndex = 0"
          />
        </motion.section>
      </AnimatePresence>

      <footer v-if="activeIndex < 3" class="flex items-center justify-between gap-3 border-t border-surface pt-4">
        <n-button secondary :disabled="activeIndex === 0" @click="activeIndex -= 1">
          <template #icon><n-icon :component="ArrowBack" /></template>
          {{ es.common.back }}
        </n-button>
        <n-button
          v-if="activeIndex === 2"
          type="primary"
          :loading="isBuilding"
          :disabled="!canProceed || isBuilding"
          @click="handleNext"
        >
          <template #icon><n-icon :component="Calculator" /></template>
          {{ es.reviewStep.building }}
        </n-button>
        <n-button
          v-else
          type="primary"
          icon-placement="right"
          :disabled="!canProceed"
          @click="handleNext"
        >
          {{ es.common.continue }}
          <template #icon><n-icon :component="ArrowForward" /></template>
        </n-button>
      </footer>
    </div>

    <OrderSummaryPanel v-if="wizard.suggestion !== null" :suggestion="wizard.suggestion" :owner-units="wizard.ownerUnits" :budget="wizard.orderBudget" />
  </div>
</template>