export interface SupplierListItem {
  id: string
  name: string
  taxId: string | null
  contactEmail: string | null
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

export type ReplenishmentModeValue = "replenish_sold" | "fill_to_target" | "fill_to_base"

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
  suggestion: SuggestionResponse
  budget: OrderBudgetItem
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
  maxStockUnits: number | null
  stockUnits: number
  isStockReliable: boolean
  isEstimated: boolean
}

export interface ProductSettingsPatch {
  maxStockUnits?: number
  unitCost?: number
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