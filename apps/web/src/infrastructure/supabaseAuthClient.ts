import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { environment } from "./environment"

/**
 * Cliente de Supabase exclusivo para autenticación (sección 4.1: la web solo usa Supabase para Auth).
 * Toda otra lectura/escritura de datos pasa por la API.
 */
export const supabaseAuthClient: SupabaseClient = createClient(
  environment.supabaseUrl,
  environment.supabasePublishableKey,
  {
    auth: { autoRefreshToken: true, persistSession: true },
  },
)