<script setup lang="ts">
import { computed, h, onMounted, ref } from "vue"
import { NFlex, NText, type DataTableColumns } from "naive-ui"
import { CheckmarkCircle } from "@vicons/ionicons5"
import { useQualityStore } from "../../stores/qualityStore"
import { es } from "../../i18n/es"
import type { DataQualityIssueItem } from "../../infrastructure/apiTypes"
import { tablePagination, totalLabel } from "../tables"

const quality = useQualityStore()
const selectedCode = ref<string | null>(null)

onMounted(async () => {
  await quality.loadIssues()
})

interface IssueMeta {
  label: string
  hint: string
}

const issueMeta = (code: string): IssueMeta => {
  const meta = (es.quality.issues as unknown as Record<string, IssueMeta>)[code]
  return meta ?? { label: code, hint: "" }
}

const codes = computed<string[]>(() =>
  [...new Set(quality.issues.map((i) => i.issueCode))].sort(
    (a, b) => (quality.byCode[b] ?? 0) - (quality.byCode[a] ?? 0),
  ),
)

type IssueRow = DataQualityIssueItem & { rowId: number }

/** Cada fila lleva su posición como clave: dos problemas pueden repetir código y producto. */
const filteredIssues = computed<IssueRow[]>(() =>
  quality.issues
    .map((issue, index) => ({ ...issue, rowId: index }))
    .filter((issue) => selectedCode.value === null || issue.issueCode === selectedCode.value),
)

const pagination = tablePagination()

const issueKey = (issue: IssueRow): number => issue.rowId

const columns: DataTableColumns<IssueRow> = [
  {
    key: "barcode",
    title: es.quality.table.barcode,
    width: 170,
    render: (issue) => h(NText, { style: { fontFamily: "ui-monospace, monospace" } }, () => issue.barcode ?? "—"),
  },
  {
    key: "description",
    title: es.quality.table.description,
    minWidth: 260,
    render: (issue) =>
      h(NFlex, { vertical: true, size: 0 }, () => [
        h(NText, null, () => issue.description),
        h(NText, { depth: 3, style: { fontSize: "11px" } }, () => issueMeta(issue.issueCode).label),
      ]),
  },
  { key: "originalValue", title: es.quality.table.original, render: (issue) => issue.originalValue ?? "—" },
]
</script>

<template>
  <div class="flex flex-col gap-4">
    <header class="flex flex-col gap-1">
      <h1 class="text-lg md:text-xl font-semibold text-surface-900">{{ es.quality.title }}</h1>
      <p class="text-sm text-surface-500">{{ es.quality.subtitle }}</p>
    </header>

    <p v-if="quality.loading" class="text-sm text-surface-500">{{ es.common.loading }}</p>
    <n-alert v-else-if="quality.error !== null" type="error">
      {{ quality.error }}
    </n-alert>

    <template v-else-if="quality.issues.length > 0">
      <section class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <article
          v-for="code in codes"
          :key="code"
          class="rounded-xl border border-surface bg-surface-0 p-4 flex flex-col gap-1"
        >
          <div class="flex items-center justify-between gap-2">
            <h3 class="font-medium text-surface-900 text-sm">{{ issueMeta(code).label }}</h3>
            <n-tag round type="warning">{{ es.quality.countLabel(quality.byCode[code] ?? 0) }}</n-tag>
          </div>
          <p class="text-xs text-surface-500 leading-relaxed">{{ issueMeta(code).hint }}</p>
        </article>
      </section>

      <div class="flex flex-wrap items-center gap-2">
        <n-button
          size="small"
          :type="selectedCode === null ? 'primary' : 'default'"
          :secondary="selectedCode !== null"
          @click="selectedCode = null"
        >
          {{ es.quality.all }}
        </n-button>
        <n-button
          v-for="code in codes"
          :key="code"
          size="small"
          :type="selectedCode === code ? 'primary' : 'default'"
          :secondary="selectedCode !== code"
          @click="selectedCode = code"
        >
          {{ `${issueMeta(code).label} (${quality.byCode[code] ?? 0})` }}
        </n-button>
      </div>

      <n-card :bordered="false">
        <template #header>
          <n-text :style="{ fontSize: '16px', fontWeight: 500 }">
            {{ selectedCode === null ? es.quality.all : issueMeta(selectedCode).label }}
          </n-text>
        </template>
        <template #header-extra>
          <n-tag round :bordered="false">{{ totalLabel(filteredIssues.length, "issue") }}</n-tag>
        </template>
        <n-data-table
          :columns="columns"
          :data="filteredIssues"
          :pagination="pagination"
          :row-key="issueKey"
          :scroll-x="640"
          :bordered="false"
        >
          <template #empty>
            <n-empty :description="es.quality.empty" />
          </template>
        </n-data-table>
      </n-card>
    </template>

    <div v-else class="rounded-xl border border-surface bg-surface-0 p-8 text-center text-surface-500">
      <div class="flex justify-center text-success mb-2"><n-icon :component="CheckmarkCircle" size="28" /></div>
      <p class="text-sm">{{ es.quality.noIssues }}</p>
    </div>
  </div>
</template>