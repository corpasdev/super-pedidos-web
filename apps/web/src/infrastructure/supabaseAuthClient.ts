import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { environment } from "./environment"

/**
 * Cliente de Supabase exclusivo para autenticación (sección 4.1: la web solo usa Supabase para Auth).
 * Toda otra lectura/escritura de datos pasa por la API.
 */
// En modo de prueba la sesión es simulada: sin .env se usa una dirección de relleno que nunca se llama.
export const supabaseAuthClient: SupabaseClient = createClient(
  environment.supabaseUrl || "http://localhost.invalid",
  environment.supabasePublishableKey || "mock",
  {
    auth: { autoRefreshToken: true, persistSession: true },
  },
)