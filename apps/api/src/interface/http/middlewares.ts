import type { Request, Response, NextFunction } from "express"
import type { SupabaseClient } from "@supabase/supabase-js"
import { DomainError, SupplierScheduleNotConfiguredError } from "@agente-pedidos/order-agent"
import type { Database } from "@agente-pedidos/database-types"
import { logger } from "../../infrastructure/logging/logger.js"
import { StoreLogoRejectedError } from "../../application/StoreProfileService.js"
import { OrderNotFoundError } from "../../application/OrderPaymentService.js"
import { InvalidLevelsError } from "../../application/ProductSettingsService.js"
import { DuplicateCatalogEntryError, InvalidNewLevelsError } from "../../application/CatalogEntryService.js"
import { ExpiredExchangeNotFoundError } from "../../application/ExpiredExchangeService.js"
import { SalesReportNotFoundError } from "../../application/SalesReportImportService.js"

export interface AuthenticatedRequest extends Request {
  ownerUserId: string
  storeId: string | null
}

const STATUS_BY_ERROR_CODE: Record<string, number> = {
  invalid_input: 400,
  supplier_schedule_not_configured: 400,
  biweekly_anchor_required: 400,
  anchor_date_wrong_weekday: 400,
  sales_report_overlap: 409,
  purchase_order_conflict: 409,
  catalog_import_failed: 422,
  sales_report_import_failed: 422,
  sales_report_missing_columns: 422,
  sales_report_empty: 422,
}

/** Valida el JWT del dueño y resuelve su tienda (si ya creó una). Lo deja en req. */
export const requireAuthenticatedOwner =
  (supabase: SupabaseClient<Database>, findStoreIdByOwner: (ownerUserId: string) => Promise<string | null>) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = readBearerToken(req.headers.authorization)
    if (token === null) {
      res.status(401).json({ error: { code: "unauthorized", message: "Falta el token de sesión (Authorization: Bearer …)." } })
      return
    }
    const { data, error } = await supabase.auth.getUser(token)
    if (error || !data.user) {
      res.status(401).json({ error: { code: "unauthorized", message: "La sesión no es válida o venció." } })
      return
    }
    const authenticatedRequest = req as AuthenticatedRequest
    authenticatedRequest.ownerUserId = data.user.id
    authenticatedRequest.storeId = await findStoreIdByOwner(data.user.id)
    next()
  }

/** Rutas que sí o sí necesitan tienda (todo menos crear la tienda). */
export const requireStore = (req: Request, res: Response, next: NextFunction): void => {
  const authenticatedRequest = req as AuthenticatedRequest
  if (authenticatedRequest.storeId === null) {
    res.status(409).json({
      error: { code: "store_not_found", message: "Aún no has creado tu tienda con el catálogo. Empieza por ahí." },
    })
    return
  }
  next()
}

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction): void => {
  if (error instanceof Error && error.name === "ZodError") {
    res.status(400).json({
      error: { code: "invalid_input", message: "Algunos campos no son válidos.", issues: (error as { issues?: unknown }).issues ?? null },
    })
    return
  }
  if (error instanceof SalesReportNotFoundError) {
    res.status(404).json({ error: { code: error.code, message: error.message } })
    return
  }
  if (error instanceof ExpiredExchangeNotFoundError) {
    res.status(404).json({ error: { code: error.code, message: error.message } })
    return
  }
  if (error instanceof DuplicateCatalogEntryError) {
    res.status(409).json({ error: { code: error.code, message: error.message } })
    return
  }
  if (error instanceof InvalidNewLevelsError) {
    res.status(400).json({ error: { code: error.code, message: error.message } })
    return
  }
  if (error instanceof InvalidLevelsError) {
    res.status(400).json({ error: { code: error.code, message: error.message } })
    return
  }
  if (error instanceof OrderNotFoundError) {
    res.status(404).json({ error: { code: error.code, message: error.message } })
    return
  }
  if (error instanceof StoreLogoRejectedError) {
    res.status(400).json({ error: { code: error.code, message: error.message } })
    return
  }
  if (error instanceof Error && error.name === "MulterError" && (error as { code?: string }).code === "LIMIT_FILE_SIZE") {
    res.status(413).json({ error: { code: "file_too_large", message: "El archivo es demasiado grande." } })
    return
  }
  if (error instanceof SupplierScheduleNotConfiguredError) {
    res.status(400).json({ error: { code: error.code, message: error.message, requiresSchedule: true } })
    return
  }
  if (error instanceof DomainError) {
    res.status(STATUS_BY_ERROR_CODE[error.code] ?? 400).json({ error: { code: error.code, message: error.message } })
    return
  }
  logger.error({ err: error }, "error_no_controlado")
  if (error instanceof Error) {
    res.status(500).json({ error: { code: "internal_error", message: "Error interno del servidor." } })
    return
  }
  res.status(500).json({ error: { code: "internal_error", message: "Error interno del servidor." } })
}

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({ error: { code: "not_found", message: `No existe ${req.method} ${req.path}.` } })
}

const readBearerToken = (header: string | undefined): string | null => {
  if (!header) return null
  const match = header.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() ?? null
}