/**
 * Token de acceso síncrono entre el store de sesión y ApiClient (evita imports circulares).
 * Lo actualiza sessionStore (y el onAuthStateChange de Supabase).
 */
let currentAccessToken: string | null = null

export const setAuthToken = (token: string | null): void => {
  currentAccessToken = token
}

export const getAuthToken = (): string | null => currentAccessToken