<script setup lang="ts">
import type { Component } from "vue"
import { palette } from "../../../theme/naiveOverrides"

/** Tarjeta KPI: título, ícono circular tinta con ícono lima, valor grande y variación; gráfico a la derecha. */
defineProps<{
  title: string
  icon: Component
  value: string
  variation: string | null
}>()
</script>

<template>
  <n-card :bordered="false" size="small" :content-style="{ padding: '18px 20px' }">
    <n-flex :wrap="false" align="stretch" :size="12">
      <n-flex vertical justify="space-between" :size="14" :style="{ flex: '1 1 60%', minWidth: 0 }">
        <n-text :style="{ fontSize: '14px' }">{{ title }}</n-text>
        <n-flex align="center" :size="10" :wrap="false">
          <n-avatar round :size="36" :style="{ background: 'var(--ink)', color: palette.accent, flexShrink: 0 }">
            <n-icon :component="icon" :size="18" />
          </n-avatar>
          <n-text class="tabular-nums" :style="{ fontSize: 'clamp(22px, 2.2vw, 32px)', fontWeight: 500, lineHeight: 1.1, whiteSpace: 'nowrap' }">
            {{ value }}
          </n-text>
          <n-text v-if="variation !== null" depth="3" :style="{ fontSize: '11px', whiteSpace: 'nowrap' }">{{ variation }}</n-text>
        </n-flex>
      </n-flex>
      <div :style="{ flex: '0 0 40%', alignSelf: 'flex-end' }">
        <slot />
      </div>
    </n-flex>
  </n-card>
</template>
