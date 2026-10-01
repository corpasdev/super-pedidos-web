<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue"
import { CreateOutline } from "@vicons/ionicons5"
import type { InputNumberInst } from "naive-ui"
import type { DailyCashItem } from "../../../infrastructure/apiTypes"
import { palette } from "../../../theme/naiveOverrides"
import { es } from "../../../i18n/es"
import { formatMoney, moneyFormatter, moneyParser } from "../../../i18n/format"
import { moneyInputProps } from "../../numericInput"

/**
 * Tile de caja (primero del patrón F): siempre se ve un número (lo que queda, o $0 sin caja).
 * El lápiz convierte ese mismo número en campo editable, sin bordes ni botón de guardar:
 * Enter o salir del campo guarda; Esc cancela.
 */
/** Un sugerido pendiente con la plata que le asignó el agente y su color. */
export interface CashSegment {
  sellerId: string
  name: string
  amount: number
  color: string
}

/** `segments`: el reparto de la caja entre los sugeridos pendientes, en el orden en que se armaron. */
const props = defineProps<{ cash: DailyCashItem | null; saving?: boolean; segments?: CashSegment[] }>()
const emit = defineEmits<{ open: [amount: number] }>()

const input = ref<InputNumberInst | null>(null)
const draft = ref<number | null>(null)
const editing = ref(false)
const hasCash = computed(() => props.cash !== null && props.cash.openingAmount !== null)
const shownAmount = computed(() => (hasCash.value ? (props.cash!.remainingAmount ?? 0) : 0))
// Reparto de la caja: lo ya pedido hoy, lo que tienen asignado los sugeridos y lo que queda libre.
const opening = computed(() => (hasCash.value ? props.cash!.openingAmount! : 0))
const spent = computed(() => (hasCash.value ? props.cash!.spentAmount : 0))
const segments = computed(() => props.segments ?? [])
const planned = computed(() => Math.min(segments.value.reduce((sum, segment) => sum + segment.amount, 0), Math.max(0, opening.value - spent.value)))
const free = computed(() => Math.max(0, opening.value - spent.value - planned.value))
const percentOf = (value: number): string => (opening.value > 0 ? `${Math.min(100, (value / opening.value) * 100)}%` : "0%")
/** Al corregir por debajo de lo ya pedido hoy, la caja queda en $0: se avisa mientras se escribe. */
const belowSpent = computed(() => draft.value !== null && props.cash !== null && draft.value < props.cash.spentAmount)

// Cuando llega la caja recargada (aunque el monto sea el mismo), se cierra la edición.
watch(
  () => props.cash,
  () => {
    editing.value = false
  },
)

async function startEditing(): Promise<void> {
  draft.value = props.cash?.openingAmount ?? null
  editing.value = true
  await nextTick()
  input.value?.focus()
  input.value?.select()
}

/** Guarda solo si el número cambió; si no, vuelve a mostrar el número. */
function commit(): void {
  if (!editing.value || props.saving) return
  const original = props.cash?.openingAmount ?? null
  if (draft.value === null || draft.value === original) {
    editing.value = false
    return
  }
  emit("open", draft.value)
}

function cancel(): void {
  draft.value = props.cash?.openingAmount ?? null
  editing.value = false
}

function onKeyup(event: KeyboardEvent): void {
  if (event.key === "Enter") commit()
  if (event.key === "Escape") cancel()
}

const light = "#FDFDFD"
const legendStyle = { color: light, opacity: 0.85, fontSize: "12px", whiteSpace: "nowrap" as const }
const dot = (opacity: number) => ({
  display: "inline-block",
  width: "8px",
  height: "8px",
  borderRadius: "999px",
  background: palette.accent,
  opacity,
  marginRight: "5px",
})

/** Rótulo «CAJA HOY» arriba del número. */
const labelStyle = { color: light, opacity: 0.8, fontSize: "12px", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" as const }
/** El campo se ve igual que el número: sin fondo ni borde, mismo tamaño y color. */
const bareInput = {
  peers: {
    Input: {
      color: "transparent",
      colorFocus: "transparent",
      border: "none",
      borderHover: "none",
      borderFocus: "none",
      boxShadowFocus: "none",
      textColor: light,
      caretColor: palette.accent,
      placeholderColor: "rgba(253,253,253,0.45)",
      fontSizeLarge: "28px",
      heightLarge: "34px",
      paddingLarge: "0",
    },
  },
}
</script>

<template>
  <n-card :bordered="false" :style="{ background: palette.brandDeep, height: '100%' }" :content-style="{ padding: '16px 18px' }">
    <n-flex vertical :size="10" justify="space-between" :style="{ height: '100%' }">
      <n-text :style="labelStyle">{{ es.inbox.cashToday }}</n-text>

      <n-flex align="center" :size="6" :wrap="false">
        <n-input-number
          v-if="editing"
          ref="input"
          v-model:value="draft"
          size="large"
          :min="0"
          :precision="0"
          :show-button="false"
          :format="moneyFormatter"
          :parse="moneyParser"
          :placeholder="formatMoney(0)"
          :disabled="saving"
          :theme-overrides="bareInput"
          :input-props="moneyInputProps({ id: 'inbox-cash', 'aria-label': es.inbox.cashInput, style: 'font-weight: 800', onKeyup })"
          :style="{ flex: 1, borderBottom: `2px solid ${palette.accent}` }"
          @blur="commit"
        />
        <template v-else>
          <n-text class="tabular-nums" :style="{ color: light, fontSize: '28px', fontWeight: 800, lineHeight: '34px' }">
            {{ formatMoney(shownAmount) }}
          </n-text>
          <n-button quaternary circle size="small" :aria-label="es.inbox.cashEdit" @click="startEditing">
            <template #icon><n-icon :component="CreateOutline" :color="light" /></template>
          </n-button>
        </template>
      </n-flex>

      <n-text v-if="editing" :style="{ color: light, opacity: 0.85, fontSize: '12px' }">
        {{ belowSpent ? es.inbox.cashBelowSpent(formatMoney(cash!.spentAmount)) : es.inbox.cashEditHint }}
      </n-text>
      <n-flex v-else-if="hasCash" vertical :size="6">
        <!-- Barra del reparto: pedido hoy (lima) · en sugeridos (lima suave) · libre (riel) -->
        <div
          role="img"
          :aria-label="es.inbox.cashSplitLabel(formatMoney(spent), formatMoney(planned), formatMoney(free))"
          :style="{ display: 'flex', height: '8px', borderRadius: '999px', overflow: 'hidden', background: 'rgba(253,253,253,0.18)' }"
        >
          <span :style="{ width: percentOf(spent), background: palette.accent, transition: 'width .3s' }" />
          <!-- Un tramo por sugerido, con el color de su tarjeta -->
          <n-tooltip v-for="segment in segments" :key="segment.sellerId" placement="bottom">
            <template #trigger>
              <span :style="{ width: percentOf(segment.amount), background: segment.color, transition: 'width .3s', cursor: 'default' }" />
            </template>
            {{ segment.name }} · {{ formatMoney(segment.amount) }}
          </n-tooltip>
        </div>
        <n-flex :size="10" :wrap="true" :style="{ rowGap: '2px' }">
          <n-text v-if="spent > 0" class="tabular-nums" :style="legendStyle">
            <span :style="dot(1)" />{{ es.inbox.cashSpentShort(formatMoney(spent)) }}
          </n-text>
          <n-text class="tabular-nums" :style="legendStyle">{{ es.inbox.cashPlanned(formatMoney(planned), segments.length) }}</n-text>
          <n-text class="tabular-nums" :style="legendStyle">{{ es.inbox.cashFree(formatMoney(free)) }}</n-text>
        </n-flex>
      </n-flex>
      <n-text v-else :style="{ color: light, opacity: 0.85, fontSize: '12px' }">{{ es.inbox.cashMissingShort }}</n-text>
    </n-flex>
  </n-card>
</template>
