import type { SalesReportLine } from "../entities/SalesReportLine.js"

export interface RawImportedProduct {
  id: string
  supplierId: string | null
  supplierName: string | null
  barcode: string
  productName: string
  category: string
  /** null = la cantidad no es numérica (un código de barras escrito en la cantidad). */
  stockUnits: number | null
  salePrice: number
}

export type DataQualityIssueCode =
  | "impossible_stock"
  | "negative_stock"
  | "initial_load_stock"
  | "missing_supplier"
  | "missing_sale_price"
  | "unmatched_sale"

export interface DataQualityIssue {
  productId: string | null
  barcode: string | null
  issueCode: DataQualityIssueCode
  originalValue: string | null
  description: string
}

/** Servicio de dominio sin estado: marca los datos dudosos sin borrarlos (R10, sección 7.3). */
export class DataQualityInspector {
  inspect(products: RawImportedProduct[]): DataQualityIssue[] {
    const issues: DataQualityIssue[] = []
    for (const product of products) {
      if (product.stockUnits === null) {
        issues.push({
          productId: product.id,
          barcode: product.barcode,
          issueCode: "impossible_stock",
          originalValue: "no numérico",
          description: `El producto ${product.productName} tiene una cantidad no numérica; su stock queda como no confiable.`,
        })
      } else if (product.stockUnits > MAX_PLAUSIBLE_STOCK_UNITS) {
        issues.push({
          productId: product.id,
          barcode: product.barcode,
          issueCode: "impossible_stock",
          originalValue: String(product.stockUnits),
          description: `El producto ${product.productName} tiene un stock de ${product.stockUnits}; se marca como no confiable y queda fuera de FillToTarget.`,
        })
      } else if (product.stockUnits < 0) {
        issues.push({
          productId: product.id,
          barcode: product.barcode,
          issueCode: "negative_stock",
          originalValue: String(product.stockUnits),
          description: `El producto ${product.productName} tiene stock negativo (${product.stockUnits}); se usa 0.`,
        })
      } else if (product.stockUnits >= INITIAL_LOAD_LOWER_BOUND && product.stockUnits <= INITIAL_LOAD_UPPER_BOUND) {
        issues.push({
          productId: product.id,
          barcode: product.barcode,
          issueCode: "initial_load_stock",
          originalValue: String(product.stockUnits),
          description: `El producto ${product.productName} tiene ${product.stockUnits} unidades, que parece una carga inicial nunca contada; revise el stock.`,
        })
      }

      if (product.supplierId === null || product.supplierName === null) {
        issues.push({
          productId: product.id,
          barcode: product.barcode,
          issueCode: "missing_supplier",
          originalValue: product.supplierName === null ? "sin proveedor" : null,
          description: `El producto ${product.productName} no tiene proveedor reconocido; queda fuera de todos los pedidos.`,
        })
      }

      if (product.salePrice === 0) {
        issues.push({
          productId: product.id,
          barcode: product.barcode,
          issueCode: "missing_sale_price",
          originalValue: "0",
          description: `El producto ${product.productName} no tiene precio de venta; no se puede estimar su costo.`,
        })
      }
    }
    return issues
  }

  /** Códigos del Excel que no existen en el catálogo (aviso del paso 2). */
  inspectUnmatchedSales(
    lines: readonly SalesReportLine[],
    catalogBarcodes: ReadonlySet<string>,
  ): DataQualityIssue[] {
    return lines
      .filter((line) => !catalogBarcodes.has(line.barcode.value))
      .map((line) => ({
        productId: null,
        barcode: line.barcode.value,
        issueCode: "unmatched_sale" as const,
        originalValue: line.barcode.value,
        description: `${line.productName || "Producto desconocido"} (${line.barcode.value}) se vendió en el Excel pero no existe en el catálogo; no se puede sugerir.`,
      }))
  }
}

export const MAX_PLAUSIBLE_STOCK_UNITS = 10_000
export const INITIAL_LOAD_LOWER_BOUND = 990
export const INITIAL_LOAD_UPPER_BOUND = 1_020