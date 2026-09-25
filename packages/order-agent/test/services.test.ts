import { describe, expect, it } from "vitest"
import { OrderSuggestionCalculator } from "../src/domain/services/OrderSuggestionCalculator.js"
import { BrandDetector, OTHER_BRANDS_BRAND_NAME } from "../src/domain/services/BrandDetector.js"
import { DataQualityInspector } from "../src/domain/services/DataQualityInspector.js"
import type { RawImportedProduct } from "../src/domain/services/DataQualityInspector.js"
import { Supplier } from "../src/domain/entities/Supplier.js"
import { SupplierSchedule } from "../src/domain/entities/SupplierSchedule.js"
import { SupplierSettings } from "../src/domain/entities/SupplierSettings.js"
import { Product } from "../src/domain/entities/Product.js"
import { ProductSettings } from "../src/domain/entities/ProductSettings.js"
import { StockLevel } from "../src/domain/entities/StockLevel.js"
import { SalesReport } from "../src/domain/entities/SalesReport.js"
import { SalesReportLine } from "../src/domain/entities/SalesReportLine.js"
import { Barcode } from "../src/domain/value-objects/Barcode.js"
import { DateRange } from "../src/domain/value-objects/DateRange.js"
import { Money } from "../src/domain/value-objects/Money.js"
import { PackSize } from "../src/domain/value-objects/PackSize.js"
import { CostSource, OrderStatus, ReplenishmentMode, VisitFrequency, Weekday } from "../src/domain/enums.js"

const weeklySupplier = () =>
  new Supplier(
    "supplier-1",
    "Distribuidora Andina",
    "900123456",
    null,
    new SupplierSettings(
      new SupplierSchedule(Weekday.Tuesday, Weekday.Wednesday, VisitFrequency.Weekly, null),
      Money.zero(),
      true,
    ),
  )

const makeProduct = (overrides: Partial<{
  id: string
  barcode: string
  name: string
  category: string
  salePrice: number
  unitCost: number
  packSize: number
  stockUnits: number
  isStockReliable: boolean
  maxStockUnits: number | null
}> = {}): Product => {
  const resolved = {
    id: "product",
    barcode: "7700000000000",
    name: "Producto de prueba",
    category: "Alimento",
    salePrice: 5_000,
    unitCost: 1_000,
    packSize: 6,
    stockUnits: 0,
    isStockReliable: false,
    maxStockUnits: null,
    ...overrides,
  }
  return new Product(
    resolved.id,
    Barcode.parse(resolved.barcode),
    resolved.name,
    resolved.category,
    Money.fromPesos(resolved.salePrice),
    "supplier-1",
    null,
    new ProductSettings(resolved.maxStockUnits, Money.fromPesos(resolved.unitCost), CostSource.Estimated, PackSize.of(resolved.packSize), true),
    new StockLevel(resolved.stockUnits, resolved.isStockReliable),
  )
}

const unitCost = (product: Product) => product.unitCost.pesos

describe("OrderSuggestionCalculator", () => {
  it("R1: con Excel cargado solo se sugieren productos vendidos (v=0 y s=0 no aparece)", () => {
    const sold = makeProduct({ id: "sold", barcode: "7700000000001", stockUnits: 0, isStockReliable: true, packSize: 1 })
    const notSold = makeProduct({ id: "not-sold", barcode: "7700000000002", stockUnits: 0, isStockReliable: true })
    const report = new SalesReport(
      "report-1",
      "ventas.xlsx",
      new DateRange(new Date(2026, 8, 16), new Date(2026, 8, 16)),
      [
        new SalesReportLine(Barcode.parse("7700000000001"), "Producto vendido", "Alimento", 4, 2, Money.fromPesos(900), null),
      ],
      null,
    )

    const suggestion = new OrderSuggestionCalculator().buildSuggestion({
      supplier: weeklySupplier(),
      products: [sold, notSold],
      brandNamesByProductId: new Map([["sold", "Muñeca"]]),
      salesReport: report,
      availableBudget: Money.fromPesos(1_000_000),
      replenishmentMode: ReplenishmentMode.ReplenishSold,
    })

    expect(suggestion.lines.map((line) => line.product.id)).toEqual(["sold"])
    expect(suggestion.lines[0]!.finalUnits).toBe(4)
  })

  it("F3a+F5 en ReplenishSold: v=7, s=50, e=1 → 7 sin descontar stock", () => {
    const product = makeProduct({ id: "mayo", barcode: "7700000000003", stockUnits: 50, packSize: 1 })
    const report = new SalesReport(
      "report-1",
      "ventas.xlsx",
      new DateRange(new Date(2026, 8, 16), new Date(2026, 8, 16)),
      [new SalesReportLine(Barcode.parse("7700000000003"), "Mayonesa", "Alimento", 7, 3, Money.fromPesos(900), null)],
      null,
    )
    const suggestion = new OrderSuggestionCalculator().buildSuggestion({
      supplier: weeklySupplier(),
      products: [product],
      brandNamesByProductId: new Map(),
      salesReport: report,
      availableBudget: Money.fromPesos(1_000_000),
      replenishmentMode: ReplenishmentMode.ReplenishSold,
    })
    expect(suggestion.lines[0]!.finalUnits).toBe(7)
    expect(suggestion.status).toBe(OrderStatus.Complete)
  })

  it("ajustes del dueño: +1 empaque que pasa la plata → OverBudget con la diferencia exacta", () => {
    const packs = 6
    const product = makeProduct({
      id: "arroz",
      barcode: "7700000000004",
      unitCost: 2_000,
      packSize: packs,
      stockUnits: 0,
      isStockReliable: true,
    })
    const report = new SalesReport(
      "report-1",
      "ventas.xlsx",
      new DateRange(new Date(2026, 8, 16), new Date(2026, 8, 16)),
      [new SalesReportLine(Barcode.parse("7700000000004"), "Arroz", "Alimento", 12, 4, Money.fromPesos(2_000), null)],
      null,
    )
    const budget = Money.fromPesos(packs * 2_000) // alcanza solo para 1 empaque

    const suggestion = new OrderSuggestionCalculator().buildSuggestion({
      supplier: weeklySupplier(),
      products: [product],
      brandNamesByProductId: new Map(),
      salesReport: report,
      availableBudget: budget,
      replenishmentMode: ReplenishmentMode.ReplenishSold,
    })

    expect(suggestion.finalOrderCost.pesos).toBe(packs * 2_000)
    const overBudgetSuggestion = suggestion.withOwnerAdjustment("arroz", 1)
    expect(overBudgetSuggestion.status).toBe(OrderStatus.OverBudget)
    expect(overBudgetSuggestion.statusExplanation.key).toBe("order.status.overBudget")
    expect(overBudgetSuggestion.statusExplanation.params.overBy).toBe(packs * 2_000)
    expect(overBudgetSuggestion.lines[0]!.finalUnits).toBe(packs * 2)
  })

  it("FillToTarget descuenta el stock y agrupa por marca", () => {
    const product = makeProduct({
      id: "azucar",
      barcode: "7700000000005",
      unitCost: 3_000,
      packSize: 6,
      stockUnits: 4,
      isStockReliable: true,
    })
    const report = new SalesReport(
      "report-1",
      "ventas.xlsx",
      new DateRange(new Date(2026, 8, 8), new Date(2026, 8, 16)),
      [new SalesReportLine(Barcode.parse("7700000000005"), "Azúcar", "Alimento", 16, 4, Money.fromPesos(3_000), null)],
      null,
    )
    const suggestion = new OrderSuggestionCalculator().buildSuggestion({
      supplier: weeklySupplier(),
      products: [product],
      brandNamesByProductId: new Map([["azucar", "La Muñeca"]]),
      salesReport: report,
      availableBudget: Money.fromPesos(1_000_000),
      replenishmentMode: ReplenishmentMode.FillToTarget,
    })
    // F3b: 16/9 = 1,77… ×8 ×1,1 = 15,6 → 16 (redondeado). Descontando 4 de stock:
    // ceil((16−4)/6)*6 = 12
    const line = suggestion.lines[0]!
    expect(line.targetUnits).toBe(16)
    expect(line.suggestedMaximumUnits).toBe(12)
    expect(line.finalUnits).toBe(12)
    expect(line.product.unitCost.multiplyByUnits(12).pesos).toBe(36_000)
    const groups = suggestion.linesGroupedByBrand()
    expect(groups).toHaveLength(1)
    expect(groups[0]!.brandName).toBe("La Muñeca")
    expect(groups[0]!.subtotal.pesos).toBe(36_000)
  })

  it("toPlainText agrupa por marca con unidades y empaques", () => {
    const product = makeProduct({ id: "arroz", barcode: "7700000000004", unitCost: 2_000, packSize: 6, stockUnits: 0 })
    const report = new SalesReport(
      "report-1",
      "ventas.xlsx",
      new DateRange(new Date(2026, 8, 16), new Date(2026, 8, 16)),
      [new SalesReportLine(Barcode.parse("7700000000004"), "Arroz", "Alimento", 12, 4, Money.fromPesos(2_000), null)],
      null,
    )
    const suggestion = new OrderSuggestionCalculator().buildSuggestion({
      supplier: weeklySupplier(),
      products: [product],
      brandNamesByProductId: new Map([["arroz", "El Arrocero"]]),
      salesReport: report,
      availableBudget: Money.fromPesos(1_000_000),
      replenishmentMode: ReplenishmentMode.ReplenishSold,
    })
    const plainText = suggestion.toPlainText()
    expect(plainText).toContain("PEDIDO DISTRIBUIDORA ANDINA")
    expect(plainText).toContain("El Arrocero")
    expect(plainText).toContain("2 empaques")
  })

  it("con plata que no alcanza ni un empaque el estado es Postponed", () => {
    const product = makeProduct({ id: "arroz", barcode: "7700000000004", unitCost: 6_000, packSize: 6, stockUnits: 0 })
    const report = new SalesReport(
      "report-1",
      "ventas.xlsx",
      new DateRange(new Date(2026, 8, 16), new Date(2026, 8, 16)),
      [new SalesReportLine(Barcode.parse("7700000000004"), "Arroz", "Alimento", 6, 4, Money.fromPesos(6_000), null)],
      null,
    )
    const suggestion = new OrderSuggestionCalculator().buildSuggestion({
      supplier: weeklySupplier(),
      products: [product],
      brandNamesByProductId: new Map(),
      salesReport: report,
      availableBudget: Money.fromPesos(1_000),
      replenishmentMode: ReplenishmentMode.ReplenishSold,
    })
    expect(suggestion.status).toBe(OrderStatus.Postponed)
  })

  it("costo unitario del producto usado en las líneas", () => {
    const product = makeProduct({ id: "cafe", barcode: "7700000000006", unitCost: 1_173, packSize: 1, stockUnits: 0 })
    const report = new SalesReport(
      "report-1",
      "ventas.xlsx",
      new DateRange(new Date(2026, 8, 16), new Date(2026, 8, 16)),
      [new SalesReportLine(Barcode.parse("7700000000006"), "Café", "Alimento", 2, 1, Money.fromPesos(1_173), null)],
      null,
    )
    const suggestion = new OrderSuggestionCalculator().buildSuggestion({
      supplier: weeklySupplier(),
      products: [product],
      brandNamesByProductId: new Map(),
      salesReport: report,
      availableBudget: Money.fromPesos(100_000),
      replenishmentMode: ReplenishmentMode.ReplenishSold,
    })
    expect(suggestion.lines[0]!.finalUnits).toBe(2)
    expect(unitCost(suggestion.lines[0]!.product)).toBe(1_173)
    expect(suggestion.finalOrderCost.pesos).toBe(2_346)
  })
})

describe("OrderSuggestionCalculator · FillToBase (regla del dueño)", () => {
  const oneDayReport = (lines: SalesReportLine[]) =>
    new SalesReport("report-1", "ventas.xlsx", new DateRange(new Date(2026, 8, 16), new Date(2026, 8, 22)), lines, null)
  const soldLine = (barcode: string, units: number) =>
    new SalesReportLine(Barcode.parse(barcode), "Producto", "Alimento", units, 1, Money.fromPesos(1_000), null)
  const build = (products: Product[], report: SalesReport | null, budget = 1_000_000) =>
    new OrderSuggestionCalculator().buildSuggestion({
      supplier: weeklySupplier(),
      products,
      brandNamesByProductId: new Map(),
      salesReport: report,
      availableBudget: Money.fromPesos(budget),
      replenishmentMode: ReplenishmentMode.FillToBase,
    })

  it("con base: pide base − stock aunque la venta haya sido baja", () => {
    const arroz = makeProduct({ id: "arroz", barcode: "7700000000010", packSize: 1, maxStockUnits: 24, stockUnits: 10 })
    const suggestion = build([arroz], oneDayReport([soldLine("7700000000010", 2)]))
    expect(suggestion.lines[0]!.targetUnits).toBe(24)
    expect(suggestion.lines[0]!.finalUnits).toBe(14)
  })

  it("si faltan 1 o 2 para la base, igual los pide (redondeado al empaque)", () => {
    const aceite = makeProduct({ id: "aceite", barcode: "7700000000011", packSize: 1, maxStockUnits: 12, stockUnits: 11 })
    const panela = makeProduct({ id: "panela", barcode: "7700000000012", packSize: 6, maxStockUnits: 12, stockUnits: 10 })
    const suggestion = build([aceite, panela], null)
    const unitsById = new Map(suggestion.lines.map((line) => [line.product.id, line.finalUnits]))
    expect(unitsById.get("aceite")).toBe(1)
    expect(unitsById.get("panela")).toBe(6)
  })

  it("no vendido pero con la base cubierta: no aparece", () => {
    const sal = makeProduct({ id: "sal", barcode: "7700000000013", maxStockUnits: 10, stockUnits: 10 })
    expect(build([sal], oneDayReport([])).lines).toHaveLength(0)
  })

  it("sin base escrita: repone lo vendido sin descontar stock", () => {
    const cafe = makeProduct({ id: "cafe", barcode: "7700000000014", packSize: 1, maxStockUnits: null, stockUnits: 30 })
    const suggestion = build([cafe], oneDayReport([soldLine("7700000000014", 5)]))
    expect(suggestion.lines[0]!.stockToDiscount).toBe(0)
    expect(suggestion.lines[0]!.finalUnits).toBe(5)
  })

  it("usa el stock aunque no esté contado (el dueño revisa la existencia antes)", () => {
    const leche = makeProduct({ id: "leche", barcode: "7700000000015", packSize: 1, maxStockUnits: 20, stockUnits: 8, isStockReliable: false })
    expect(build([leche], null).lines[0]!.finalUnits).toBe(12)
  })

  it("si la plata no alcanza para toda la base, pide un poco menos", () => {
    const huevos = makeProduct({ id: "huevos", barcode: "7700000000016", packSize: 1, unitCost: 500, maxStockUnits: 30, stockUnits: 0 })
    const suggestion = build([huevos], null, 10_000)
    expect(suggestion.lines[0]!.finalUnits).toBe(20)
    expect(suggestion.status).toBe(OrderStatus.WithinBudget)
  })
})

describe("Costo del pedido: estimado por categoría y precio del vendedor", () => {
  const productWith = (overrides: { unitCost: number; salePrice: number; category: string; costSource?: CostSource }) =>
    new Product(
      "p",
      Barcode.parse("7700000000099"),
      "Producto",
      overrides.category,
      Money.fromPesos(overrides.salePrice),
      "supplier-1",
      null,
      new ProductSettings(24, Money.fromPesos(overrides.unitCost), overrides.costSource ?? CostSource.Estimated, PackSize.of(1), true),
      new StockLevel(0, true),
    )

  it("costo en $0: usa precio ÷ 1,30 en dulcería y ÷ 1,20 en el resto", () => {
    expect(productWith({ unitCost: 0, salePrice: 1_300, category: "dulceria" }).unitCost.pesos).toBe(1_000)
    expect(productWith({ unitCost: 0, salePrice: 3_600, category: "abarrotes" }).unitCost.pesos).toBe(3_000)
    expect(productWith({ unitCost: 0, salePrice: 3_600, category: "abarrotes" }).costSource).toBe(CostSource.Estimated)
  })

  it("el costo real (Excel o dueño) gana sobre el estimado", () => {
    const fromReport = productWith({ unitCost: 2_800, salePrice: 3_600, category: "abarrotes", costSource: CostSource.SalesReport })
    expect(fromReport.unitCost.pesos).toBe(2_800)
    expect(fromReport.costSource).toBe(CostSource.SalesReport)
  })

  it("PRECIO COMPRA en 0 del Excel no pisa el costo", () => {
    const product = productWith({ unitCost: 2_800, salePrice: 3_600, category: "abarrotes", costSource: CostSource.SalesReport })
    product.applyPurchaseCostFromReport(Money.zero())
    expect(product.unitCost.pesos).toBe(2_800)
  })

  it("sin costo ni precio de venta: la línea queda marcada sin costo", () => {
    const suggestion = new OrderSuggestionCalculator().buildSuggestion({
      supplier: weeklySupplier(),
      products: [productWith({ unitCost: 0, salePrice: 0, category: "aseo" })],
      brandNamesByProductId: new Map(),
      salesReport: null,
      availableBudget: Money.fromPesos(100_000),
      replenishmentMode: ReplenishmentMode.FillToBase,
    })
    expect(suggestion.noCostLineCount).toBe(1)
  })

  it("el precio del vendedor para este pedido reemplaza al estimado y se usa en el reparto de la plata", () => {
    const product = productWith({ unitCost: 0, salePrice: 1_200, category: "abarrotes" }) // estimado $1.000, base 24
    const build = (overrides?: Map<string, Money>) =>
      new OrderSuggestionCalculator().buildSuggestion({
        supplier: weeklySupplier(),
        products: [product],
        brandNamesByProductId: new Map(),
        salesReport: null,
        availableBudget: Money.fromPesos(12_000),
        replenishmentMode: ReplenishmentMode.FillToBase,
        unitCostOverrides: overrides,
      })
    const estimated = build()
    expect(estimated.lines[0]!.isCostEstimated).toBe(true)
    expect(estimated.lines[0]!.finalUnits).toBe(12) // $12.000 ÷ $1.000

    const quoted = build(new Map([["p", Money.fromPesos(1_500)]]))
    expect(quoted.lines[0]!.costSource).toBe("order")
    expect(quoted.lines[0]!.isCostEstimated).toBe(false)
    expect(quoted.lines[0]!.finalUnits).toBe(8) // $12.000 ÷ $1.500
    expect(quoted.estimatedCostLineCount).toBe(0)
  })
})

describe("BrandDetector", () => {
  const detector = new BrandDetector(["La Muñeca", "El Arrocero"], new Map([["Productos Unicos S.A.S.", "Únicos"]]))

  it("detecta por el nombre del producto", () => {
    expect(detector.detect("Tornillo La Muñeca", "Cualquiera")).toEqual({ brandName: "La Muñeca", detectedFrom: "name" })
  })

  it("usa la marca del proveedor si es monomarca", () => {
    expect(detector.detect("Galleta salada", "Productos Unicos S.A.S.")).toEqual({
      brandName: "Únicos",
      detectedFrom: "supplier",
    })
  })

  it("si no reconoce nada, cae en Otras marcas", () => {
    expect(detector.detect("Producto raro", "Proveedor X")).toEqual({
      brandName: OTHER_BRANDS_BRAND_NAME,
      detectedFrom: "none",
    })
  })
})

describe("DataQualityInspector", () => {
  const inspector = new DataQualityInspector()
  const baseProduct: RawImportedProduct = {
    id: "product-1",
    supplierId: "supplier-1",
    supplierName: "Distribuidora Andina",
    barcode: "7700000000001",
    productName: "Harina",
    category: "Alimento",
    stockUnits: 500,
    salePrice: 3_500,
  }

  it("marca stock imposible (> 10000) como no confiable", () => {
    const issues = inspector.inspect([{ ...baseProduct, stockUnits: 10_001 }])
    expect(issues.some((issue) => issue.issueCode === "impossible_stock")).toBe(true)
  })

  it("marca cantidad no numérica (null) como impossible_stock", () => {
    const issues = inspector.inspect([{ ...baseProduct, stockUnits: null }])
    expect(issues.some((issue) => issue.issueCode === "impossible_stock")).toBe(true)
  })

  it("marca stock negativo", () => {
    const issues = inspector.inspect([{ ...baseProduct, stockUnits: -2 }])
    expect(issues.some((issue) => issue.issueCode === "negative_stock")).toBe(true)
  })

  it("avisa sobre cantidades que parecen carga inicial (990–1020)", () => {
    const issues = inspector.inspect([{ ...baseProduct, stockUnits: 1_000 }])
    expect(issues.some((issue) => issue.issueCode === "initial_load_stock")).toBe(true)
  })

  it("marca productos sin proveedor", () => {
    const issues = inspector.inspect([{ ...baseProduct, supplierId: null, supplierName: null }])
    expect(issues.some((issue) => issue.issueCode === "missing_supplier")).toBe(true)
  })

  it("marca productos sin precio de venta", () => {
    const issues = inspector.inspect([{ ...baseProduct, salePrice: 0 }])
    expect(issues.some((issue) => issue.issueCode === "missing_sale_price")).toBe(true)
  })

  it("detecta ventas del Excel que no existen en el catálogo", () => {
    const issues = inspector.inspectUnmatchedSales(
      [
        new SalesReportLine(Barcode.parse("9999999999999"), "Producto misterioso", "N/A", 1, 1, null, null),
      ],
      new Set(["7700000000001"]),
    )
    expect(issues.some((issue) => issue.issueCode === "unmatched_sale" && issue.barcode === "9999999999999")).toBe(true)
  })
})