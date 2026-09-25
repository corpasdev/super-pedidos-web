import type { SalesReport } from "../entities/SalesReport.js"

export interface SalesReportRepository {
  findLatest(storeId: string): Promise<SalesReport | null>
  save(storeId: string, report: SalesReport): Promise<void>
}