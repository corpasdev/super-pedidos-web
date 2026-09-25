<script setup lang="ts">
import { computed } from "vue"

/** Barras verticales: históricas en tinte, la actual en verde profundo. */
const props = defineProps<{
  items: { label: string; value: number; highlight: boolean }[]
  label: string
}>()

const WIDTH = 150
const CHART_HEIGHT = 66
const BAR_WIDTH = 18

const bars = computed(() => {
  const maxValue = Math.max(1, ...props.items.map((item) => item.value))
  const step = WIDTH / Math.max(1, props.items.length)
  return props.items.map((item, index) => {
    const height = Math.max(4, (item.value / maxValue) * CHART_HEIGHT)
    return {
      ...item,
      x: index * step + (step - BAR_WIDTH) / 2,
      y: CHART_HEIGHT - height,
      height,
      center: index * step + step / 2,
    }
  })
})
</script>

<template>
  <svg :viewBox="`0 0 ${WIDTH} 86`" role="img" :aria-label="label" style="width: 100%; height: auto; display: block">
    <g v-for="bar in bars" :key="bar.label">
      <path
        :d="`M${bar.x} ${CHART_HEIGHT} V${bar.y + 4} Q${bar.x} ${bar.y} ${bar.x + 4} ${bar.y} H${bar.x + BAR_WIDTH - 4} Q${bar.x + BAR_WIDTH} ${bar.y} ${bar.x + BAR_WIDTH} ${bar.y + 4} V${CHART_HEIGHT} Z`"
        :style="{ fill: bar.highlight ? 'var(--data)' : 'var(--brand-tint)' }"
      />
      <text :x="bar.center" y="82" text-anchor="middle" style="font-size: 9px; fill: var(--ink-muted)">{{ bar.label }}</text>
    </g>
  </svg>
</template>
