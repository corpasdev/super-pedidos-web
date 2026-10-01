<script setup lang="ts">
import { computed, reactive, ref, watch } from "vue"
import { useMessage, type FormInst, type FormRules } from "naive-ui"
import { apiClient } from "../../../infrastructure/apiClient"
import { es } from "../../../i18n/es"
import { moneyFormatter, moneyParser } from "../../../i18n/format"
import { moneyInputProps, unitsInputProps } from "../../numericInput"

/** Formulario para registrar un producto a mano (fuera del catálogo importado). */
const props = defineProps<{
  show: boolean
  suppliers: { id: string; name: string }[]
  categories: string[]
}>()
const emit = defineEmits<{ close: []; created: [] }>()

const message = useMessage()
const formRef = ref<FormInst | null>(null)
const saving = ref(false)

const emptyForm = () => ({
  barcode: "",
  name: "",
  category: null as string | null,
  supplierId: null as string | null,
  unitCost: null as number | null,
  salePrice: null as number | null,
  stockUnits: 0 as number | null,
  minStockUnits: null as number | null,
  maxStockUnits: null as number | null,
})
const form = reactive(emptyForm())

watch(
  () => props.show,
  (show) => {
    if (show) Object.assign(form, emptyForm())
  },
)

const supplierOptions = computed(() => props.suppliers.map((supplier) => ({ label: supplier.name, value: supplier.id })))
const categoryOptions = computed(() => props.categories.map((category) => ({ label: category, value: category })))

const required = { required: true, message: es.catalogEntry.required, trigger: ["blur", "change"] }
const rules: FormRules = {
  barcode: required,
  name: required,
  category: required,
  salePrice: { ...required, type: "number" },
}

async function submit(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    await apiClient.post<{ id: string }>("/products", {
      barcode: form.barcode,
      name: form.name,
      category: form.category,
      supplierId: form.supplierId,
      salePrice: form.salePrice,
      unitCost: form.unitCost,
      stockUnits: form.stockUnits ?? 0,
      minStockUnits: form.minStockUnits,
      maxStockUnits: form.maxStockUnits,
    })
    message.success(es.catalogEntry.productCreated(form.name.trim()))
    emit("created")
  } catch (error) {
    message.error(error instanceof Error ? error.message : es.common.error)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <n-modal
    :show="show"
    preset="card"
    :title="es.catalogEntry.newProduct"
    :bordered="false"
    :style="{ width: '640px', maxWidth: 'calc(100vw - 32px)' }"
    @update:show="(value: boolean) => { if (!value) emit('close') }"
  >
    <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" @submit.prevent="submit">
      <n-grid cols="1 s:2" :x-gap="16" responsive="screen">
        <n-form-item-gi :label="es.catalogEntry.fields.barcode" path="barcode">
          <n-input v-model:value="form.barcode" :placeholder="es.catalogEntry.placeholders.barcode" :input-props="{ id: 'new-product-barcode' }" />
        </n-form-item-gi>
        <n-form-item-gi :label="es.catalogEntry.fields.name" path="name">
          <n-input v-model:value="form.name" :placeholder="es.catalogEntry.placeholders.productName" :input-props="{ id: 'new-product-name' }" />
        </n-form-item-gi>
        <n-form-item-gi :label="es.catalogEntry.fields.category" path="category">
          <n-select v-model:value="form.category" :options="categoryOptions" filterable tag :placeholder="es.catalogEntry.placeholders.category" />
        </n-form-item-gi>
        <n-form-item-gi :label="es.catalogEntry.fields.supplier" path="supplierId">
          <n-select v-model:value="form.supplierId" :options="supplierOptions" filterable clearable :placeholder="es.catalogEntry.placeholders.supplier" />
        </n-form-item-gi>
        <n-form-item-gi :label="es.catalogEntry.fields.purchasePrice" path="unitCost">
          <n-input-number
            v-model:value="form.unitCost"
            :min="0"
            :precision="0"
            :show-button="false"
            :format="moneyFormatter"
            :parse="moneyParser"
            :placeholder="es.catalogEntry.placeholders.purchasePrice"
            :input-props="moneyInputProps({ id: 'new-product-cost' })"
            :style="{ width: '100%' }"
          />
        </n-form-item-gi>
        <n-form-item-gi :label="es.catalogEntry.fields.salePrice" path="salePrice">
          <n-input-number
            v-model:value="form.salePrice"
            :min="0"
            :precision="0"
            :show-button="false"
            :format="moneyFormatter"
            :parse="moneyParser"
            :input-props="moneyInputProps({ id: 'new-product-price' })"
            :style="{ width: '100%' }"
          />
        </n-form-item-gi>
      </n-grid>
      <n-grid cols="1 s:3" :x-gap="16" responsive="screen">
        <n-form-item-gi :label="es.catalogEntry.fields.stock" path="stockUnits">
          <n-input-number v-model:value="form.stockUnits" :min="0" :precision="0" :show-button="false" :input-props="unitsInputProps({ id: 'new-product-stock' })" :style="{ width: '100%' }" />
        </n-form-item-gi>
        <n-form-item-gi :label="es.catalogEntry.fields.base" path="minStockUnits">
          <n-input-number v-model:value="form.minStockUnits" :min="0" :precision="0" :show-button="false" :input-props="unitsInputProps({ id: 'new-product-base' })" :style="{ width: '100%' }" />
        </n-form-item-gi>
        <n-form-item-gi :label="es.catalogEntry.fields.tope" path="maxStockUnits">
          <n-input-number v-model:value="form.maxStockUnits" :min="0" :precision="0" :show-button="false" :input-props="unitsInputProps({ id: 'new-product-tope' })" :style="{ width: '100%' }" />
        </n-form-item-gi>
      </n-grid>
      <n-text depth="3" :style="{ fontSize: '12px' }">{{ es.catalogEntry.levelsHint }}</n-text>
    </n-form>
    <template #footer>
      <n-flex justify="end" :size="8">
        <n-button secondary @click="emit('close')">{{ es.catalogEntry.cancel }}</n-button>
        <n-button type="primary" :loading="saving" @click="submit">{{ es.catalogEntry.create }}</n-button>
      </n-flex>
    </template>
  </n-modal>
</template>
