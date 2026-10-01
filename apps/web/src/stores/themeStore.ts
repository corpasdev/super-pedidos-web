import { ref, watch } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"

export type ThemeMode = "light" | "dark"

const STORAGE_KEY = "superpedido.theme"

const readSavedMode = (): ThemeMode | null => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === "light" || saved === "dark" ? saved : null
  } catch {
    return null
  }
}

const osPrefersDark = (): boolean =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches === true

/** Tema Claro/Oscuro elegido en la barra lateral. Sin elección guardada, sigue al sistema. */
export const useThemeStore = defineStore("theme", () => {
  const mode = ref<ThemeMode>(readSavedMode() ?? (osPrefersDark() ? "dark" : "light"))

  watch(
    mode,
    (next) => {
      document.documentElement.classList.toggle("dark", next === "dark")
      try {
        localStorage.setItem(STORAGE_KEY, next)
      } catch {
        // Sin almacenamiento (modo privado): el tema dura solo esta visita.
      }
    },
    { immediate: true },
  )

  return { mode }
})

// Recarga en caliente (Vite): reemplaza el store en memoria cuando cambia este archivo, sin recargar la página.
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useThemeStore, import.meta.hot))
