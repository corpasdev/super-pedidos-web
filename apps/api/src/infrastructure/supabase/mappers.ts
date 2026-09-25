import {
  Barcode,
  Brand,
  DateRange,
  Money,
  PackSize,
  Product,
  ProductSettings,
  PurchaseOrder,
  SalesReport,
  SalesReportLine,
  StockLevel,
  Supplier,
  SupplierSchedule,
  SupplierSettings,
} from "@agente-pedidos/order-agent"
import type { CostSource, VisitFrequency, Weekday } from "@agente-pedidos/order-agent"
import type { Database } from "@agente-pedidos/database-types"

export type StoreRow = Database["public"]["Tables"]["stores"]["Row"]
export type SupplierRow = Database["public"]["Tables"]["suppliers"]["Row"]
export type BrandRow = Database["public"]["Tables"]["brands"]["Row"]
export type ProductRow = Database["public"]["Tables"]["products"]["Row"]
export type ProductSettingsRow = Database["public"]["Tables"]["product_settings"]["Row"]
export type SalesReportRow = Database["public"]["Tables"]["sales_reports"]["Row"]
export type SalesReportLineRow = Database["public"]["Tables"]["sales_report_lines"]["Row"]
export type PurchaseOrderRow = Database["public"]["Tables"]["purchase_orders"]["Row"]
export type PurchaseOrderLineRow = Database["public"]["Tables"]["purchase_order_lines"]["Row"]

const parseLocalDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number)
  return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
}

export const mapWeekday = (value: number | null): Weekday | null => (value === null ? null : (value as Weekday))

export const mapVisitFrequency = (value: string | null): VisitFrequency | null =>
  value === null ? null : (value as VisitFrequency)

export const mapCostSource = (value: string): CostSource => value as CostSource

export const supplierFromRow = (row: SupplierRow): Supplier => {
  const hasSchedule =
    row.order_weekday !== null && row.delivery_weekday !== null && row.visit_frequency !== null
  const schedule = hasSchedule
    ? new SupplierSchedule(
        mapWeekday(row.order_weekday)!,
        mapWeekday(row.delivery_weekday)!,
        mapVisitFrequency(row.visit_frequency)!,
        row.biweekly_anchor_date === null ? null : parseLocalDate(row.biweekly_anchor_date),
      )
    : null
  return new Supplier(
    row.id,
    row.name,
    row.tax_id,
    row.contact_email,
    new SupplierSettings(
      schedule,
      Money.fromPesos(row.minimum_order_amount),
      row.settings_are_estimated,
      row.maximum_order_amount === null ? null : Money.fromPesos(row.maximum_order_amount),
    ),
  )
}

export const supplierToUpdate = (supplier: Supplier): Database["public"]["Tables"]["suppliers"]["Update"] => ({
  name: supplier.name,
  tax_id: supplier.taxId,
  contact_email: supplier.contactEmail,
  order_weekday: supplier.orderWeekday ?? null,
  delivery_weekday: supplier.deliveryWeekday ?? null,
  visit_frequency: supplier.visitFrequency ?? null,
  biweekly_anchor_date: supplier.schedule?.biweeklyAnchorDate ? toDateString(supplier.schedule.biweeklyAnchorDate) : null,
  minimum_order_amount: supplier.minimumOrderAmount.pesos,
  maximum_order_amount: supplier.maximumOrderAmount?.pesos ?? null,
  settings_are_estimated: supplier.isEstimated,
  updated_at: new Date().toISOString(),
})

const toDateString = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

export const brandFromRow = (row: BrandRow): Brand => new Brand(row.id, row.name, row.supplier_id)

export const productFromRows = (
  productRow: ProductRow,
  settingsRow: ProductSettingsRow | null,
): Product =>
  new Product(
    productRow.id,
    Barcode.parse(productRow.barcode),
    productRow.name,
    productRow.category,
    Money.fromPesos(productRow.sale_price),
    productRow.supplier_id ?? "",
    productRow.brand_id,
    new ProductSettings(
      settingsRow?.max_stock_units ?? null,
      Money.fromPesos(settingsRow?.unit_cost ?? 0),
      mapCostSource(settingsRow?.cost_source ?? "estimated"),
      PackSize.of(settingsRow?.pack_size ?? 1),
      settingsRow?.is_estimated ?? true,
    ),
    new StockLevel(productRow.stock_units, productRow.is_stock_reliable),
  )

export const salesReportLineFromRow = (row: SalesReportLineRow): SalesReportLine =>
  new SalesReportLine(
    Barcode.parse(row.barcode),
    row.product_name ?? "",
    row.category ?? "",
    Number(row.units_sold),
    row.receipt_count,
    row.latest_purchase_cost === null ? null : Money.fromPesos(row.latest_purchase_cost),
    row.sale_price === null ? null : Money.fromPesos(row.sale_price),
  )

export const salesReportFromRows = (reportRow: SalesReportRow, lines: SalesReportLineRow[]): SalesReport =>
  new SalesReport(
    reportRow.id,
    reportRow.file_name,
    new DateRange(new Date(reportRow.period_starts_at), new Date(reportRow.period_ends_at)),
    lines.map(salesReportLineFromRow),
    reportRow.covered_days_override,
  )

export const purchaseOrderFromRows = (
  orderRow: PurchaseOrderRow,
  lines: PurchaseOrderLineRow[],
): PurchaseOrder =>
  new PurchaseOrder(
    orderRow.id,
    orderRow.supplier_id,
    new Date(orderRow.created_at),
    lines.map((line) => ({
      productId: line.product_id,
      units: line.units,
      unitCost: Money.fromPesos(line.unit_cost),
    })),
    orderRow.status as "confirmed" | "received",
    {
      availableBudget: orderRow.available_budget === null ? null : Money.fromPesos(orderRow.available_budget),
      maximumOrderCost: Money.fromPesos(orderRow.maximum_order_cost),
    },
  )