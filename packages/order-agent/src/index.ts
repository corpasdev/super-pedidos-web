// API pública de @agente-pedidos/order-agent (dominio puro, sin dependencias de runtime).

// functional
export { pipe, compose, iterateUntil } from "./functional/pipe.js"
export type { UnaryFunction } from "./functional/pipe.js"
export {
  add,
  capAt,
  clampToZero,
  divideBy,
  identity,
  modulo,
  multiplyBy,
  ratioOf,
  roundUp,
  roundUpToMultipleOf,
  subtract,
  sumBy,
} from "./functional/arithmetic.js"

// formulas
export {
  calculateVisitFrequencyDays,
  calculateDeliveryLeadDays,
  daysUntilWeekday,
  calculateNextOrderDate,
  calculateNextDeliveryDate,
  calculateLastDeliveryDate,
  suggestSalesReportRange,
  calculateCoverageDays,
} from "./formulas/supplierSchedule.js"
export { startOfDay, addDays, isoWeekdayOf, daysBetween } from "./formulas/dateTime.js"
export { calculateDailySalesRate } from "./formulas/salesRate.js"
export { calculateFillToTargetUnits, calculateFillToBaseUnits, calculateTargetUnits } from "./formulas/targetUnits.js"
export { calculateOrderBudget, calculateRemainingCash } from "./formulas/orderBudget.js"
export { applyOrderPayment } from "./formulas/orderPayment.js"
export {
  estimateUnitCost,
  isCandyCategory,
  markupRatioFor,
  CANDY_MARKUP_RATIO,
  DEFAULT_MARKUP_RATIO,
} from "./formulas/estimatedCost.js"
export type { OrderPayment, OrderPaymentChange } from "./formulas/orderPayment.js"
export type { OrderBudgetSources } from "./formulas/orderBudget.js"
export type { FillToTargetParameters } from "./formulas/targetUnits.js"
export { selectStockToDiscount, calculateSuggestedMaximumUnits, hasUnitsSold, selectSoldProducts } from "./formulas/suggestedUnits.js"
export {
  calculateLineCost,
  calculateMaximumOrderCost,
  calculateAllocatedOrderCost,
  calculateFinalOrderCost,
} from "./formulas/orderCost.js"
export { allocateBudgetByCoverage, calculateCoverageRatio } from "./formulas/budgetAllocation.js"
export type { AllocatableLine } from "./formulas/budgetAllocation.js"
export { resolveOrderStatus } from "./formulas/orderStatus.js"
export type { OrderStatusContext, OrderStatusExplanation, ResolvedOrderStatus } from "./formulas/orderStatus.js"

// texto: reparar nombres que llegan con la codificación dañada ("MU�'OZ" → "MUÑOZ")
export { repairMojibake, hasBrokenCharacters } from "./text/repairMojibake.js"

// domain: enums y errores
export {
  Weekday,
  VisitFrequency,
  ReplenishmentMode,
  CostSource,
  OrderStatus,
} from "./domain/enums.js"
export {
  DomainError,
  InvalidMoneyError,
  NegativeMoneyResultError,
  InvalidPackSizeError,
  InvalidBarcodeError,
  InvalidDateRangeError,
  BiweeklyAnchorRequiredError,
  AnchorDateOnWrongWeekdayError,
  SupplierScheduleNotConfiguredError,
  SalesReportMissingColumnsError,
  SalesReportEmptyError,
  SalesReportPeriodOverlapError,
  ProductNotFoundException,
  CatalogImportError,
  SalesReportImportError,
  PurchaseOrderConflictError,
} from "./domain/errors/DomainErrors.js"

// domain: objetos de valor
export { Money } from "./domain/value-objects/Money.js"
export { PackSize } from "./domain/value-objects/PackSize.js"
export { DateRange } from "./domain/value-objects/DateRange.js"
export { Barcode } from "./domain/value-objects/Barcode.js"

// domain: entidades
export { Supplier } from "./domain/entities/Supplier.js"
export { SupplierSchedule } from "./domain/entities/SupplierSchedule.js"
export { SupplierSettings } from "./domain/entities/SupplierSettings.js"
export type { SupplierSettingsProps } from "./domain/entities/SupplierSettings.js"
export { Brand } from "./domain/entities/Brand.js"
export { Product } from "./domain/entities/Product.js"
export { ProductSettings } from "./domain/entities/ProductSettings.js"
export type { ProductSettingsProps } from "./domain/entities/ProductSettings.js"
export { StockLevel } from "./domain/entities/StockLevel.js"
export { SalesReport } from "./domain/entities/SalesReport.js"
export { SalesReportLine } from "./domain/entities/SalesReportLine.js"
export { OrderLine } from "./domain/entities/OrderLine.js"
export type { OrderLineCostSource, StockPositionSnapshot } from "./domain/entities/OrderLine.js"
export { OrderSuggestion } from "./domain/entities/OrderSuggestion.js"
export type { OrderLineGroup } from "./domain/entities/OrderSuggestion.js"
export { PurchaseOrder } from "./domain/entities/PurchaseOrder.js"
export type { PurchaseOrderLine } from "./domain/entities/PurchaseOrder.js"
export { TruckDelivery } from "./domain/entities/TruckDelivery.js"

// domain: servicios
export { OrderSuggestionCalculator, DEFAULT_SAFETY_MARGIN_RATIO } from "./domain/services/OrderSuggestionCalculator.js"
export type { OrderSuggestionCalculatorInput } from "./domain/services/OrderSuggestionCalculator.js"
export { BrandDetector, OTHER_BRANDS_BRAND_NAME } from "./domain/services/BrandDetector.js"
export type { BrandDetectionResult } from "./domain/services/BrandDetector.js"
export {
  DataQualityInspector,
  MAX_PLAUSIBLE_STOCK_UNITS,
  INITIAL_LOAD_LOWER_BOUND,
  INITIAL_LOAD_UPPER_BOUND,
} from "./domain/services/DataQualityInspector.js"
export type { RawImportedProduct, DataQualityIssue, DataQualityIssueCode } from "./domain/services/DataQualityInspector.js"

// domain: puertos
export type { SupplierRepository, SupplierDataSource } from "./domain/ports/SupplierRepository.js"
export type { ProductRepository } from "./domain/ports/ProductRepository.js"
export type { SalesReportRepository } from "./domain/ports/SalesReportRepository.js"
export type { PurchaseOrderRepository } from "./domain/ports/PurchaseOrderRepository.js"
export type { InventoryMovementRepository } from "./domain/ports/InventoryMovementRepository.js"
export type { StoreRepository, StoreDataSource } from "./domain/ports/StoreRepository.js"

// agent: el ciclo del agente (Situación → Observar → Evaluar → Decidir → Actuar → Aprender)
export { OrderAgent, runOrderAgent, AGENT_STAGES } from "./agent/OrderAgent.js"
export { buildAgentSituation } from "./agent/situation.js"
export { buildAgentObservation } from "./agent/observation.js"
export { buildAgentMemory } from "./agent/memory.js"
export type { OrderAgentInput } from "./agent/agentTypes.js"
export type {
  AgentDecision,
  AgentMemory,
  AgentObservation,
  AgentObservationAlert,
  AgentObservationAlertCode,
  AgentRun,
  AgentSituation,
  AgentSituationOutcome,
  AgentStageName,
} from "./agent/agentTypes.js"
// sugerido de pedido (modelo de niveles B < PD < T): funciones puras
export { planSuggestion } from "./suggestion/plan.js"
export { allocateByLevels, fillTowards, toBase, toTope } from "./suggestion/allocation.js"
export {
  unitsAboveBase,
  stockStatusOf,
  physicalStock,
  hasCompleteLevels,
  levelsProblem,
  positionOf,
  hasMoved,
} from "./suggestion/levels.js"
export { movedUnitsSince } from "./suggestion/movedUnits.js"
export type { DailySale } from "./suggestion/movedUnits.js"
export type {
  StockLevels,
  SuggestionItem,
  StockStatus,
  ProductPosition,
  LevelReached,
  SuggestedLine,
  BudgetTier,
  SuggestionPlan,
} from "./suggestion/types.js"

// bandeja del día: visitas de vendedores, entregas y deudas (funciones puras)
export {
  isoWeekdayOfDay,
  daysBetweenDays,
  addDaysToDay,
  isVisitingOnDay,
  visitsOnDay,
  deliversSameDay,
  deliveryLeadDaysOf,
  expectedDeliveryDay,
} from "./inbox/visits.js"
export type { SellerVisit, VisitFrequencyValue } from "./inbox/visits.js"
export { arrivalsDueOn, orderOfSupplierOn, debtsBySupplier, debtReserveFor, pendingInvoicesBySupplier } from "./inbox/ledger.js"
export type { InboxOrder, PendingInvoice } from "./inbox/ledger.js"
