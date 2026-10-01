<script setup lang="ts">
import { reactive, ref, watch } from "vue"
import { useMessage, type FormInst, type FormRules } from "naive-ui"
import { apiClient } from "../../../infrastructure/apiClient"
import { es } from "../../../i18n/es"
import { moneyFormatter, moneyParser } from "../../../i18n/format"
import { moneyInputProps } from "../../numericInput"

/**
 * Formulario para registrar un proveedor a mano, con los mismos datos que muestra la tabla:
 * nombre, NIT, correo, día de pedido, día de entrega, frecuencia, mínimo y tope del pedido.
 * Con su día de pedido aparece en Sugeridos.
 */
const props = defineProps<{ show: boolean }>()
const emit = defineEmits<{ close: []; created: [] }>()

const message = useMessage()
const formRef = ref<FormInst | null>(null)
const saving = ref(false)

const emptyForm = () => ({
  name: "",
  taxId: "",
  contactEmail: "",
  whatsappNumber: "",
  orderWeekday: null as number | null,
  deliveryWeekday: null as number | null,
  visitFrequency: "weekly" as "weekly" | "biweekly",
  minimumOrderAmount: 20_000 as number | null,
  maximumOrderAmount: 250_000 as number | null,
})

/** Lunes a sábado (los domingos no hay visitas). */
const weekdayOptions = [1, 2, 3, 4, 5, 6].map((weekday) => ({ label: es.dashboard.weekdays[weekday] ?? "", value: weekday }))
const form = reactive(emptyForm())

watch(
  () => props.show,
  (show) => {
    if (show) Object.assign(form, emptyForm())
  },
)

const required = { required: true, message: es.catalogEntry.required, trigger: ["blur", "change"] }
const rules: FormRules = {
  name: { ...required, trigger: ["blur", "input"] },
  whatsappNumber: {
    trigger: ["blur"],
    validator: (_rule: unknown, value: string) =>
      value.trim() === "" || /^\+?[0-9 -]{7,20}$/.test(value.trim()) ? true : new Error(es.catalogEntry.whatsappInvalid),
  },
  orderWeekday: { ...required, type: "number" },
  deliveryWeekday: { ...required, type: "number" },
  minimumOrderAmount: { ...required, type: "number" },
  maximumOrderAmount: {
    ...required,
    type: "number",
    validator: (_rule: unknown, value: number | null) =>
      value === null || form.minimumOrderAmount === null || value >= form.minimumOrderAmount ? true : new Error(es.catalogEntry.maximumBelowMinimum),
  },
}

async function submit(): Promise<void> {
  try {
    await formRef.value?.validate()
  } catch {
    return
  }
  saving.value = true
  try {
    await apiClient.post<{ id: string }>("/suppliers", {
      name: form.name,
      taxId: form.taxId.trim() || null,
      contactEmail: form.contactEmail.trim() || null,
      whatsappNumber: form.whatsappNumber.trim() || null,
      orderWeekday: form.orderWeekday,
      deliveryWeekday: form.deliveryWeekday,
      visitFrequency: form.visitFrequency,
      minimumOrderAmount: form.minimumOrderAmount,
      maximumOrderAmount: form.maximumOrderAmount,
    })
    message.success(es.catalogEntry.supplierCreated(form.name.trim().toUpperCase()))
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
    :title="es.catalogEntry.newSupplier"
    :bordered="false"
    :style="{ width: '620px', maxWidth: 'calc(100vw - 32px)' }"
    @update:show="(value: boolean) => { if (!value) emit('close') }"
  >
    <n-form ref="formRef" :model="form" :rules="rules" label-placement="top" @submit.prevent="submit">
      <n-grid cols="1 s:3" :x-gap="16" responsive="screen">
        <n-form-item-gi :label="es.catalogEntry.fields.name" path="name">
          <n-input v-model:value="form.name" :placeholder="es.catalogEntry.placeholders.supplierName" :input-props="{ id: 'new-supplier-name' }" />
        </n-form-item-gi>
        <n-form-item-gi :label="es.catalogEntry.fields.taxId" path="taxId">
          <n-input v-model:value="form.taxId" :placeholder="es.catalogEntry.placeholders.optional" :input-props="{ id: 'new-supplier-tax-id' }" />
        </n-form-item-gi>
        <n-form-item-gi :label="es.catalogEntry.fields.email" path="contactEmail">
          <n-input v-model:value="form.contactEmail" :placeholder="es.catalogEntry.placeholders.optional" :input-props="{ id: 'new-supplier-email', type: 'email' }" />
        </n-form-item-gi>
        <n-form-item-gi :label="es.catalogEntry.fields.whatsapp" path="whatsappNumber">
          <n-input
            v-model:value="form.whatsappNumber"
            :placeholder="es.catalogEntry.placeholders.whatsapp"
            :input-props="{ id: 'new-supplier-whatsapp', type: 'tel', inputmode: 'tel', autocomplete: 'tel' }"
          />
        </n-form-item-gi>

        <n-form-item-gi :label="es.suppliersView.columns.orderDay" path="orderWeekday">
          <n-select v-model:value="form.orderWeekday" :options="weekdayOptions" :placeholder="es.catalogEntry.placeholders.weekday" />
        </n-form-item-gi>
        <n-form-item-gi :label="es.suppliersView.columns.deliveryDay" path="deliveryWeekday">
          <n-select v-model:value="form.deliveryWeekday" :options="weekdayOptions" :placeholder="es.catalogEntry.placeholders.weekday" />
        </n-form-item-gi>
        <n-form-item-gi :label="es.suppliersView.columns.frequency" path="visitFrequency">
          <n-radio-group v-model:value="form.visitFrequency" name="new-supplier-frequency">
            <n-radio-button value="weekly">{{ es.suppliersView.weekly }}</n-radio-button>
            <n-radio-button value="biweekly">{{ es.suppliersView.biweekly }}</n-radio-button>
          </n-radio-group>
        </n-form-item-gi>

        <n-form-item-gi :label="es.suppliersView.columns.minimum" path="minimumOrderAmount">
          <n-input-number
            v-model:value="form.minimumOrderAmount"
            :min="0"
            :precision="0"
            :show-button="false"
            :format="moneyFormatter"
            :parse="moneyParser"
            :input-props="moneyInputProps({ id: 'new-supplier-minimum' })"
            :style="{ width: '100%' }"
          />
        </n-form-item-gi>
        <n-form-item-gi :label="es.suppliersView.columns.maximum" path="maximumOrderAmount">
          <n-input-number
            v-model:value="form.maximumOrderAmount"
            :min="0"
            :precision="0"
            :show-button="false"
            :format="moneyFormatter"
            :parse="moneyParser"
            :input-props="moneyInputProps({ id: 'new-supplier-maximum' })"
            :style="{ width: '100%' }"
          />
        </n-form-item-gi>
      </n-grid>
    </n-form>
    <template #footer>
      <n-flex justify="end" :size="8">
        <n-button secondary @click="emit('close')">{{ es.catalogEntry.cancel }}</n-button>
        <n-button type="primary" :loading="saving" @click="submit">{{ es.catalogEntry.create }}</n-button>
      </n-flex>
    </template>
  </n-modal>
</template>
