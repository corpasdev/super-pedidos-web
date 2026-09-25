import {
  SalesReportPeriodOverlapError,
  type DataQualityInspector,
  type DataQualityIssue,
  type SalesReport,
} from "@agente-pedidos/order-agent"
import type { SalesExcelParser } from "../infrastructure/parsers/SalesExcelParser.js"
import type { SupabaseSalesReportRepository } from "../infrastructure/supabase/repositories/SupabaseSalesReportRepository.js"
import type { SupabaseProductRepository } from "../infrastructure/supabase/repositories/SupabaseProductRepository.js"
import type { BrandRepository } from "./ports.js"

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
  ) {}

  async import(storeId: string, file: { buffer: Buffer; originalName: string }): Promise<SalesReportImportResult> {
    const reportId = crypto.randomUUID()
    const report = await this.parser.parse(file.buffer, reportId, file.originalName)

    const latestReports = await this.salesReportRepository.listAll(storeId)
    if (latestReports.some((previous) => previous.fileName === report.fileName)) {
      throw new SalesReportPeriodOverlapError("Este archivo ya se cargó antes.")
    }
    if (latestReports.some((previous) => datesOverlap(previous, report))) {
      throw new SalesReportPeriodOverlapError("Los días de este reporte ya están cubiertos por uno anterior; súbelo después de confirmar con el vendedor.")
    }

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

    const unmatchedSales = this.dataQualityInspector.inspectUnmatchedSales(report.lines, new Set(products.map((product) => product.barcode.value)))
    await this.salesReportRepository.replaceUnmatchedSales(storeId, unmatchedSales)

    return { report, unmatchedSales }
  }
}

const datesOverlap = (
  left: { period: { startsAt: Date; endsAt: Date } },
  right: { period: { startsAt: Date; endsAt: Date } },
): boolean =>
  left.period.startsAt.getTime() <= right.period.endsAt.getTime() &&
  right.period.startsAt.getTime() <= left.period.endsAt.getTime()