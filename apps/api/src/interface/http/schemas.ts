import { z } from "zod"

export const weekdaysSchema = z.number().int().min(1).max(7)
export const moneyPesosSchema = z.number().int().min(0)
export const nullableMoneyPesosSchema = z.number().int().min(0).nullable()
export const unitsSchema = z.number().int().min(0)
export const replenishmentModeSchema = z.enum(["replenish_sold", "fill_to_target", "fill_to_base", "levels"])
export const visitFrequencySchema = z.enum(["weekly", "biweekly"])
export const costSourceSchema = z.enum(["owner", "sales_report", "estimated"])
export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Usa el formato YYYY-MM-DD")
export const optionalStringSchema = z.string().trim().max(200).nullable()

export const scheduleSchema = z
  .object({
    orderWeekday: weekdaysSchema,
    deliveryWeekday: weekdaysSchema,
    visitFrequency: visitFrequencySchema,
    biweeklyAnchorDate: dateOnlySchema.nullable().optional(),
  })
  .nullable()

export const updateSupplierBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    taxId: optionalStringSchema.optional(),
    contactEmail: optionalStringSchema.optional(),
    schedule: scheduleSchema.optional(),
    minimumOrderAmount: nullableMoneyPesosSchema.optional(),
    maximumOrderAmount: nullableMoneyPesosSchema.optional(),
    settingsAreEstimated: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Envía al menos un campo para actualizar")

export const updateProductSettingsBodySchema = z.object({
  maxStockUnits: z.number().int().min(0).nullable().optional(),
  minStockUnits: z.number().int().min(0).nullable().optional(),
  reorderPointUnits: z.number().int().min(0).nullable().optional(),
  unitCost: moneyPesosSchema.optional(),
  salePrice: moneyPesosSchema.optional(),
  packSize: z.number().int().min(1).max(10_000).optional(),
  isEstimated: z.boolean().optional(),
  costSource: costSourceSchema.optional(),
  brandName: z.string().trim().min(1).max(120).nullable().optional(),
})

export const createSupplierBodySchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    taxId: z.string().trim().max(40).nullable().optional(),
    contactEmail: z.string().trim().email().nullable().optional().or(z.literal("")),
    orderWeekday: weekdaysSchema,
    deliveryWeekday: weekdaysSchema,
    visitFrequency: visitFrequencySchema.default("weekly"),
    minimumOrderAmount: moneyPesosSchema.default(20_000),
    maximumOrderAmount: moneyPesosSchema.default(250_000),
  })
  .refine((body) => body.minimumOrderAmount <= body.maximumOrderAmount, {
    message: "El mínimo no puede ser mayor que el tope.",
    path: ["minimumOrderAmount"],
  })

export const createProductBodySchema = z.object({
  barcode: z.string().trim().min(1).max(40),
  name: z.string().trim().min(1).max(200),
  category: z.string().trim().min(1).max(80),
  supplierId: z.string().uuid().nullable().optional(),
  salePrice: moneyPesosSchema,
  unitCost: moneyPesosSchema.nullable().optional(),
  stockUnits: unitsSchema.optional(),
  minStockUnits: unitsSchema.nullable().optional(),
  maxStockUnits: unitsSchema.nullable().optional(),
})

export const createExpiredExchangeBodySchema = z.object({
  productId: z.string().uuid(),
  units: z.number().int().min(1).max(10_000),
  supplierId: z.string().uuid().nullable().optional(),
})

export const countStockBodySchema = z.object({ units: unitsSchema })

/** Precio que dio el vendedor para ESTE pedido (el costo del proveedor varía; no se guarda en el producto). */
export const unitCostOverrideSchema = z.object({
  productId: z.string().uuid(),
  unitCost: moneyPesosSchema,
})

export const buildSuggestionBodySchema = z.object({
  replenishmentMode: replenishmentModeSchema,
  budgetPesos: nullableMoneyPesosSchema.optional(),
  unitCostOverrides: z.array(unitCostOverrideSchema).max(2000).optional(),
})

export const adjustmentSchema = z.object({
  productId: z.string().uuid(),
  units: unitsSchema,
})

export const confirmOrderBodySchema = z.object({
  replenishmentMode: replenishmentModeSchema,
  budgetPesos: nullableMoneyPesosSchema.optional(),
  adjustments: z.array(adjustmentSchema).max(500).optional(),
  unitCostOverrides: z.array(unitCostOverrideSchema).max(2000).optional(),
  /** Vendedor que tomó el pedido (define el día de llegada y si se recibe en el acto). */
  sellerId: z.string().uuid().optional(),
  /** Solo si el vendedor entrega el mismo día: se pagó al distribuidor en el momento. */
  paidNow: z.boolean().optional(),
})

export const updateStoreProfileBodySchema = z
  .object({
    name: z.string().trim().min(1, "Escribe el nombre de la tienda").max(120).optional(),
    adminName: z.string().trim().max(120).nullable().optional(),
    contactEmail: z.string().trim().email("Escribe un correo válido").max(200).nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, "Envía al menos un campo para actualizar")

/** Pago del pedido: marcarlo saldado o escribir cuánto queda pendiente. */
export const updateOrderPaymentBodySchema = z.union([
  z.object({ settled: z.boolean() }).strict(),
  z.object({ pendingAmount: moneyPesosSchema }).strict(),
])

/** Día de la bandeja (YYYY-MM-DD); sin día = hoy. */
export const inboxDayQuerySchema = dateOnlySchema.optional()

export const openDailyCashBodySchema = z.object({ openingAmount: moneyPesosSchema })

export const createStoreBodySchema = z.object({ name: z.string().trim().min(1).max(120) })

export const updateReportSettingsBodySchema = z.object({
  coveredDaysOverride: z.number().int().min(1).max(365).nullable().optional(),
  replenishmentMode: replenishmentModeSchema.optional(),
  safetyMarginRatio: z.number().min(0).max(0.5).optional(),
})