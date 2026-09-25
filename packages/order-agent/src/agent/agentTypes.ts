import type { OrderStatus, ReplenishmentMode } from "../domain/enums.js"
import type { OrderStatusExplanation } from "../formulas/orderStatus.js"
import type { OrderSuggestion } from "../domain/entities/OrderSuggestion.js"
import type { SalesReport } from "../domain/entities/SalesReport.js"
import type { Supplier } from "../domain/entities/Supplier.js"
import type { Product } from "../domain/entities/Product.js"
import type { Money } from "../domain/value-objects/Money.js"

export type AgentStageName = "situation" | "observe" | "evaluate" | "decide" | "act" | "learn"

export type AgentSituationOutcome = "visiting_today" | "scheduled" | "needs_schedule"

/** Etapa «Situación»: el calendario del proveedor decide si hoy toca pedir y qué rango del Excel mirar. */
export interface AgentSituation {
  stage: "situation"
  visitingToday: boolean
  nextOrderDate: string | null
  suggestedReportRange: { start: string; end: string } | null
  outcome: AgentSituationOutcome
}

export type AgentObservationAlertCode =
  | "zero_cost"
  | "cost_above_sale_price"
  | "estimated_cost"
  | "unreliable_stock_for_fill"
  | "report_does_not_cover_cycle"

export interface AgentObservationAlert {
  code: AgentObservationAlertCode
  productId: string | null
  barcode: string | null
  description: string
}

/** Etapa «Observar»: qué vende el Excel, cuántos días cubre y qué datos faltan o son dudosos. */
export interface AgentObservation {
  stage: "observe"
  reportCoveredDays: number
  scheduledCycleDays: number
  reportRange: { start: string; end: string } | null
  soldProductCount: number
  catalogProductCount: number
  unmatchedSalesCount: number
  alerts: AgentObservationAlert[]
}

/** Etapa «Decidir»: qué hace el agente con el pedido calculado (mismo estado y motivo que F10). */
export interface AgentDecision {
  stage: "decide"
  choice: OrderStatus
  motive: OrderStatusExplanation
  /** R3: true si la plata alcanza para pedir el máximo de todo. */
  budgetCoversMaximum: boolean
}

/** Etapa «Aprender»: lo que el agente ya sabe de la tienda, desde lo que el dueño escribió y lo recibido. */
export interface AgentMemory {
  stage: "learn"
  correctedCostProductCount: number
  estimatedCostProductCount: number
  countedStockProductCount: number
  fillToTargetEligibleProductCount: number
}

export interface AgentRun {
  stages: AgentStageName[]
  situation: AgentSituation
  observation: AgentObservation
  decision: AgentDecision
  suggestion: OrderSuggestion
  memory: AgentMemory
}

export interface OrderAgentInput {
  supplier: Supplier
  products: Product[]
  brandNamesByProductId: ReadonlyMap<string, string>
  salesReport: SalesReport | null
  availableBudget: Money
  replenishmentMode: ReplenishmentMode
  today: Date
  safetyMarginRatio?: number
}