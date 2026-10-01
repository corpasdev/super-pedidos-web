import { ref } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"
import { apiClient } from "../infrastructure/apiClient"
import type { InboxDayItem, InboxItem, ReceiveOrderResponse } from "../infrastructure/apiTypes"

/** Bandeja del día: vendedores que vienen hoy con su pedido listo, llegadas y deudas por distribuidor. */
export const useInboxStore = defineStore("inbox", () => {
  const inbox = ref<InboxItem | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const receiving = ref<Set<string>>(new Set())
  /** Próximos 7 días con cuántos proveedores vienen (tags). */
  const days = ref<InboxDayItem[]>([])
  /** Día elegido en los tags; null = hoy. */
  const selectedDay = ref<string | null>(null)

  /** Carga los días y elige: hoy si viene alguien; si no, el siguiente día con visitas. */
  async function loadDays(): Promise<void> {
    const response = await apiClient.get<{ days: InboxDayItem[] }>("/inbox/days")
    days.value = response.days
    // La bandeja muestra siempre el día actual (se actualiza sola al cambiar el día).
    selectedDay.value = days.value.find((day) => day.isToday)?.day ?? null
  }

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      if (days.value.length === 0) await loadDays()
      const query = selectedDay.value === null ? "" : `?day=${selectedDay.value}`
      const response = await apiClient.get<{ inbox: InboxItem }>(`/inbox/today${query}`)
      inbox.value = response.inbox
    } catch (err) {
      error.value = err instanceof Error ? err.message : "No se pudo cargar la bandeja."
    } finally {
      loading.value = false
    }
  }

  /** Llegó el camión: el pedido queda recibido y suma al inventario. */
  async function receive(orderId: string): Promise<void> {
    receiving.value = new Set(receiving.value).add(orderId)
    try {
      await apiClient.post<ReceiveOrderResponse>(`/purchase-orders/${orderId}/receive`)
      await load()
    } finally {
      const next = new Set(receiving.value)
      next.delete(orderId)
      receiving.value = next
    }
  }

  async function selectDay(day: string): Promise<void> {
    selectedDay.value = day
    await load()
  }

  return { inbox, loading, error, receiving, days, selectedDay, load, loadDays, selectDay, receive }
})

// Recarga en caliente (Vite): reemplaza el store en memoria cuando cambia este archivo, sin recargar la página.
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useInboxStore, import.meta.hot))
