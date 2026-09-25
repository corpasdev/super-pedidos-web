import { defineStore } from "pinia"
import { computed, ref } from "vue"
import type { Session } from "@supabase/supabase-js"
import { supabaseAuthClient } from "../infrastructure/supabaseAuthClient"
import { apiClient } from "../infrastructure/apiClient"
import { setAuthToken } from "../infrastructure/authTokenStore"

export interface OwnerStore {
  id: string
  name: string
}

interface StoreResponse {
  store: OwnerStore | null
}

export const useSessionStore = defineStore("session", () => {
  const user = ref<{ id: string; email: string | null } | null>(null)
  const store = ref<OwnerStore | null>(null)
  const isReady = ref(false)
  const isSigningIn = ref(false)
  const signInError = ref<string | null>(null)

  const isAuthenticated = computed(() => user.value !== null)

  function applySession(session: Session | null): void {
    const rawUser = session?.user ?? null
    const nextUser: { id: string; email: string | null } | null = rawUser === null ? null : { id: rawUser.id, email: rawUser.email ?? null }
    user.value = nextUser
    setAuthToken(session?.access_token ?? null)
    if (nextUser !== null) void refreshStore()
  }

  async function refreshStore(): Promise<void> {
    try {
      const response = await apiClient.get<StoreResponse>("/stores")
      store.value = response.store
    } catch {
      store.value = null
    }
  }

  /** Restaura la sesión guardada por Supabase y escucha cambios (login/logout por pestañas). */
  async function initialize(): Promise<void> {
    const { data } = await supabaseAuthClient.auth.getSession()
    applySession(data.session)
    supabaseAuthClient.auth.onAuthStateChange((_event, session) => applySession(session))
    isReady.value = true
  }

  async function signIn(email: string, password: string): Promise<void> {
    isSigningIn.value = true
    signInError.value = null
    const { data, error } = await supabaseAuthClient.auth.signInWithPassword({ email, password })
    isSigningIn.value = false
    if (error !== null) {
      signInError.value = "Correo o contraseña incorrectos."
      throw error
    }
    applySession(data.session)
  }

  async function signOut(): Promise<void> {
    await supabaseAuthClient.auth.signOut()
    user.value = null
    store.value = null
    setAuthToken(null)
  }

  return { user, store, isReady, isSigningIn, signInError, isAuthenticated, initialize, signIn, signOut, refreshStore }
})