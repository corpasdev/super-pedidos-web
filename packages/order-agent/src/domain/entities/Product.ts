import { CostSource } from "../enums.js"
import type { ProductSettings, ProductSettingsProps } from "./ProductSettings.js"
import type { StockLevel } from "./StockLevel.js"
import { StockLevel as StockLevelValue } from "./StockLevel.js"
import type { Barcode } from "../value-objects/Barcode.js"
import { Money } from "../value-objects/Money.js"
import { estimateUnitCost } from "../../formulas/estimatedCost.js"
import type { PackSize } from "../value-objects/PackSize.js"

/** Entidad: producto = un código de barras con su propio stock, costo y empaque. */
export class Product {
  constructor(
    readonly id: string,
    readonly barcode: Barcode,
    readonly name: string,
    readonly category: string,
    readonly salePrice: Money,
    readonly supplierId: string,
    private brandId: string | null,
    private settings: ProductSettings,
    private stock: StockLevel,
  ) {}

  get brandIdentifier(): string | null {
    return this.brandId
  }

  get packSize(): PackSize {
    return this.settings.packSize
  }

  /** true si no hay costo conocido (está en $0 y no lo escribió el dueño): se usa el estimado por categoría. */
  private get usesEstimatedCost(): boolean {
    return this.settings.unitCost.pesos === 0 && this.settings.costSource !== CostSource.Owner
  }

  /** R8: dueño → PRECIO COMPRA del Excel → estimado (precio de venta ÷ 1,30 en dulcería, ÷ 1,20 en el resto). */
  get unitCost(): Money {
    return this.usesEstimatedCost
      ? Money.fromPesos(estimateUnitCost(this.salePrice.pesos, this.category))
      : this.settings.unitCost
  }

  get costSource(): CostSource {
    return this.usesEstimatedCost ? CostSource.Estimated : this.settings.costSource
  }

  /** Sin costo ni precio de venta para estimarlo: el pedido lo marca "sin costo". */
  get hasNoCost(): boolean {
    return this.unitCost.pesos === 0
  }

  get maxStockUnits(): number | null {
    return this.settings.maxStockUnits
  }

  get stockUnits(): number {
    return this.stock.units
  }

  get isStockReliable(): boolean {
    return this.stock.isReliable
  }

  get isEstimated(): boolean {
    return this.settings.isEstimated
  }

  assignBrand(brandId: string): void {
    this.brandId = brandId
  }

  updateSettings(changes: Partial<ProductSettingsProps>): void {
    this.settings = {
      maxStockUnits: changes.maxStockUnits !== undefined ? changes.maxStockUnits : this.settings.maxStockUnits,
      unitCost: changes.unitCost ?? this.settings.unitCost,
      costSource: changes.costSource ?? this.settings.costSource,
      packSize: changes.packSize ?? this.settings.packSize,
      isEstimated: changes.isEstimated ?? this.settings.isEstimated,
    }
  }

  /** R8: el costo sale del Excel más reciente solo si el dueño no escribió uno propio. */
  applyPurchaseCostFromReport(latestPurchaseCost: Money): void {
    if (this.settings.costSource === CostSource.Owner) return
    // PRECIO COMPRA en 0 no es un costo real (caso "Bombom unidad"): se deja el que había o el estimado.
    if (latestPurchaseCost.pesos === 0) return
    this.updateSettings({ unitCost: latestPurchaseCost, costSource: CostSource.SalesReport })
  }

  receiveUnits(units: number): void {
    this.stock = new StockLevelValue(this.stock.units + units, this.stock.isReliable)
  }

  /** HU3: el dueño cuenta el stock y queda confiable. */
  markStockAsCounted(units: number): void {
    this.stock = new StockLevelValue(Math.max(0, Math.round(units)), true)
  }

  registerSoldUnits(units: number): void {
    this.stock = new StockLevelValue(Math.max(0, this.stock.units - units), this.stock.isReliable)
  }
}