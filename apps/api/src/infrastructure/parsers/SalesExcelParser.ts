import {
  Barcode,
  DateRange,
  Money,
  SalesReport,
  SalesReportLine,
  SalesReportEmptyError,
  SalesReportMissingColumnsError,
  repairMojibake,
} from "@agente-pedidos/order-agent"
import readXlsxFile from "read-excel-file/node"

export type CellValue = unknown

type ParsedColumn =
  | "barcode"
  | "unitsSold"
  | "soldAt"
  | "productName"
  | "category"
  | "purchaseCost"
  | "salePrice"

const REQUIRED_COLUMNS: ParsedColumn[] = ["barcode", "unitsSold"]

interface RawSaleRow {
  barcode: string
  unitsSold: number
  soldAt: Date | null
  productName: string
  category: string
  purchaseCost: number | null
  salePrice: number | null
}

/** Normaliza un encabezado: minúsculas, sin tildes, sin puntuación. */
const normalizeHeader = (value: unknown): string => {
  const collapsed = String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
  return collapsed.replace(/[^a-z0-9]+/g, " ").trim()
}

const HEADER_ALIASES: Record<ParsedColumn, string[]> = {
  barcode: ["cod barra", "codigo barra", "codigo de barras"],
  unitsSold: ["cantidad"],
  soldAt: ["fecha"],
  productName: ["producto"],
  category: ["categoria"],
  purchaseCost: ["precio compra"],
  salePrice: ["pvp", "precio venta"],
}

const resolveColumnByHeader = (normalizedHeader: string): ParsedColumn | null => {
  for (const [column, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(normalizedHeader)) return column as ParsedColumn
  }
  return null
}

const EXCEL_EPOCH_OFFSET_DAYS = 25_569
const MILLISECONDS_IN_DAY = 86_400_000

/** Fechas: YYYY-MM-DD HH:mm:ss, DD/MM/YYYY, número de serie de Excel o Date. */
export const parseSalesDate = (value: unknown): Date | null => {
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date((value - EXCEL_EPOCH_OFFSET_DAYS) * MILLISECONDS_IN_DAY)
  }
  if (value === null || value === undefined) return null
  const asText = String(value).trim()
  if (asText.length === 0) return null

  const isoMatch = asText.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T].*)?$/)
  if (isoMatch) return new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))

  const dayFirstMatch = asText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T].*)?$/)
  if (dayFirstMatch) return new Date(Number(dayFirstMatch[3]), Number(dayFirstMatch[2]) - 1, Number(dayFirstMatch[1]))

  return null
}

const parseInteger = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : null
  const asText = String(value).trim().replace(/[^0-9-]/g, "")
  if (asText.length === 0) return null
  const parsed = Number(asText)
  return Number.isFinite(parsed) ? parsed : null
}

const parseUnitsSold = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const asText = String(value).trim() === "" ? null : Number(String(value).trim().replace(/\s/g, ""))
  return asText !== null && Number.isFinite(asText) ? asText : null
}

const findHeaderRow = (rows: CellValue[][]): { headerIndex: number; columnsByIndex: Map<number, ParsedColumn> } => {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const columnsByIndex = new Map<number, ParsedColumn>()
    const row = rows[rowIndex]!
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const resolvedColumn = resolveColumnByHeader(normalizeHeader(row[columnIndex]))
      if (resolvedColumn !== null) columnsByIndex.set(columnIndex, resolvedColumn)
    }
    const hasBarcode = [...columnsByIndex.values()].includes("barcode")
    const hasUnitsSold = [...columnsByIndex.values()].includes("unitsSold")
    if (hasBarcode && hasUnitsSold) return { headerIndex: rowIndex, columnsByIndex }
  }
  return { headerIndex: -1, columnsByIndex: new Map() }
}

const pickPriceFromRecentRow = (rows: RawSaleRow[]): { purchaseCost: number | null; salePrice: number | null } => {
  if (rows.length === 0) return { purchaseCost: null, salePrice: null }
  const sortedByDateDesc = [...rows].sort((left, right) => {
    const leftTime = left.soldAt?.getTime() ?? 0
    const rightTime = right.soldAt?.getTime() ?? 0
    return rightTime - leftTime
  })
  return {
    purchaseCost: parseInteger(sortedByDateDesc[0]!.purchaseCost),
    salePrice: parseInteger(sortedByDateDesc[0]!.salePrice),
  }
}

/**
 * Parser del Excel "ventas diarias" (sección 7.2).
 * Columnas del software: ID, FECHA, RECIBO, TERMINAL, COD. BARRA, CATEGORIA, PRODUCTO, CANTIDAD,
 * PRECIO COMPRA, PVP, PRECIO VENTA, CLIENTE, CAJERO, COMISION, MEDIO PAGO, TOTAL VENTA + IMP,
 * TOTAL VENTA, UTILIDAD. Todo llega como texto.
 */
export class SalesExcelParser {
  async parse(fileBuffer: Buffer, reportId: string, fileName: string): Promise<SalesReport> {
    const sheets = await readXlsxFile(fileBuffer)
    const sheet = sheets.find((candidate) => candidate.data.length > 1) ?? sheets[0]
    if (!sheet || !sheet.data || sheet.data.length < 2) throw new SalesReportEmptyError()

    const { headerIndex, columnsByIndex } = findHeaderRow(sheet.data)
    if (headerIndex < 0) {
      const missingColumns = REQUIRED_COLUMNS.map((column) => HEADER_ALIASES[column][0]!)
      throw new SalesReportMissingColumnsError(missingColumns)
    }

    const missingColumns = REQUIRED_COLUMNS.filter((column) => ![...columnsByIndex.values()].includes(column))
    if (missingColumns.length > 0) {
      throw new SalesReportMissingColumnsError(missingColumns.map((column) => HEADER_ALIASES[column][0]!))
    }

    const rawRows: RawSaleRow[] = []
    for (let rowIndex = headerIndex + 1; rowIndex < sheet.data.length; rowIndex += 1) {
      const row = sheet.data[rowIndex]!
      const readCell = (column: ParsedColumn): CellValue => {
        const columnIndex = [...columnsByIndex.entries()].find(([, value]) => value === column)?.[0]
        return columnIndex === undefined ? null : (row[columnIndex] ?? null)
      }

      const barcodeRaw = readCell("barcode")
      const unitsSold = parseUnitsSold(readCell("unitsSold"))
      if (barcodeRaw === null || String(barcodeRaw).trim() === "" || unitsSold === null || unitsSold === 0) continue

      rawRows.push({
        barcode: String(barcodeRaw).trim().replace(/\s+/g, ""),
        unitsSold,
        soldAt: parseSalesDate(readCell("soldAt")),
        productName: repairMojibake(String(readCell("productName") ?? "").trim()),
        category: repairMojibake(String(readCell("category") ?? "").trim()),
        purchaseCost: parseInteger(readCell("purchaseCost")),
        salePrice: parseInteger(readCell("salePrice")),
      })
    }

    if (rawRows.length === 0) throw new SalesReportEmptyError()

    const groupedByBarcode = new Map<string, RawSaleRow[]>()
    for (const row of rawRows) {
      const group = groupedByBarcode.get(row.barcode) ?? []
      group.push(row)
      groupedByBarcode.set(row.barcode, group)
    }

    const dates = rawRows.map((row) => row.soldAt).filter((date): date is Date => date !== null)
    const earliest = dates.length > 0 ? new Date(Math.min(...dates.map((date) => date.getTime()))) : null
    const latest = dates.length > 0 ? new Date(Math.max(...dates.map((date) => date.getTime()))) : null

    const lines = [...groupedByBarcode.entries()].map(([barcode, rows]) => {
      const recentPrices = pickPriceFromRecentRow(rows)
      return new SalesReportLine(
        Barcode.parse(barcode),
        rows[0]!.productName,
        rows[0]!.category,
        rows.reduce((total, row) => total + row.unitsSold, 0),
        rows.length,
        recentPrices.purchaseCost === null ? null : Money.fromPesos(recentPrices.purchaseCost),
        recentPrices.salePrice === null ? null : Money.fromPesos(recentPrices.salePrice),
      )
    })

    const today = new Date()
    const period = new DateRange(earliest ?? today, latest ?? today)
    return new SalesReport(reportId, fileName, period, [...lines], null)
  }
}