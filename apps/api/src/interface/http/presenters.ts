import type {
  AgentDecision,
  DataQualityIssue,
  OrderLine,
  OrderSuggestion,
  OrderStatus,
  Product,
  PurchaseOrder,
  SalesReport,
  Supplier,
  SupplierDataSource,
  TruckDelivery,
} from "@agente-pedidos/order-agent"

export const supplierPresenter = (source: SupplierDataSource) => {
  const supplier = source.supplier
  return {
    id: supplier.id,
    name: supplier.name,
    taxId: supplier.taxId,
    contactEmail: supplier.contactEmail,
    hasSchedule: supplier.hasSchedule,
    orderWeekday: supplier.orderWeekday,
    deliveryWeekday: supplier.deliveryWeekday,
    visitFrequency: supplier.visitFrequency,
    visitFrequencyDays: supplier.visitFrequencyDays,
    deliveryLeadDays: supplier.deliveryLeadDays,
    nextOrderDate: supplier.hasSchedule ? supplier.nextOrderDate(new Date()).toISOString() : null,
    lastDeliveryDate: supplier.hasSchedule ? supplier.lastDeliveryDate(new Date()).toISOString() : null,
    isVisitingToday: supplier.isVisitingOn(new Date()),
    minimumOrderAmount: supplier.minimumOrderAmount.pesos,
    maximumOrderAmount: supplier.maximumOrderAmount?.pesos ?? null,
    isEstimated: supplier.isEstimated,
    productCount: source.productCount,
    lastOrderAt: source.lastOrderAt?.toISOString() ?? null,
  }
}

export const supplierDetailPresenter = (supplier: Supplier) => supplierPresenter({ supplier, productCount: 0, lastOrderAt: null })

export const productPresenter = (product: Product, brandName: string | null = null, supplierName: string | null = null) => ({
  supplierName,
  id: product.id,
  barcode: product.barcode.value,
  name: product.name,
  category: product.category,
  salePrice: product.salePrice.pesos,
  supplierId: product.supplierId === "" ? null : product.supplierId,
  brandName,
  packSize: product.packSize.units,
  unitCost: product.unitCost.pesos,
  costSource: product.costSource,
  /** Tope (T). */
  maxStockUnits: product.maxStockUnits,
  /** Base (B). */
  minStockUnits: product.minStockUnits,
  /** Punto de pedido (PD). */
  reorderPointUnits: product.reorderPointUnits,
  stockUnits: product.stockUnits,
  isStockReliable: product.isStockReliable,
  isEstimated: product.isEstimated,
})

export const salesReportPresenter = (report: SalesReport | null) =>
  report === null
    ? null
    : {
        id: report.id,
        fileName: report.fileName,
        period: {
          startsAt: report.period.startsAt.toISOString(),
          endsAt: report.period.endsAt.toISOString(),
          coveredDays: report.hasCoveredDaysOverride ? report.reportCoveredDays : report.period.coveredDays,
        },
        coveredDaysOverride: report.hasCoveredDaysOverride ? report.reportCoveredDays : null,
        lineCount: report.lines.length,
        totalUnits: report.lines.reduce((total, line) => total + line.unitsSold, 0),
      }

export const dataQualityIssuePresenter = (issue: DataQualityIssue) => ({
  issueCode: issue.issueCode,
  barcode: issue.barcode,
  productId: issue.productId,
  originalValue: issue.originalValue,
  description: issue.description,
})

export const orderLinePresenter = (line: OrderLine) => ({
  productId: line.product.id,
  barcode: line.product.barcode.value,
  productName: line.product.name,
  category: line.product.category,
  brandName: line.brandName,
  packSize: line.product.packSize.units,
  unitCost: line.unitCost.pesos,
  /** order = lo escribió el dueño para este pedido; sales_report = Excel; owner = dueño; estimated = por categoría. */
  costSource: line.costSource,
  isCostEstimated: line.isCostEstimated,
  hasNoCost: line.hasNoCost,
  salePrice: line.product.salePrice.pesos,
  unitsSold: line.unitsSold,
  targetUnits: line.targetUnits,
  suggestedMaximumUnits: line.suggestedMaximumUnits,
  stockToDiscount: line.stockToDiscount,
  allocatedUnits: line.allocatedUnitsValue,
  finalUnits: line.finalUnits,
  maximumLineCost: line.maximumLineCost.pesos,
  allocatedLineCost: line.allocatedLineCost.pesos,
  finalLineCost: line.finalLineCost.pesos,
  coverageRatio: Math.round(line.coverageRatio * 1000) / 1000,
  isCutByBudget: line.isCutByBudget,
  /** Modelo de niveles: B/PD/T, CM, EA (con signo), existencia estimada y hasta dónde llegó la plata. */
  stockPosition:
    line.stockPosition === null
      ? null
      : {
          base: line.stockPosition.levels.base,
          reorderPoint: line.stockPosition.levels.reorderPoint,
          tope: line.stockPosition.levels.tope,
          movedUnits: line.stockPosition.movedUnits,
          unitsAboveBase: line.stockPosition.unitsAboveBase,
          estimatedStock: line.stockPosition.estimatedStock,
          status: line.stockPosition.status,
          unitsToBase: line.stockPosition.unitsToBase,
          unitsToTope: line.stockPosition.unitsToTope,
          reached: line.stockPosition.reached,
        },
  isAdjustedByOwner: line.isAdjustedByOwner,
})

export const orderSuggestionPresenter = (suggestion: OrderSuggestion) => ({
  supplier: {
    id: suggestion.supplier.id,
    name: suggestion.supplier.name,
    orderWeekday: suggestion.supplier.orderWeekday,
    deliveryWeekday: suggestion.supplier.deliveryWeekday,
    minimumOrderAmount: suggestion.supplier.minimumOrderAmount.pesos,
    maximumOrderAmount: suggestion.supplier.maximumOrderAmount?.pesos ?? null,
  },
  replenishmentMode: suggestion.replenishmentMode,
  salesReportId: suggestion.salesReportId,
  availableBudget: suggestion.availableBudget.pesos === Number.MAX_SAFE_INTEGER ? null : suggestion.availableBudget.pesos,
  maximumOrderCost: suggestion.maximumOrderCost.pesos,
  allocatedOrderCost: suggestion.allocatedOrderCost.pesos,
  finalOrderCost: suggestion.finalOrderCost.pesos,
  remainingBudget: suggestion.remainingBudget.pesos,
  status: suggestion.status,
  budgetTier: suggestion.budgetTier,
  estimatedCostLineCount: suggestion.estimatedCostLineCount,
  noCostLineCount: suggestion.noCostLineCount,
  statusExplanation: {
    key: suggestion.statusExplanation.key,
    params: suggestion.statusExplanation.params,
  },
  groups: suggestion.linesGroupedByBrand().map((group) => ({
    brandName: group.brandName,
    subtotal: group.subtotal.pesos,
    lines: group.lines.map(orderLinePresenter),
  })),
  plainText: suggestion.toPlainText(),
})

export const purchaseOrderPresenter = (order: PurchaseOrder) => ({
  id: order.id,
  supplierId: order.supplierId,
  createdAt: order.createdAt.toISOString(),
  status: order.status,
  totalCost: order.totalCost.pesos,
  availableBudget: order.budget?.availableBudget?.pesos ?? null,
  maximumOrderCost: order.budget?.maximumOrderCost.pesos ?? null,
  lines: order.lines.map((line) => ({
    productId: line.productId,
    units: line.units,
    unitCost: line.unitCost.pesos,
    lineCost: line.unitCost.pesos * line.units,
  })),
})

export const truckDeliveryPresenter = (delivery: TruckDelivery) => ({
  purchaseOrderId: delivery.purchaseOrderId,
  deliveredAt: delivery.deliveredAt.toISOString(),
  products: [...delivery.receivedUnitsByProduct.entries()].map(([productId, units]) => ({ productId, unitsDelivered: units })),
})

export const orderStatusLabel = (status: OrderStatus): string => status
export const agentDecisionPresenter = (decision: AgentDecision) => ({
  status: decision.choice,
  budgetTier: decision.budgetTier,
  belowBaseCount: decision.belowBaseCount,
  budgetCoversMaximum: decision.budgetCoversMaximum,
})
