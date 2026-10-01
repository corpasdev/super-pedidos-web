<script setup lang="ts">
import { computed } from "vue"
import extendedLogo from "../../assets/logo/logo-extendido.svg?url"
import compactLogo from "../../assets/logo/logo-reducido.svg?url"
import { es } from "../../i18n/es"

/**
 * Logo de la marca desde src/assets/logo: extendido (símbolo + nombre) o reducido (solo el símbolo).
 * Se pinta como máscara con el color del texto del tema, así se ve en claro y en oscuro.
 */
const props = withDefaults(defineProps<{ variant?: "extended" | "compact"; height?: number; label?: string }>(), {
  variant: "extended",
  height: 32,
  label: es.shell.logoLabel,
})

/** Proporción ancho / alto de cada archivo (según su viewBox recortado). */
const RATIO = { extended: 1035 / 276, compact: 631 / 659 } as const

const style = computed(() => {
  const url = `url("${props.variant === "extended" ? extendedLogo : compactLogo}")`
  return {
    display: "inline-block",
    flexShrink: 0,
    height: `${props.height}px`,
    width: `${Math.round(props.height * RATIO[props.variant])}px`,
    backgroundColor: "var(--ink)",
    maskImage: url,
    WebkitMaskImage: url,
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskSize: "contain",
    WebkitMaskSize: "contain",
    maskPosition: "center",
    WebkitMaskPosition: "center",
  }
})
</script>

<template>
  <span role="img" :aria-label="label" :style="style" />
</template>
