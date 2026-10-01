<script setup lang="ts">
import { computed, onMounted } from "vue"
import { useMessage, type UploadCustomRequestOptions, type UploadFileInfo } from "naive-ui"
import { CheckmarkCircle, CloudUploadOutline, DocumentTextOutline, SwapHorizontalOutline, TrashOutline } from "@vicons/ionicons5"
import { useWizardStore } from "../../../stores/wizardStore"
import { radius } from "../../../theme/naiveOverrides"
import { es } from "../../../i18n/es"
import { formatDate } from "../../../i18n/format"

/**
 * Tile del Excel de ventas (segundo del patrón F). Dos estados:
 * sin Excel → zona para soltar o elegir el archivo; con Excel → "Cargado" con el archivo, sus fechas
 * y acciones para reemplazarlo o quitarlo. Cualquier cambio recalcula los sugeridos (emit changed).
 */
const emit = defineEmits<{ changed: [] }>()
const wizard = useWizardStore()
const message = useMessage()

const EXCEL_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]

const report = computed(() => wizard.latestReport)
const period = computed(() =>
  report.value === null ? "" : es.inbox.salesLoaded(formatDate(report.value.period.startsAt), formatDate(report.value.period.endsAt)),
)

onMounted(async () => {
  await wizard.loadLatestReport().catch(() => undefined)
})

const isExcel = (file: File): boolean => EXCEL_TYPES.includes(file.type) || /\.xlsx?$/i.test(file.name)

function beforeUpload({ file }: { file: UploadFileInfo }): boolean {
  if (file.file && !isExcel(file.file)) {
    message.warning(es.inbox.salesWrongType)
    return false
  }
  return true
}

function notifyLoaded(): void {
  const uploaded = wizard.uploadedReport
  if (uploaded) message.success(es.inbox.salesUploaded(uploaded.lineCount, uploaded.totalUnits), { duration: 5000 })
  if (wizard.unmatchedSalesCount > 0) message.warning(es.inbox.salesUnmatched(wizard.unmatchedSalesCount), { duration: 6000 })
}

/** Primer Excel (o uno nuevo sin reemplazar nada). */
async function upload({ file, onFinish, onError }: UploadCustomRequestOptions): Promise<void> {
  if (!file.file) return onError()
  try {
    await wizard.uploadReport(file.file)
    await wizard.loadLatestReport()
    onFinish()
    notifyLoaded()
    emit("changed")
  } catch (error) {
    onError()
    message.error(error instanceof Error ? error.message : es.inbox.salesFailed)
  }
}

/** Reemplaza el Excel cargado por otro. */
async function replace({ file, onFinish, onError }: UploadCustomRequestOptions): Promise<void> {
  if (!file.file || report.value === null) return onError()
  try {
    await wizard.replaceReport(report.value.id, file.file)
    onFinish()
    notifyLoaded()
    emit("changed")
  } catch (error) {
    onError()
    message.error(error instanceof Error ? error.message : es.inbox.salesFailed)
  }
}

async function remove(): Promise<void> {
  if (report.value === null) return
  try {
    await wizard.removeReport(report.value.id)
    message.success(es.inbox.salesRemoved)
    emit("changed")
  } catch (error) {
    message.error(error instanceof Error ? error.message : es.inbox.salesFailed)
  }
}

const tileTitleStyle = { fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }
</script>

<template>
  <n-card :bordered="false" :style="{ height: '100%' }" :content-style="{ padding: '14px 16px' }">
    <n-spin :show="wizard.reportLoading" :style="{ height: '100%' }">
      <n-flex vertical :size="10" :style="{ height: '100%' }">
        <n-flex align="center" :size="8" :wrap="false">
          <n-icon :component="DocumentTextOutline" :size="18" color="var(--data)" />
          <n-text :style="tileTitleStyle">{{ es.inbox.salesTitle }}</n-text>
          <n-tag v-if="report" round size="small" type="success" :bordered="false" :style="{ marginLeft: 'auto' }">
            <template #icon><n-icon :component="CheckmarkCircle" /></template>
            {{ es.inbox.salesLoadedTag }}
          </n-tag>
        </n-flex>

        <!-- Con Excel: el archivo cargado y sus acciones -->
        <template v-if="report">
          <n-card embedded :bordered="false" size="small" :style="{ borderRadius: radius.md }" :content-style="{ padding: '10px 12px' }">
            <n-flex vertical :size="2">
              <n-ellipsis :style="{ fontWeight: 700 }">{{ report.fileName }}</n-ellipsis>
              <n-text depth="3" class="tabular-nums" :style="{ fontSize: '12px' }">
                {{ period }} · {{ es.inbox.salesStats(report.lineCount, report.totalUnits) }}
              </n-text>
            </n-flex>
          </n-card>
          <n-flex :size="8">
            <n-upload :custom-request="replace" :show-file-list="false" accept=".xlsx,.xls" @before-upload="beforeUpload">
              <n-button secondary>
                <template #icon><n-icon :component="SwapHorizontalOutline" /></template>
                {{ es.inbox.salesReplace }}
              </n-button>
            </n-upload>
            <n-button secondary type="error" @click="remove">
              <template #icon><n-icon :component="TrashOutline" /></template>
              {{ es.inbox.salesRemove }}
            </n-button>
          </n-flex>
        </template>

        <!-- Sin Excel: zona para soltar o elegir el archivo -->
        <n-upload
          v-else
          :custom-request="upload"
          :show-file-list="false"
          accept=".xlsx,.xls"
          :style="{ flex: 1 }"
          @before-upload="beforeUpload"
        >
          <n-upload-dragger :style="{ borderRadius: radius.md, background: 'var(--surface)', padding: '14px', height: '100%' }">
            <n-flex vertical align="center" justify="center" :size="6" :style="{ height: '100%' }">
              <n-icon :component="CloudUploadOutline" :size="28" color="var(--data)" />
              <n-text :style="{ fontSize: '13px' }">{{ es.inbox.salesDropShort }}</n-text>
            </n-flex>
          </n-upload-dragger>
        </n-upload>
      </n-flex>
    </n-spin>
  </n-card>
</template>
