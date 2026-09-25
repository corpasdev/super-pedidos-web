<script setup lang="ts">
import { computed } from "vue"

/**
 * Medidor radial segmentado de dos anillos (60 segmentos cada uno, desde las 12 en sentido horario).
 * Anillo exterior en lima (valor actual), anillo interior en tinta; segmentos inactivos en --line.
 */
const props = defineProps<{
  outerFraction: number
  innerFraction: number
  value: string
  hint: string
  label: string
}>()

const SIZE = 230
const CENTER = SIZE / 2
const SEGMENTS = 60

const ring = (radius: number, thickness: number, fraction: number) => {
  const segmentLength = (2 * Math.PI * radius) / SEGMENTS - 3
  const activeCount = Math.round(Math.min(1, Math.max(0, fraction)) * SEGMENTS)
  return Array.from({ length: SEGMENTS }, (_, index) => ({
    index,
    angle: (360 / SEGMENTS) * index,
    x: CENTER - segmentLength / 2,
    y: CENTER - radius - thickness / 2,
    width: segmentLength,
    height: thickness,
    active: index < activeCount,
  }))
}

const outerRing = computed(() => ring(104, 12, props.outerFraction))
const innerRing = computed(() => ring(86, 12, props.innerFraction))
</script>

<template>
  <svg :viewBox="`0 0 ${SIZE} ${SIZE}`" role="img" :aria-label="label" style="width: 100%; max-width: 240px; height: auto; display: block; margin: 0 auto">
    <rect
      v-for="segment in outerRing"
      :key="`outer-${segment.index}`"
      :x="segment.x"
      :y="segment.y"
      :width="segment.width"
      :height="segment.height"
      rx="2"
      :transform="`rotate(${segment.angle} ${CENTER} ${CENTER})`"
      :style="segment.active ? { fill: 'var(--accent)', stroke: 'rgba(1,63,50,0.35)', strokeWidth: 1 } : { fill: 'var(--line)' }"
    />
    <rect
      v-for="segment in innerRing"
      :key="`inner-${segment.index}`"
      :x="segment.x"
      :y="segment.y"
      :width="segment.width"
      :height="segment.height"
      rx="2"
      :transform="`rotate(${segment.angle} ${CENTER} ${CENTER})`"
      :style="{ fill: segment.active ? 'var(--ink)' : 'var(--line)' }"
    />
    <text :x="CENTER" :y="CENTER + 6" text-anchor="middle" style="font-size: 30px; font-weight: 500; fill: var(--ink)">{{ value }}</text>
    <text :x="CENTER" :y="CENTER + 26" text-anchor="middle" style="font-size: 11px; fill: var(--ink-muted)">{{ hint }}</text>
  </svg>
</template>
