import { onBeforeUnmount, ref, type Ref } from "vue"

/** true mientras la consulta de medios se cumpla (p. ej. "(min-width: 768px)"). */
export function useMediaQuery(query: string): Ref<boolean> {
  const mediaQueryList = typeof window === "undefined" ? null : window.matchMedia(query)
  const matches = ref(mediaQueryList?.matches ?? true)
  const update = (event: MediaQueryListEvent): void => {
    matches.value = event.matches
  }
  mediaQueryList?.addEventListener("change", update)
  onBeforeUnmount(() => mediaQueryList?.removeEventListener("change", update))
  return matches
}
