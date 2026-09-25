import "dotenv/config"
import express from "express"
import helmet from "helmet"
import cors from "cors"
import { loadEnvironment } from "./infrastructure/config/environment.js"
import { logger } from "./infrastructure/logging/logger.js"
import { Container } from "./container.js"
import { buildApiRouter } from "./interface/http/routes.js"
import { errorHandler, notFoundHandler } from "./interface/http/middlewares.js"

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