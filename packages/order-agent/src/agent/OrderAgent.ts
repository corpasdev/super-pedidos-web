import type { OrderSuggestionCalculator } from "../domain/services/OrderSuggestionCalculator.js"
import { SupplierScheduleNotConfiguredError } from "../domain/errors/DomainErrors.js"
import { buildAgentSituation } from "./situation.js"
import { buildAgentObservation } from "./observation.js"
import { buildAgentMemory } from "./memory.js"
import type { AgentRun, AgentStageName, OrderAgentInput } from "./agentTypes.js"

export const AGENT_STAGES: readonly AgentStageName[] = ["situation", "observe", "evaluate", "decide", "act", "learn"]

/**
 * El agente sale a buscar los datos y corre el ciclo en orden fijo:
 * Situación (calendario) → Observar (Excel y dudas) → Evaluar/Calcular (F1–F8) → Decidir (F10)
 * → Actuar (propuesta) → Aprender (memoria). Determinista: mismos datos → mismo resultado; sin modelos de IA.
 */
export class OrderAgent {
  constructor(private readonly calculator: OrderSuggestionCalculator) {}

  run(input: OrderAgentInput): AgentRun {
    const situation = buildAgentSituation(input.supplier, input.today)
    if (!input.supplier.hasSchedule) throw new SupplierScheduleNotConfiguredError(input.supplier.name)

    const observation = buildAgentObservation({
      supplier: input.supplier,
      products: input.products,
      salesReport: input.salesReport,
      replenishmentMode: input.replenishmentMode,
    })

    const suggestion = this.calculator.buildSuggestion({
      supplier: input.supplier,
      products: input.products,
      brandNamesByProductId: input.brandNamesByProductId,
      salesReport: input.salesReport,
      availableBudget: input.availableBudget,
      replenishmentMode: input.replenishmentMode,
      safetyMarginRatio: input.safetyMarginRatio,
    })

    return {
      stages: [...AGENT_STAGES],
      situation,
      observation,
      decision: {
        stage: "decide",
        choice: suggestion.status,
        motive: suggestion.statusExplanation,
        budgetCoversMaximum: suggestion.availableBudget.pesos >= suggestion.maximumOrderCost.pesos,
      },
      suggestion,
      memory: buildAgentMemory(input.products),
    }
  }
}