<script setup lang="ts">
import { computed } from "vue"

/** Puntos por día: opacidad creciente de izquierda a derecha; el de hoy con halo lima. */
const props = defineProps<{
  items: { label: string; value: number; highlight: boolean }[]
  label: string
}>()

const WIDTH = 150
const TOP = 10
const BOTTOM = 62

const dots = computed(() => {
  const maxValue = Math.max(1, ...props.items.map((item) => item.value))
  const step = WIDTH / Math.max(1, props.items.length)
  const count = Math.max(1, props.items.length - 1)
  return props.items.map((item, index) => ({
    ...item,
    x: index * step + step / 2,
    y: BOTTOM - (item.value / maxValue) * (BOTTOM - TOP),
    opacity: 0.3 + (0.7 * index) / count,
  }))
})
</script>

<template>
  <svg :viewBox="`0 0 ${WIDTH} 86`" role="img" :aria-label="label" style="width: 100%; height: auto; display: block">
    <g v-for="dot in dots" :key="dot.label">
      <circle v-if="dot.highlight" :cx="dot.x" :cy="dot.y" r="9" style="fill: var(--accent)" />
      <circle :cx="dot.x" :cy="dot.y" :r="dot.highlight ? 5 : 4" :style="{ fill: 'var(--data)', opacity: dot.highlight ? 1 : dot.opacity }" />
      <text :x="dot.x" y="82" text-anchor="middle" style="font-size: 9px; fill: var(--ink-muted)">{{ dot.label }}</text>
    </g>
  </svg>
</template>
