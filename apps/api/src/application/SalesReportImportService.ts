import {
  SalesReportPeriodOverlapError,
  type DataQualityInspector,
  type DataQualityIssue,
  type SalesReport,
} from "@agente-pedidos/order-agent"
import type { SalesExcelParser } from "../infrastructure/parsers/SalesExcelParser.js"
import type { SupabaseSalesReportRepository } from "../infrastructure/supabase/repositories/SupabaseSalesReportRepository.js"
import type { SupabaseProductRepository } from "../infrastructure/supabase/repositories/SupabaseProductRepository.js"
import type { SupabaseSalesDailyRepository } from "../infrastructure/supabase/repositories/SupabaseSalesDailyRepository.js"
import type { BrandRepository } from "./ports.js"

/** El Excel a quitar no existe (o no es de esta tienda). */
export class SalesReportNotFoundError extends Error {
  readonly code = "sales_report_not_found"
}

export interface SalesReportImportResult {
  report: SalesReport
  unmatchedSales: DataQualityIssue[]
}

/** Caso de uso 7.2: subir el Excel de ventas, guardar el reporte y aplicar R8 a los costos. */
export class SalesReportImportService {
  constructor(
    private readonly parser: SalesExcelParser,
    private readonly salesReportRepository: SupabaseSalesReportRepository,
    private readonly productRepository: SupabaseProductRepository,
    private readonly brandRepository: BrandRepository,
    private readonly dataQualityInspector: DataQualityInspector,
    private readonly salesDailyRepository: SupabaseSalesDailyRepository,
  ) {}

  /**
   * Sube un Excel de ventas. Con `replacingReportId`, reemplaza ese Excel: el archivo nuevo se lee y valida
   * ANTES de quitar el anterior, así un archivo dañado no deja la tienda sin ventas.
   */
  async import(
    storeId: string,
    file: { buffer: Buffer; originalName: string },
    options: { replacingReportId?: string } = {},
  ): Promise<SalesReportImportResult> {
    const reportId = crypto.randomUUID()
    const { report, dailySales } = await this.parser.parseWithDailySales(file.buffer, reportId, file.originalName)

    if (options.replacingReportId !== undefined && !(await this.salesReportRepository.exists(storeId, options.replacingReportId))) {
      throw new SalesReportNotFoundError("Ese Excel de ventas ya no está.")
    }

    // Los días que se crucen con un Excel anterior se reemplazan en las ventas por día (no se suman dos veces),
    // así que solo se rechaza volver a subir el mismo archivo (salvo que sea el que se está reemplazando).
    const previousReports = await this.salesReportRepository.listAll(storeId)
    if (previousReports.some((previous) => previous.fileName === report.fileName && previous.id !== options.replacingReportId)) {
      throw new SalesReportPeriodOverlapError("Este archivo ya se cargó antes.")
    }
    if (options.replacingReportId !== undefined) await this.salesReportRepository.delete(storeId, options.replacingReportId)

    const products = await this.productRepository.findByBarcodes(storeId, report.lines.map((line) => line.barcode))
    const productsById = new Map(products.map((product) => [product.barcode.value, product]))

    for (const line of report.lines) {
      const product = productsById.get(line.barcode.value)
      if (product !== undefined && line.latestPurchaseCost !== null) product.applyPurchaseCostFromReport(line.latestPurchaseCost)
    }
    await this.productRepository.saveMany(
      storeId,
      products.filter((product) => !product.isEstimated || product.costSource === "sales_report"),
    )

    await this.salesReportRepository.save(storeId, report)
    await this.salesDailyRepository.upsert(storeId, report.id, dailySales)

    const unmatchedSales = this.dataQualityInspector.inspectUnmatchedSales(report.lines, new Set(products.map((product) => product.barcode.value)))
    await this.salesReportRepository.replaceUnmatchedSales(storeId, unmatchedSales)

    return { report, unmatchedSales }
  }

  /** Quita un Excel de ventas y sus ventas por día. Los costos que ya se aplicaron a los productos se conservan. */
  async remove(storeId: string, reportId: string): Promise<void> {
    if (!(await this.salesReportRepository.exists(storeId, reportId))) throw new SalesReportNotFoundError("Ese Excel de ventas ya no está.")
    await this.salesReportRepository.delete(storeId, reportId)
  }
}
