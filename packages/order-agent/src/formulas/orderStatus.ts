import { OrderStatus } from "../domain/enums.js"

export interface OrderStatusContext {
  lineCount: number
  finalOrderCost: number
  availableBudget: number
  maximumOrderCost: number
  minimumOrderAmount: number
  hasMinimumOrder: boolean
  hasOwnerAdjustments: boolean
}

export interface OrderStatusExplanation {
  key: string
  params: Record<string, number | string>
}

export interface ResolvedOrderStatus {
  status: OrderStatus
  explanation: OrderStatusExplanation
}

/** F10: estado del pedido. La primera condición que se cumple gana (sección 6.5). */
export const resolveOrderStatus = (context: OrderStatusContext): ResolvedOrderStatus => {
  if (context.lineCount === 0) {
    return { status: OrderStatus.NothingToOrder, explanation: { key: "order.status.nothingToOrder", params: {} } }
  }
  if (context.finalOrderCost <= 0) {
    return {
      status: OrderStatus.Postponed,
      explanation: { key: "order.status.notEvenOnePack", params: { availableBudget: context.availableBudget } },
    }
  }
  if (context.hasMinimumOrder && context.finalOrderCost < context.minimumOrderAmount) {
    return {
      status: OrderStatus.BelowMinimum,
      explanation: {
        key: "order.status.belowSupplierMinimum",
        params: { minimumOrderAmount: context.minimumOrderAmount, finalOrderCost: context.finalOrderCost },
      },
    }
  }
  if (context.hasOwnerAdjustments && context.finalOrderCost > context.availableBudget) {
    return {
      status: OrderStatus.OverBudget,
      explanation: {
        key: "order.status.overBudget",
        params: { overBy: context.finalOrderCost - context.availableBudget },
      },
    }
  }
  if (context.hasOwnerAdjustments) {
    return { status: OrderStatus.AdjustedByOwner, explanation: { key: "order.status.adjusted", params: {} } }
  }
  if (context.availableBudget >= context.maximumOrderCost) {
    return {
      status: OrderStatus.Complete,
      explanation: { key: "order.status.maximum", params: { availableBudget: context.availableBudget, maximumOrderCost: context.maximumOrderCost } },
    }
  }
  return {
    status: OrderStatus.WithinBudget,
    explanation: {
      key: "order.status.withinBudget",
      params: { availableBudget: context.availableBudget, allocatedOrderCost: context.finalOrderCost },
    },
  }
}