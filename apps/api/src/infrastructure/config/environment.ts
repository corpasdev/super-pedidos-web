import { z } from "zod"

const apiEnvironmentSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SECRET_KEY: z.string().min(10),
  ALLOWED_WEB_ORIGIN: z.string().default("http://localhost:5173"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),
})

export interface ApiEnvironment {
  port: number
  supabaseUrl: string
  supabaseSecretKey: string
  allowedWebOrigin: string
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent"
}

/** Valida las variables de entorno al arrancar y falla con un mensaje claro si falta alguna. */
export const loadEnvironment = (source: NodeJS.ProcessEnv = process.env): ApiEnvironment => {
  const parsed = apiEnvironmentSchema.safeParse(source)
  if (!parsed.success) {
    const missing = parsed.error.issues.map((issue) => issue.path.join(".")).join(", ")
    throw new Error(`Faltan o son inválidas las variables de entorno: ${missing}. Revisa apps/api/.env.`)
  }
  return {
    port: parsed.data.PORT,
    supabaseUrl: parsed.data.SUPABASE_URL,
    supabaseSecretKey: parsed.data.SUPABASE_SECRET_KEY,
    allowedWebOrigin: parsed.data.ALLOWED_WEB_ORIGIN,
    logLevel: parsed.data.LOG_LEVEL,
  }
}