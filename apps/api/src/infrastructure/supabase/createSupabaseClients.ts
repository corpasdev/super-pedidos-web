import { createClient } from "@supabase/supabase-js"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"
import type { ApiEnvironment } from "../config/environment.js"

/**
 * Cliente de servicio de Supabase con la llave secreta (solo servidor).
 * Omite RLS: nunca va al navegador ni al repositorio.
 */
export const createServiceClient = (environment: ApiEnvironment): SupabaseClient<Database> =>
  createClient<Database>(environment.supabaseUrl, environment.supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })