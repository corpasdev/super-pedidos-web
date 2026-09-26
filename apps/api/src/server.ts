import "dotenv/config"
import express from "express"
import helmetModule, { type HelmetOptions } from "helmet"
import cors from "cors"
import type { RequestHandler } from "express"
import { loadEnvironment } from "./infrastructure/config/environment.js"
import { logger } from "./infrastructure/logging/logger.js"
import { Container } from "./container.js"
import { buildApiRouter } from "./interface/http/routes.js"
import { errorHandler, notFoundHandler } from "./interface/http/middlewares.js"

// helmet publica tipos ESM y CJS distintos; según cómo se compile (local vs. Vercel),
// el import por defecto puede resolverse al módulo completo en lugar de la función.
// En tiempo de ejecución ambas formas exponen la función (module.exports.default === module.exports).
type Helmet = (options?: Readonly<HelmetOptions>) => RequestHandler
const helmetExport = helmetModule as unknown as Helmet | { default: Helmet }
const helmet: Helmet = typeof helmetExport === "function" ? helmetExport : helmetExport.default

const env = loadEnvironment()

const container = new Container({ supabaseUrl: env.supabaseUrl, supabaseSecretKey: env.supabaseSecretKey })

const app = express()
app.disable("x-powered-by")
app.use(helmet())
app.use(cors({ origin: env.allowedWebOrigin, credentials: true }))
app.use(express.json({ limit: "2mb" }))
app.use("/api/v1", buildApiRouter(container))
app.use(notFoundHandler)
app.use(errorHandler)

app.listen(env.port, () => {
  logger.info({ port: env.port }, "Motor de Pedidos API escuchando")
})