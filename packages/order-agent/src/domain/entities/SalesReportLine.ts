import type { Barcode } from "../value-objects/Barcode.js"
import type { Money } from "../value-objects/Money.js"

/** Fila del Excel de ventas: un código de barras con lo vendido en el período. */
export class SalesReportLine {
  constructor(
    readonly barcode: Barcode,
    readonly productName: string,
    readonly category: string,
    readonly unitsSold: number,
    readonly receiptCount: number,
    readonly latestPurchaseCost: Money | null,
    readonly salePrice: Money | null,
  ) {}
}