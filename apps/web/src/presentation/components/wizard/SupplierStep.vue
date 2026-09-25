<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useWizardStore } from "../../../stores/wizardStore"
import { es } from "../../../i18n/es"
import type { SupplierListItem } from "../../../infrastructure/apiTypes"
import SupplierCard from "./SupplierCard.vue"

const wizard = useWizardStore()
const search = ref("")

onMounted(async () => {
  if (wizard.suppliers.length === 0) await wizard.loadSuppliers()
})

const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  const source = term === "" ? wizard.suppliers : wizard.suppliers.filter((s: SupplierListItem) => s.name.toLowerCase().includes(term))
  return [...source].sort((a, b) => {
    const byVisiting = Number(b.isVisitingToday) - Number(a.isVisitingToday)
    if (byVisiting !== 0) return byVisiting
    const nextA = a.nextOrderDate ?? "9999-99-99"
    const nextB = b.nextOrderDate ?? "9999-99-99"
    return nextA.localeCompare(nextB)
  })
})

const visiting = computed(() => filtered.value.filter((s) => s.isVisitingToday))
const upcoming = computed(() => filtered.value.filter((s) => !s.isVisitingToday))

function select(supplier: SupplierListItem): void {
  wizard.selectedSupplierId = supplier.id
  wizard.actionError = null
}
</script>

<template>
  <div class="flex flex-col gap-4">
    <n-input v-model:value="search" :placeholder="es.supplierStep.search" clearable />

    <p v-if="wizard.suppliersLoading" class="text-sm text-surface-500">{{ es.common.loading }}</p>
    <n-alert v-else-if="wizard.suppliersLoadError !== null" type="error">
      {{ wizard.suppliersLoadError }}
    </n-alert>

    <template v-else>
      <section v-if="visiting.length > 0" class="flex flex-col gap-3">
        <h3 class="text-sm font-semibold text-surface-700">{{ es.supplierStep.visitingToday }}</h3>
        <ul class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <li v-for="supplier in visiting" :key="supplier.id">
            <SupplierCard :supplier="supplier" :selected="wizard.selectedSupplierId === supplier.id" @select="select(supplier)" />
          </li>
        </ul>
      </section>

      <section v-if="upcoming.length > 0" class="flex flex-col gap-3">
        <h3 class="text-sm font-semibold text-surface-700">{{ es.supplierStep.visitingSoon }}</h3>
        <ul class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <li v-for="supplier in upcoming" :key="supplier.id">
            <SupplierCard :supplier="supplier" :selected="wizard.selectedSupplierId === supplier.id" @select="select(supplier)" />
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>