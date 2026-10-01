export interface SupplierListItem {
  id: string
  name: string
  taxId: string | null
  contactEmail: string | null
  /** WhatsApp o teléfono para enviarle el pedido. */
  whatsappNumber: string | null
  hasSchedule: boolean
  orderWeekday: number | null
  deliveryWeekday: number | null
  visitFrequencyDays: number | null
  deliveryLeadDays: number
  nextOrderDate: string | null
  lastDeliveryDate: string | null
  isVisitingToday: boolean
  minimumOrderAmount: number
  maximumOrderAmount: number | null
  isEstimated: boolean
  productCount: number
  lastOrderAt: string | null
}

export interface SalesReportItem {
  id: string
  fileName: string
  period: { startsAt: string; endsAt: string; coveredDays: number }
  coveredDaysOverride: number | null
  lineCount: number
  totalUnits: number
}

export interface SuggestionLine {
  productId: string
  barcode: string
  productName: string
  category: string
  brandName: string | null
  packSize: number
  /** Costo efectivo de la línea en este pedido. */
  unitCost: number
  /** order = lo escribió el dueño para este pedido; sales_report = Excel; owner = dueño; estimated = por categoría. */
  costSource: "order" | "owner" | "sales_report" | "estimated"
  isCostEstimated: boolean
  hasNoCost: boolean
  salePrice: number
  unitsSold: number
  targetUnits: number
  suggestedMaximumUnits: number
  stockToDiscount: number
  allocatedUnits: number
  finalUnits: number
  maximumLineCost: number
  allocatedLineCost: number
  finalLineCost: number
  coverageRatio: number
  isCutByBudget: boolean
  isAdjustedByOwner: boolean
  /** Modelo de niveles (B < PD < T); null en los modos anteriores. */
  stockPosition: StockPositionItem | null
}

export type StockStatus = "below_base" | "at_base" | "above_base" | "no_levels"
export type LevelReached = "tope" | "base" | "partial" | "none"
export type BudgetTier = "tope" | "between_base_and_tope" | "below_base" | "not_even_one_pack" | "nothing_to_order"

export interface StockPositionItem {
  base: number | null
  reorderPoint: number | null
  tope: number | null
  /** CM: vendido desde la última entrega. */
  movedUnits: number
  /** EA = PD − (B + CM), con signo. */
  unitsAboveBase: number | null
  estimatedStock: number | null
  status: StockStatus
  unitsToBase: number
  unitsToTope: number
  reached: LevelReached
}

export interface AgentDecisionItem {
  status: string
  budgetTier: BudgetTier | null
  belowBaseCount: number
  budgetCoversMaximum: boolean
}

export interface SuggestionGroup {
  brandName: string | null
  subtotal: number
  lines: SuggestionLine[]
}

export interface StatusExplanation {
  key: string
  params: Record<string, number | string>
}

export type ReplenishmentModeValue = "replenish_sold" | "fill_to_target" | "fill_to_base" | "levels"

export interface SuggestionResponse {
  supplier: {
    id: string
    name: string
    orderWeekday: number | null
    deliveryWeekday: number | null
    minimumOrderAmount: number
    maximumOrderAmount: number | null
  }
  replenishmentMode: ReplenishmentModeValue
  salesReportId: string | null
  availableBudget: number | null
  maximumOrderCost: number
  allocatedOrderCost: number
  finalOrderCost: number
  remainingBudget: number
  status: string
  budgetTier: BudgetTier | null
  estimatedCostLineCount: number
  noCostLineCount: number
  statusExplanation: StatusExplanation
  groups: SuggestionGroup[]
  plainText: string
}

export interface PurchaseOrderItem {
  id: string
  supplierId: string
  createdAt: string
  status: string
  totalCost: number
  availableBudget: number | null
  maximumOrderCost: number | null
  lines: { productId: string; units: number; unitCost: number; lineCost: number }[]
}

export interface DeliveryItem {
  purchaseOrderId: string
  deliveredAt: string
  products: { productId: string; unitsDelivered: number }[]
}

/** De dónde salió la plata del pedido: el menor entre la caja que queda, el tope del proveedor y el límite del dueño. */
export interface OrderBudgetItem {
  remainingCash: number | null
  minimumOrderAmount: number
  maximumOrderAmount: number | null
  ownerBudget: number | null
  orderBudget: number | null
}

export interface BuildSuggestionResponse {
  suggestion: SuggestionResponse
  budget: OrderBudgetItem
  decision: AgentDecisionItem
}

export interface StoreProfileItem {
  id: string
  name: string
  adminName: string | null
  contactEmail: string | null
  logoUrl: string | null
  updatedAt: string
}

export interface StoreProfilePatch {
  name?: string
  adminName?: string | null
  contactEmail?: string | null
}

export interface DailyCashItem {
  cashDate: string
  openingAmount: number | null
  spentAmount: number
  remainingAmount: number | null
}

export interface ConfirmOrderResponse {
  order: PurchaseOrderItem
  /** El vendedor entrega en el acto: el pedido quedó recibido al confirmar. */
  received: boolean
  paid: boolean
  suggestion: SuggestionResponse
  budget: OrderBudgetItem
  decision: AgentDecisionItem
  dailyCash: DailyCashItem
}

export interface ReceiveOrderResponse {
  delivery: DeliveryItem
}

export interface ProductItem {
  id: string
  barcode: string
  name: string
  category: string
  salePrice: number
  supplierId: string | null
  /** Solo viene en la lista de todos los productos (GET /products). */
  supplierName?: string | null
  brandName: string | null
  packSize: number
  unitCost: number
  costSource: "owner" | "sales_report" | "estimated"
  /** Tope (T). */
  maxStockUnits: number | null
  /** Base (B). */
  minStockUnits: number | null
  /** Punto de pedido (PD). */
  reorderPointUnits: number | null
  stockUnits: number
  isStockReliable: boolean
  isEstimated: boolean
}

export interface ProductSettingsPatch {
  maxStockUnits?: number | null
  minStockUnits?: number | null
  reorderPointUnits?: number | null
  unitCost?: number
  salePrice?: number
  packSize?: number
  isEstimated?: boolean
  costSource?: "owner" | "sales_report" | "estimated"
  brandName?: string | null
}

export interface OrderListItem {
  id: string
  supplierId: string
  supplierName: string | null
  status: string
  totalCost: number
  availableBudget: number | null
  maximumOrderCost: number | null
  createdAt: string
  paidAmount: number
  pendingAmount: number
  isSettled: boolean
  paidAt: string | null
}

export type OrderPaymentChange = { settled: boolean } | { pendingAmount: number }

export interface OrderPaymentItem {
  orderId: string
  totalCost: number
  paidAmount: number
  pendingAmount: number
  isSettled: boolean
  paidAt: string | null
}

export interface OrderDetailLine {
  productId: string
  units: number
  unitCost: number
  lineCost: number
}

export interface OrderDetailItem {
  id: string
  supplierId: string
  createdAt: string
  status: string
  totalCost: number
  availableBudget: number | null
  maximumOrderCost: number | null
  lines: OrderDetailLine[]
}

export interface DataQualityIssueItem {
  issueCode: string
  barcode: string | null
  productId: string | null
  originalValue: string | null
  description: string
}
/** Producto vencido separado para que el proveedor lo cambie (GET /expired-exchanges). */
export interface ExpiredExchangeItem {
  id: string
  productId: string
  productName: string
  barcode: string
  supplierId: string | null
  supplierName: string | null
  units: number
  /** Precio de compra del producto (para el total del cambio). */
  unitCost: number
  createdAt: string
}

/** Bandeja del día (GET /inbox/today). */
export interface InboxReadySummary {
  totalCost: number
  productCount: number
  budgetTier: BudgetTier | null
  belowBaseCount: number
  /** Plata que le tocó de la caja del día (null = caja sin abrir). */
  cashShare: number | null
}

export interface InboxVendorItem {
  sellerId: string
  sellerName: string | null
  supplierId: string
  supplierName: string
  /** WhatsApp del proveedor para enviarle el pedido (null si no lo tiene). */
  whatsappNumber: string | null
  deliversSameDay: boolean
  expectedDeliveryDay: string
  orderToday: { id: string; status: "confirmed" | "received"; totalCost: number; pendingAmount: number } | null
  ready: InboxReadySummary | null
  readyError: string | null
}

export interface InboxArrivalItem {
  orderId: string
  supplierId: string
  supplierName: string
  totalCost: number
  orderDay: string
  expectedDeliveryDay: string
}

export interface InboxDebtItem {
  supplierId: string
  supplierName: string
  amount: number
  /** Facturas con saldo (orderDay = YYYY-MM-DD del pedido), de la más vieja a la más reciente. */
  invoices: { orderId: string; orderDay: string; totalCost: number; pendingAmount: number }[]
}

/** Un día de los próximos, con cuántos proveedores vienen (tags de la bandeja). */
export interface InboxDayItem {
  day: string
  isToday: boolean
  vendorCount: number
}

export interface InboxItem {
  /** Día cuyos proveedores se muestran. */
  day: string
  /** Hoy en la tienda (la caja, las llegadas y las deudas son de hoy). */
  today: string
  cash: DailyCashItem
  /** Plata de la caja apartada para pagar lo que se les debe a los proveedores del día. */
  debtReserve: number
  vendors: InboxVendorItem[]
  arrivals: InboxArrivalItem[]
  debts: InboxDebtItem[]
}
