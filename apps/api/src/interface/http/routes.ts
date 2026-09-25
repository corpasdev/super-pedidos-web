import { Router, type Request } from "express"
import multer from "multer"
import type { ReplenishmentMode } from "@agente-pedidos/order-agent"
import type { Container } from "../../container.js"
import { LOGO_MAX_BYTES, StoreLogoRejectedError, isAllowedLogoType } from "../../application/StoreProfileService.js"
import {
  buildSuggestionBodySchema,
  confirmOrderBodySchema,
  countStockBodySchema,
  createStoreBodySchema,
  openDailyCashBodySchema,
  updateOrderPaymentBodySchema,
  updateStoreProfileBodySchema,
  updateProductSettingsBodySchema,
  updateReportSettingsBodySchema,
  updateSupplierBodySchema,
} from "./schemas.js"
import { requireAuthenticatedOwner, requireStore, type AuthenticatedRequest } from "./middlewares.js"
import {
  dataQualityIssuePresenter,
  orderSuggestionPresenter,
  productPresenter,
  purchaseOrderPresenter,
  salesReportPresenter,
  supplierDetailPresenter,
  supplierPresenter,
  truckDeliveryPresenter,
} from "./presenters.js"

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
})

const logoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: LOGO_MAX_BYTES, files: 1 },
})

const storeIdOf = (req: Request): string => (req as AuthenticatedRequest).storeId as string

const param = (req: Request, name: string): string => req.params[name] as string

export const buildApiRouter = (container: Container): Router => {
  const router = Router()
  const { supabase } = container

  router.use(
    requireAuthenticatedOwner(supabase, (ownerUserId) => container.storeRepository.findStoreIdByOwner(ownerUserId)),
  )

  // â”€â”€ Tienda â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.get("/stores", async (req, res) => {
    const store = await container.storeSettingsService.findForOwner((req as AuthenticatedRequest).ownerUserId)
    res.json({ store })
  })

  router.post("/stores", async (req, res) => {
    const body = createStoreBodySchema.parse(req.body)
    const store = await container.storeSettingsService.createForOwner((req as AuthenticatedRequest).ownerUserId, body.name)
    res.status(201).json({ store })
  })

  // Configuración de la tienda: nombre, administrador, correo y logo (Supabase Storage).
  router.get("/store-profile", requireStore, async (req, res) => {
    res.json({ profile: await container.storeProfileService.get(storeIdOf(req)) })
  })

  router.patch("/store-profile", requireStore, async (req, res) => {
    const body = updateStoreProfileBodySchema.parse(req.body)
    res.json({ profile: await container.storeProfileService.update(storeIdOf(req), body) })
  })

  router.post("/store-profile/logo", requireStore, logoUpload.single("file"), async (req, res) => {
    if (!req.file) throw new StoreLogoRejectedError("Envía la imagen en el campo 'file'.")
    if (!isAllowedLogoType(req.file.mimetype)) throw new StoreLogoRejectedError("El logo debe ser PNG, JPG o WebP.")
    const profile = await container.storeProfileService.replaceLogo(storeIdOf(req), {
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      size: req.file.size,
    })
    res.status(201).json({ profile })
  })

  router.delete("/store-profile/logo", requireStore, async (req, res) => {
    res.json({ profile: await container.storeProfileService.removeLogo(storeIdOf(req)) })
  })

  // â”€â”€ Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.get("/dashboard", requireStore, async (req, res) => {
    const storeId = storeIdOf(req)
    const [suppliers, dataQualityIssues, pendingOrders, latestReport] = await Promise.all([
      supabase.from("suppliers").select("id", { count: "exact" }).eq("store_id", storeId),
      supabase.from("data_quality_issues").select("id", { count: "exact" }).eq("store_id", storeId),
      supabase.from("purchase_orders").select("id", { count: "exact" }).eq("store_id", storeId).eq("status", "confirmed"),
      container.salesReportRepository.findLatest(storeId),
    ])
    res.json({
      supplierCount: suppliers.count ?? 0,
      issueCount: dataQualityIssues.count ?? 0,
      pendingOrderCount: pendingOrders.count ?? 0,
      latestReport: salesReportPresenter(latestReport),
    })
  })

  // â”€â”€ Proveedores â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.get("/suppliers", requireStore, async (req, res) => {
    const storeId = storeIdOf(req)
    const sources = await container.supplierRepository.listWithProductCount(storeId)
    res.json({ suppliers: sources.map(supplierPresenter) })
  })

  router.patch("/suppliers/:supplierId", requireStore, async (req, res) => {
    const storeId = storeIdOf(req)
    const body = updateSupplierBodySchema.parse(req.body)
    const supplier = await container.supplierSettingsService.update(storeId, param(req, "supplierId"), body)
    res.json({ supplier: supplierDetailPresenter(supplier) })
  })

  // â”€â”€ Productos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.get("/suppliers/:supplierId/products", requireStore, async (req, res) => {
    const storeId = storeIdOf(req)
    const products = await container.productRepository.listBySupplier(storeId, param(req, "supplierId"))
    const brandNamesByProductId = await container.brandRepository.listNamesByProductIds(
      storeId,
      products.map((product) => product.id),
    )
    res.json({ products: products.map((product) => productPresenter(product, brandNamesByProductId.get(product.id) ?? null)) })
  })

  // Todos los productos de la tienda (vista Productos sin filtro de proveedor).
  router.get("/products", requireStore, async (req, res) => {
    const rows = await container.productRepository.listAllWithNames(storeIdOf(req))
    res.json({ products: rows.map((row) => productPresenter(row.product, row.brandName, row.supplierName)) })
  })

  router.patch("/products/:productId/settings", requireStore, async (req, res) => {
    const storeId = storeIdOf(req)
    const body = updateProductSettingsBodySchema.parse(req.body)
    const { product, brandName } = await container.productSettingsService.update(storeId, param(req, "productId"), body)
    res.json({ product: productPresenter(product, brandName) })
  })

  router.patch("/products/:productId/stock", requireStore, async (req, res) => {
    const storeId = storeIdOf(req)
    const body = countStockBodySchema.parse(req.body)
    await container.productSettingsService.countStock(storeId, param(req, "productId"), body.units)
    res.json({ ok: true })
  })

  // â”€â”€ CatÃ¡logo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/catalog/import", requireStore, async (req, res) => {
    const storeId = storeIdOf(req)
    const payload = req.body
    if (payload === null || typeof payload !== "object") throw new Error("El cuerpo debe ser un JSON con 'suppliers' y 'products'.")
    const result = await container.catalogImportService.import(storeId, {
      suppliers: payload.suppliers,
      products: payload.products,
    })
    res.json({
      suppliersImported: result.suppliersImported,
      productsImported: result.productsImported,
      productsWithUnknownSupplier: result.productsWithUnknownSupplier,
      issues: result.issues.map(dataQualityIssuePresenter),
    })
  })

  // â”€â”€ Reporte de ventas â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/sales-reports/import", requireStore, upload.single("file"), async (req, res) => {
    const storeId = storeIdOf(req)
    if (!req.file) throw new Error("EnvÃ­a el archivo en el campo 'file'.")
    const result = await container.salesReportImportService.import(storeId, {
      buffer: req.file.buffer,
      originalName: req.file.originalname,
    })
    res.status(201).json({
      report: salesReportPresenter(result.report),
      unmatchedSales: result.unmatchedSales.map(dataQualityIssuePresenter),
    })
  })

  router.get("/sales-reports/latest", requireStore, async (req, res) => {
    const storeId = storeIdOf(req)
    const report = await container.salesReportRepository.findLatest(storeId)
    res.json({ report: salesReportPresenter(report) })
  })

  router.patch("/sales-reports/:reportId/settings", requireStore, async (req, res) => {
    const storeId = storeIdOf(req)
    const body = updateReportSettingsBodySchema.parse(req.body)
    const report = await container.salesReportRepository.findLatest(storeId)
    if (report === null || report.id !== param(req, "reportId")) {
      res.status(404).json({ error: { code: "report_not_found", message: "Ese reporte de ventas ya no estÃ¡." } })
      return
    }
    await container.salesReportRepository.updateSettings(storeId, param(req, "reportId"), {
      covered_days_override: body.coveredDaysOverride ?? null,
      replenishment_mode: body.replenishmentMode ?? "fill_to_base",
      safety_margin_ratio: body.safetyMarginRatio ?? 0.1,
    })
    res.json({ ok: true })
  })

  // â”€â”€ Calidad de datos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.get("/data-quality-issues", requireStore, async (req, res) => {
    const storeId = storeIdOf(req)
    const { data, error } = await supabase.from("data_quality_issues").select("*").eq("store_id", storeId)
    if (error) throw error
    res.json({
      issues: (data ?? []).map((row) => ({
        issueCode: row.issue_code,
        barcode: row.barcode,
        productId: row.product_id,
        originalValue: row.original_value,
        description: row.description,
      })),
    })
  })

  // â”€â”€ Pedido sugerido â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.post("/order-suggestions/suppliers/:supplierId", requireStore, async (req, res) => {
    const storeId = storeIdOf(req)
    const body = buildSuggestionBodySchema.parse(req.body)
    const { suggestion, budget } = await container.orderSuggestionService.buildSuggestion({
      storeId,
      supplierId: param(req, "supplierId"),
      budgetPesos: body.budgetPesos ?? null,
      replenishmentMode: body.replenishmentMode as ReplenishmentMode,
      unitCostOverrides: body.unitCostOverrides,
    })
    res.json({ suggestion: orderSuggestionPresenter(suggestion), budget })
  })

  router.post("/order-suggestions/suppliers/:supplierId/confirm", requireStore, async (req, res) => {
    const storeId = storeIdOf(req)
    const body = confirmOrderBodySchema.parse(req.body)
    const built = await container.orderSuggestionService.buildSuggestion({
      storeId,
      supplierId: param(req, "supplierId"),
      budgetPesos: body.budgetPesos ?? null,
      replenishmentMode: body.replenishmentMode as ReplenishmentMode,
      unitCostOverrides: body.unitCostOverrides,
    })
    let suggestion = built.suggestion
    if (body.adjustments !== undefined) {
      for (const adjustment of body.adjustments) {
        suggestion = suggestion.withOwnerUnits(adjustment.productId, adjustment.units)
      }
    }
    const order = await container.purchaseOrderService.confirm(storeId, suggestion)
    res
      .status(201)
      .json({
        order: purchaseOrderPresenter(order),
        suggestion: orderSuggestionPresenter(suggestion),
        budget: built.budget,
        dailyCash: await container.dailyCashService.today(storeId),
      })
  })

  // Caja del día: el efectivo al abrir; cada pedido confirmado hoy se descuenta.
  router.get("/daily-cash/today", requireStore, async (req, res) => {
    res.json({ dailyCash: await container.dailyCashService.today(storeIdOf(req)) })
  })

  router.put("/daily-cash/today", requireStore, async (req, res) => {
    const body = openDailyCashBodySchema.parse(req.body)
    res.json({ dailyCash: await container.dailyCashService.open(storeIdOf(req), body.openingAmount) })
  })

  // â”€â”€ Historial y aterrizar pedidos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  router.get("/purchase-orders", requireStore, async (req, res) => {
    const storeId = storeIdOf(req)
    const { data: orderRows, error } = await supabase
      .from("purchase_orders")
      .select(
        "id, supplier_id, status, total_cost, available_budget, maximum_order_cost, created_at, paid_amount, pending_amount, is_settled, paid_at, suppliers(name)",
      )
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
      .limit(100)
    if (error) throw error
    res.json({
      orders: (orderRows ?? []).map((row) => ({
        id: row.id,
        supplierId: row.supplier_id,
        supplierName: (row as unknown as { suppliers: { name: string } | null }).suppliers?.name ?? null,
        status: row.status,
        totalCost: row.total_cost,
        availableBudget: row.available_budget,
        maximumOrderCost: row.maximum_order_cost,
        createdAt: row.created_at,
        paidAmount: row.paid_amount,
        pendingAmount: row.pending_amount,
        isSettled: row.is_settled,
        paidAt: row.paid_at,
      })),
    })
  })

  // Pago al proveedor: marcar saldado o registrar cuánto queda pendiente.
  router.patch("/purchase-orders/:orderId/payment", requireStore, async (req, res) => {
    const body = updateOrderPaymentBodySchema.parse(req.body)
    const payment = await container.orderPaymentService.update(storeIdOf(req), param(req, "orderId"), body)
    res.json({ payment })
  })

  router.get("/purchase-orders/:orderId", requireStore, async (req, res) => {
    const storeId = storeIdOf(req)
    const order = await container.purchaseOrderRepository.findById(storeId, param(req, "orderId"))
    if (order === null) throw new Error("no_se_encontro_el_pedido")
    res.json({ order: purchaseOrderPresenter(order) })
  })

  router.post("/purchase-orders/:orderId/receive", requireStore, async (req, res) => {
    const storeId = storeIdOf(req)
    const delivery = await container.truckDeliveryService.finalize(storeId, param(req, "orderId"))
    res.json({ delivery: truckDeliveryPresenter(delivery) })
  })

  return router
}
