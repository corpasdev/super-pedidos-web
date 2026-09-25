<script setup lang="ts">
import { computed } from "vue"

/** Rangos tipo vela: línea fina de fondo, segmento min–max en tinte, el actual en verde profundo. */
const props = defineProps<{
  items: { label: string; min: number; max: number; highlight: boolean }[]
  label: string
}>()

const WIDTH = 150
const TOP = 6
const BOTTOM = 66

const columns = computed(() => {
  const maxValue = Math.max(1, ...props.items.map((item) => item.max))
  const step = WIDTH / Math.max(1, props.items.length)
  const yOf = (value: number) => BOTTOM - (value / maxValue) * (BOTTOM - TOP)
  return props.items.map((item, index) => {
    const yMax = yOf(item.max)
    const yMin = yOf(item.min)
    return {
      ...item,
      x: index * step + step / 2,
      yTop: Math.min(yMax, yMin - 4),
      yBottom: yMin,
      empty: item.max === 0,
    }
  })
})
</script>

<template>
  <svg :viewBox="`0 0 ${WIDTH} 86`" role="img" :aria-label="label" style="width: 100%; height: auto; display: block">
    <g v-for="column in columns" :key="column.label">
      <line :x1="column.x" :x2="column.x" :y1="TOP" :y2="BOTTOM" style="stroke: var(--line); stroke-width: 1" />
      <template v-if="!column.empty">
        <rect
          :x="column.x - 4"
          :y="column.yTop"
          width="8"
          :height="Math.max(4, column.yBottom - column.yTop)"
          rx="4"
          :style="{ fill: column.highlight ? 'var(--data)' : 'var(--brand-tint)' }"
        />
        <circle :cx="column.x" :cy="column.yTop - 4" r="1.6" style="fill: var(--data)" />
      </template>
      <text :x="column.x" y="82" text-anchor="middle" style="font-size: 9px; fill: var(--ink-muted)">{{ column.label }}</text>
    </g>
  </svg>
</template>
