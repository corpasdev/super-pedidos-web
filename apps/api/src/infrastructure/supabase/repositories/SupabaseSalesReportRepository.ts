import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"
import { DateRange } from "@agente-pedidos/order-agent"
import type { DataQualityIssue, SalesReport, SalesReportRepository } from "@agente-pedidos/order-agent"
import { salesReportFromRows } from "../mappers.js"

const salesReportProjectionFromRow = (
  fileName: string,
  startsAt: string,
  endsAt: string,
): Pick<SalesReport, "fileName" | "period"> => ({
  fileName,
  period: new DateRange(new Date(startsAt), new Date(endsAt)),
})

export class SupabaseSalesReportRepository implements SalesReportRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listAll(storeId: string): Promise<Array<Pick<SalesReport, "fileName" | "period">>> {
    const { data: reportRows, error } = await this.supabase
      .from("sales_reports")
      .select("file_name, period_starts_at, period_ends_at")
      .eq("store_id", storeId)
    if (error) throw error
    return (reportRows ?? []).map((row) => salesReportProjectionFromRow(row.file_name, row.period_starts_at, row.period_ends_at))
  }

  async replaceUnmatchedSales(storeId: string, issues: DataQualityIssue[]): Promise<void> {
    const { error: deleteError } = await this.supabase
      .from("data_quality_issues")
      .delete()
      .eq("store_id", storeId)
      .eq("issue_code", "unmatched_sale")
    if (deleteError) throw deleteError
    if (issues.length === 0) return

    const { error: insertError } = await this.supabase.from("data_quality_issues").insert(
      issues.map((issue) => ({
        store_id: storeId,
        product_id: issue.productId,
        barcode: issue.barcode,
        issue_code: issue.issueCode,
        original_value: issue.originalValue,
        description: issue.description,
      })),
    )
    if (insertError) throw insertError
  }

  async findLatest(storeId: string): Promise<SalesReport | null> {
    const { data: reportRow, error: reportError } = await this.supabase
      .from("sales_reports")
      .select("*")
      .eq("store_id", storeId)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    if (reportError) throw reportError
    if (!reportRow) return null

    const { data: lineRows, error: linesError } = await this.supabase
      .from("sales_report_lines")
      .select("*")
      .eq("store_id", storeId)
      .eq("sales_report_id", reportRow.id)
    if (linesError) throw linesError

    return salesReportFromRows(reportRow, lineRows ?? [])
  }

  async save(storeId: string, report: SalesReport): Promise<void> {
    const { error: reportError } = await this.supabase.from("sales_reports").insert({
      id: report.id,
      store_id: storeId,
      file_name: report.fileName,
      period_starts_at: report.period.startsAt.toISOString(),
      period_ends_at: report.period.endsAt.toISOString(),
      covered_days_override: report.hasCoveredDaysOverride ? report.reportCoveredDays : null,
    })
    if (reportError) throw reportError

    if (report.lines.length > 0) {
      const { error: linesError } = await this.supabase.from("sales_report_lines").insert(
        report.lines.map((line) => ({
          sales_report_id: report.id,
          store_id: storeId,
          barcode: line.barcode.value,
          product_name: line.productName || null,
          category: line.category || null,
          units_sold: line.unitsSold,
          receipt_count: line.receiptCount,
          latest_purchase_cost: line.latestPurchaseCost?.pesos ?? null,
          sale_price: line.salePrice?.pesos ?? null,
        })),
      )
      if (linesError) throw linesError
    }
  }

  async updateSettings(
    storeId: string,
    reportId: string,
    changes: { covered_days_override: number | null; replenishment_mode: string; safety_margin_ratio: number },
  ): Promise<void> {
    const { error } = await this.supabase
      .from("sales_reports")
      .update(changes)
      .eq("store_id", storeId)
      .eq("id", reportId)
    if (error) throw error
  }
}