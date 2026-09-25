import { computed, ref } from "vue"
import { defineStore } from "pinia"
import { apiClient } from "../infrastructure/apiClient"
import type { DataQualityIssueItem } from "../infrastructure/apiTypes"

export const useQualityStore = defineStore("quality", () => {
  const issues = ref<DataQualityIssueItem[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  const byCode = computed<Record<string, number>>(() => {
    const counts: Record<string, number> = {}
    for (const issue of issues.value) {
      counts[issue.issueCode] = (counts[issue.issueCode] ?? 0) + 1
    }
    return counts
  })

  async function loadIssues(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const response = await apiClient.get<{ issues: DataQualityIssueItem[] }>("/data-quality-issues")
      issues.value = response.issues
    } catch (err) {
      error.value = err instanceof Error ? err.message : "No se pudieron cargar los problemas de datos."
    } finally {
      loading.value = false
    }
  }

  return { issues, loading, error, byCode, loadIssues }
})