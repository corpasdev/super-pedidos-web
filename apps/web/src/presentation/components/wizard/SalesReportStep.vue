<script setup lang="ts">
import { onMounted, ref } from "vue"
import { CloudUpload } from "@vicons/ionicons5"
import { useWizardStore } from "../../../stores/wizardStore"
import { es } from "../../../i18n/es"
import { formatDate } from "../../../i18n/format"
import type { SalesReportItem } from "../../../infrastructure/apiTypes"

const wizard = useWizardStore()
const fileInput = ref<HTMLInputElement | null>(null)
const uploadError = ref<string | null>(null)

onMounted(async () => {
  await wizard.loadLatestReport()
})

async function handleFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file === undefined) return
  uploadError.value = null
  try {
    await wizard.uploadReport(file)
  } catch (error) {
    uploadError.value = error instanceof Error ? error.message : es.common.error
  } finally {
    input.value = ""
  }
}

const periodLabel = (report: SalesReportItem): string =>
  report.period ? `${formatDate(report.period.startsAt)} – ${formatDate(report.period.endsAt)} · ${report.period.coveredDays} d` : report.fileName
</script>

<template>
  <div class="flex flex-col gap-5">
    <p class="text-sm text-surface-600">{{ es.reportStep.title }}</p>

    <n-radio-group v-model:value="wizard.reportChoice" class="flex flex-col gap-3">
      <n-radio
        :value="'latest'"
        :disabled="wizard.latestReport === null"
        size="large"
        :class="[
          'rounded-xl border p-4 items-start transition-colors',
          wizard.reportChoice === 'latest' ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-surface bg-surface-0',
          wizard.latestReport === null && 'opacity-50',
        ]"
      >
        <span class="font-medium text-surface-900">{{ es.reportStep.latestOption }}</span>
        <p v-if="wizard.latestReport" class="text-xs text-surface-500 mt-1">
          {{ wizard.latestReport.fileName }} · {{ periodLabel(wizard.latestReport) }} · {{ es.reportStep.lines(wizard.latestReport.lineCount) }} · {{ es.reportStep.totalUnits(wizard.latestReport.totalUnits) }}
        </p>
        <p v-else class="text-xs text-surface-500 mt-1">{{ es.reportStep.latestEmpty }}</p>
      </n-radio>

      <n-radio
        :value="'uploaded'"
        size="large"
        :class="[
          'rounded-xl border p-4 items-start transition-colors',
          wizard.reportChoice === 'uploaded' ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-surface bg-surface-0',
        ]"
      >
        <div class="flex flex-col gap-2 w-full">
          <span class="font-medium text-surface-900">{{ es.reportStep.uploadOption }}</span>
          <p class="text-xs text-surface-500">{{ es.reportStep.uploadHint }}</p>

          <div class="flex items-center gap-3">
            <input ref="fileInput" type="file" accept=".xlsx,.xls,.csv" class="hidden" @change="handleFileChange" />
            <n-button size="small" :loading="wizard.reportLoading" @click="fileInput?.click()">
              <template #icon><n-icon :component="CloudUpload" /></template>
              {{ es.reportStep.pickFile }}
            </n-button>
            <span class="text-xs text-surface-500">
              {{ wizard.uploadedReport ? es.reportStep.fileName(wizard.uploadedReport.fileName) : es.reportStep.noFileChosen }}
            </span>
          </div>

          <p v-if="wizard.uploadedReport" class="text-xs text-surface-600">
            {{ periodLabel(wizard.uploadedReport) }} · {{ es.reportStep.lines(wizard.uploadedReport.lineCount) }} · {{ es.reportStep.totalUnits(wizard.uploadedReport.totalUnits) }}
          </p>
          <n-alert v-if="wizard.unmatchedSalesCount > 0 && wizard.reportChoice === 'uploaded'" type="warning">
            {{ es.reportStep.unmatched(wizard.unmatchedSalesCount) }}
          </n-alert>
          <n-alert v-if="uploadError !== null" type="error">
            {{ uploadError }}
          </n-alert>
        </div>
      </n-radio>

      <n-radio
        :value="'none'"
        size="large"
        :class="[
          'rounded-xl border p-4 items-start transition-colors',
          wizard.reportChoice === 'none' ? 'border-primary ring-2 ring-primary/30 bg-primary/5' : 'border-surface bg-surface-0',
        ]"
      >
        <span class="font-medium text-surface-900">{{ es.reportStep.noneOption }}</span>
      </n-radio>
    </n-radio-group>
  </div>
</template>