import type { SalesReportLine } from "./SalesReportLine.js"
import type { DateRange } from "../value-objects/DateRange.js"
import type { Barcode } from "../value-objects/Barcode.js"
import type { Money } from "../value-objects/Money.js"

/** Entidad: el Excel de ventas diarias descargado del software. */
export class SalesReport {
  private readonly reportLines: readonly SalesReportLine[]

  constructor(
    readonly id: string,
    readonly fileName: string,
    readonly period: DateRange,
    lines: readonly SalesReportLine[],
    private coveredDaysOverride: number | null,
  ) {
    this.reportLines = [...lines]
  }

  get lines(): readonly SalesReportLine[] {
    return this.reportLines
  }

  get reportCoveredDays(): number {
    return this.coveredDaysOverride ?? this.period.coveredDays
  }

  /** El dueño puede corregir los días que cubre el Excel (0 para volver al automático). */
  setCoveredDaysOverride(days: number | null): void {
    this.coveredDaysOverride = days
  }

  get hasCoveredDaysOverride(): boolean {
    return this.coveredDaysOverride !== null
  }

  unitsSoldFor(barcode: Barcode): number {
    return this.reportLines.find((line) => line.barcode.equals(barcode))?.unitsSold ?? 0
  }

  latestPurchaseCostFor(barcode: Barcode): Money | null {
    return this.reportLines.find((line) => line.barcode.equals(barcode))?.latestPurchaseCost ?? null
  }

  /** Líneas del Excel cuyo código no existe en el catálogo (aviso del paso 2). */
  unmatchedLines(catalogBarcodes: Set<string>): SalesReportLine[] {
    return this.reportLines.filter((line) => !catalogBarcodes.has(line.barcode.value))
  }
}