/** Variables de entorno tipadas de la web (sección 14 del plan). */
export const environment = {
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:3000/api/v1",
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string,
  /** Supabase recomienda la llave publicable nueva; se acepta la anon legacy hasta migrar. */
  supabasePublishableKey: (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? (import.meta.env.VITE_SUPABASE_ANON_KEY as string),
} as const