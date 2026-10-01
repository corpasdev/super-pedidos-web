<script setup lang="ts">
import { computed, onMounted, ref } from "vue"
import { useMessage } from "naive-ui"
import { AddOutline, CloseOutline } from "@vicons/ionicons5"
import { apiClient } from "../../../infrastructure/apiClient"
import type { ExpiredExchangeItem, ProductItem } from "../../../infrastructure/apiTypes"
import { es } from "../../../i18n/es"
import { formatMoney } from "../../../i18n/format"
import { unitsInputProps } from "../../numericInput"

/**
 * Vencidos para cambio: el dueño anota los productos vencidos de cualquier proveedor y quedan
 * pendientes, a la vista, hasta que el proveedor los cambia. Los de proveedores que vienen hoy van primero.
 */
const props = defineProps<{ suppliersComingToday: string[] }>()

const message = useMessage()
const exchanges = ref<ExpiredExchangeItem[]>([])
const loading = ref(false)
const products = ref<ProductItem[]>([])
const productsLoading = ref(false)
const productId = ref<string | null>(null)
const units = ref<number | null>(1)
const adding = ref(false)
const busy = ref<Set<string>>(new Set())

const comingToday = computed(() => new Set(props.suppliersComingToday))
const sorted = computed(() =>
  [...exchanges.value].sort(
    (left, right) => Number(comingToday.value.has(right.supplierId ?? "")) - Number(comingToday.value.has(left.supplierId ?? "")),
  ),
)

const productOptions = computed(() =>
  products.value.map((product) => ({
    label: product.supplierName ? `${product.name} · ${product.supplierName}` : product.name,
    value: product.id,
  })),
)

async function load(): Promise<void> {
  loading.value = true
  try {
    exchanges.value = (await apiClient.get<{ exchanges: ExpiredExchangeItem[] }>("/expired-exchanges")).exchanges
  } catch (error) {
    message.error(error instanceof Error ? error.message : es.common.error)
  } finally {
    loading.value = false
  }
}

/** El catálogo se trae solo cuando se va a anotar un vencido (son miles de productos). */
async function loadProducts(): Promise<void> {
  if (products.value.length > 0 || productsLoading.value) return
  productsLoading.value = true
  try {
    products.value = (await apiClient.get<{ products: ProductItem[] }>("/products")).products
  } catch (error) {
    message.error(error instanceof Error ? error.message : es.common.error)
  } finally {
    productsLoading.value = false
  }
}

onMounted(load)

async function add(): Promise<void> {
  if (productId.value === null || !units.value) return
  adding.value = true
  try {
    const { exchange } = await apiClient.post<{ exchange: ExpiredExchangeItem }>("/expired-exchanges", {
      productId: productId.value,
      units: units.value,
    })
    exchanges.value = [...exchanges.value, exchange]
    productId.value = null
    units.value = 1
  } catch (error) {
    message.error(error instanceof Error ? error.message : es.common.error)
  } finally {
    adding.value = false
  }
}

async function settle(exchange: ExpiredExchangeItem, action: "exchanged" | "remove"): Promise<void> {
  busy.value = new Set(busy.value).add(exchange.id)
  try {
    if (action === "exchanged") await apiClient.post(`/expired-exchanges/${exchange.id}/exchanged`)
    else await apiClient.delete(`/expired-exchanges/${exchange.id}`)
    exchanges.value = exchanges.value.filter((item) => item.id !== exchange.id)
    if (action === "exchanged") message.success(es.inbox.expired.done(exchange.productName))
  } catch (error) {
    message.error(error instanceof Error ? error.message : es.common.error)
  } finally {
    const next = new Set(busy.value)
    next.delete(exchange.id)
    busy.value = next
  }
}

const tileTitleStyle = { fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }
</script>

<template>
  <n-card :bordered="false" :style="{ flex: 1 }" :content-style="{ padding: '14px 16px' }">
    <n-flex vertical :size="10">
      <n-flex justify="space-between" align="center">
        <n-text :style="tileTitleStyle">{{ es.inbox.expired.title }}</n-text>
        <n-tag v-if="exchanges.length > 0" round size="small" :bordered="false" type="warning">{{ exchanges.length }}</n-tag>
      </n-flex>

      <!-- Anotar un vencido: producto (de cualquier proveedor) y cuántas unidades -->
      <n-flex :size="6" :wrap="false" align="center">
        <n-select
          v-model:value="productId"
          :options="productOptions"
          :loading="productsLoading"
          filterable
          clearable
          :placeholder="es.inbox.expired.productPlaceholder"
          :style="{ flex: 1, minWidth: 0 }"
          @focus="loadProducts"
        />
        <n-input-number
          v-model:value="units"
          :min="1"
          :precision="0"
          :show-button="false"
          :input-props="unitsInputProps({ 'aria-label': es.inbox.expired.units, id: 'expired-units' })"
          :style="{ width: '64px' }"
        />
        <n-button type="primary" circle :loading="adding" :disabled="productId === null || !units" :aria-label="es.inbox.expired.add" @click="add">
          <template #icon><n-icon :component="AddOutline" /></template>
        </n-button>
      </n-flex>

      <n-spin :show="loading">
        <n-flex vertical :size="8">
          <n-flex v-for="exchange in sorted" :key="exchange.id" justify="space-between" align="center" :wrap="false" :size="8">
            <n-flex vertical :size="0" :style="{ minWidth: 0 }">
              <n-ellipsis :style="{ fontWeight: 600 }">{{ exchange.productName }}</n-ellipsis>
              <n-flex align="center" :size="6" :wrap="false">
                <n-text depth="3" class="tabular-nums" :style="{ fontSize: '12px', whiteSpace: 'nowrap' }">{{ es.inbox.expired.unitsLabel(exchange.units) }}</n-text>
                <n-ellipsis depth="3" :style="{ fontSize: '12px' }">{{ exchange.supplierName ?? es.inbox.expired.noSupplier }}</n-ellipsis>
              </n-flex>
            </n-flex>
            <n-flex :size="2" :wrap="false" align="center">
              <!-- Lo que vale el cambio: unidades × precio de compra -->
              <n-text class="tabular-nums" :style="{ fontWeight: 700, whiteSpace: 'nowrap' }">{{ formatMoney(exchange.units * exchange.unitCost) }}</n-text>
              <n-button size="small" quaternary circle :aria-label="es.inbox.expired.remove" @click="settle(exchange, 'remove')">
                <template #icon><n-icon :component="CloseOutline" /></template>
              </n-button>
            </n-flex>
          </n-flex>
          <n-text v-if="!loading && exchanges.length === 0" depth="3">{{ es.inbox.expired.empty }}</n-text>
        </n-flex>
      </n-spin>
    </n-flex>
  </n-card>
</template>
