import { ref } from "vue"
import { acceptHMRUpdate, defineStore } from "pinia"
import { apiClient } from "../infrastructure/apiClient"
import type { StoreProfileItem, StoreProfilePatch } from "../infrastructure/apiTypes"

/** Configuración de la tienda: nombre, administrador, correo y logo. La usan el sidebar y la pantalla de Configuración. */
export const useStoreProfileStore = defineStore("storeProfile", () => {
  const profile = ref<StoreProfileItem | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const uploadingLogo = ref(false)

  async function load(): Promise<void> {
    loading.value = true
    try {
      const response = await apiClient.get<{ profile: StoreProfileItem }>("/store-profile")
      profile.value = response.profile
    } catch {
      profile.value = null
    } finally {
      loading.value = false
    }
  }

  async function save(patch: StoreProfilePatch): Promise<void> {
    saving.value = true
    try {
      const response = await apiClient.patch<{ profile: StoreProfileItem }>("/store-profile", patch)
      profile.value = response.profile
    } finally {
      saving.value = false
    }
  }

  async function uploadLogo(file: File): Promise<void> {
    uploadingLogo.value = true
    try {
      const response = await apiClient.postFile<{ profile: StoreProfileItem }>("/store-profile/logo", file, file.name)
      profile.value = response.profile
    } finally {
      uploadingLogo.value = false
    }
  }

  async function removeLogo(): Promise<void> {
    uploadingLogo.value = true
    try {
      const response = await apiClient.delete<{ profile: StoreProfileItem }>("/store-profile/logo")
      profile.value = response.profile
    } finally {
      uploadingLogo.value = false
    }
  }

  return { profile, loading, saving, uploadingLogo, load, save, uploadLogo, removeLogo }
})

// Recarga en caliente (Vite): reemplaza el store en memoria cuando cambia este archivo, sin recargar la página.
if (import.meta.hot) import.meta.hot.accept(acceptHMRUpdate(useStoreProfileStore, import.meta.hot))
