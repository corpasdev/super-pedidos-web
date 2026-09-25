<script setup lang="ts">
import { computed } from "vue"
import { MotionConfig } from "motion-v"
import {
  darkTheme,
  dateEsES,
  esES,
  NConfigProvider,
  NDialogProvider,
  NGlobalStyle,
  NMessageProvider,
  NNotificationProvider,
} from "naive-ui"
import { darkOverrides, lightOverrides } from "./theme/naiveOverrides"
import { useThemeStore } from "./stores/themeStore"

const themeStore = useThemeStore()

const theme = computed(() => (themeStore.mode === "dark" ? darkTheme : null))
const themeOverrides = computed(() => (themeStore.mode === "dark" ? darkOverrides : lightOverrides))
</script>

<template>
  <NConfigProvider
    :theme="theme"
    :theme-overrides="themeOverrides"
    :locale="esES"
    :date-locale="dateEsES"
  >
    <NGlobalStyle />
    <NMessageProvider>
      <NDialogProvider>
        <NNotificationProvider placement="bottom-right" :max="4">
          <MotionConfig reduced-motion="user">
            <router-view />
          </MotionConfig>
        </NNotificationProvider>
      </NDialogProvider>
    </NMessageProvider>
  </NConfigProvider>
</template>