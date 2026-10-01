import { OrderSuggestionCalculator } from "../domain/services/OrderSuggestionCalculator.js"
import { SupplierScheduleNotConfiguredError } from "../domain/errors/DomainErrors.js"
import type { OrderSuggestion } from "../domain/entities/OrderSuggestion.js"
import { pipe } from "../functional/pipe.js"
import { buildAgentSituation } from "./situation.js"
import { buildAgentObservation } from "./observation.js"
import { buildAgentMemory } from "./memory.js"
import type {
  AgentDecision,
  AgentMemory,
  AgentObservation,
  AgentRun,
  AgentSituation,
  AgentStageName,
  OrderAgentInput,
} from "./agentTypes.js"

export const AGENT_STAGES: readonly AgentStageName[] = ["situation", "observe", "evaluate", "decide", "act", "learn"]

/** El contexto crece etapa por etapa; cada etapa devuelve uno nuevo y no muta el anterior. */
type Start = { readonly input: OrderAgentInput }
type Situated = Start & { readonly situation: AgentSituation }
type Observed = Situated & { readonly observation: AgentObservation }
type Evaluated = Observed & { readonly suggestion: OrderSuggestion }
type Decided = Evaluated & { readonly decision: AgentDecision }
type Learned = Decided & { readonly memory: AgentMemory }

const calculator = new OrderSuggestionCalculator()

/** Situación: el calendario dice si el vendedor viene hoy y qué rango del Excel mirar. */
const situate = (context: Start): Situated => ({
  ...context,
  situation: buildAgentSituation(context.input.supplier, context.input.today),
})

/** Sin calendario el agente no improvisa: pide que se configure (HU9). */
const requireSchedule = (context: Situated): Situated => {
  if (!context.input.supplier.hasSchedule) throw new SupplierScheduleNotConfiguredError(context.input.supplier.name)
  return context
}

/** Observar: qué hay en el Excel, qué conoce del catálogo y qué datos son dudosos. */
const observe = (context: Situated): Observed => ({
  ...context,
  observation: buildAgentObservation({
    supplier: context.input.supplier,
    products: context.input.products,
    salesReport: context.input.salesReport,
    replenishmentMode: context.input.replenishmentMode,
  }),
})

/** Evaluar/calcular: el sugerido con las fórmulas puras (en el modo de niveles, planSuggestion). */
const evaluate = (context: Observed): Evaluated => ({
  ...context,
  suggestion: calculator.buildSuggestion({
    supplier: context.input.supplier,
    products: context.input.products,
    brandNamesByProductId: context.input.brandNamesByProductId,
    salesReport: context.input.salesReport,
    availableBudget: context.input.availableBudget,
    replenishmentMode: context.input.replenishmentMode,
    safetyMarginRatio: context.input.safetyMarginRatio,
    unitCostOverrides: context.input.unitCostOverrides,
    movedUnitsByBarcode: context.input.movedUnitsByBarcode,
    budgetPesos: context.input.budgetPesos,
  }),
})

/** Decidir: estado del pedido (F10), qué permitió la plata y cuántos productos están bajo la base. */
const decide = (context: Evaluated): Decided => ({
  ...context,
  decision: {
    stage: "decide",
    choice: context.suggestion.status,
    motive: context.suggestion.statusExplanation,
    budgetCoversMaximum: context.suggestion.availableBudget.pesos >= context.suggestion.maximumOrderCost.pesos,
    budgetTier: context.suggestion.budgetTier,
    belowBaseCount: context.suggestion.lines.filter((line) => line.stockPosition?.status === "below_base").length,
  },
})

/** Aprender: lo que el agente ya sabe de la tienda (costos del dueño, stock contado…). */
const learn = (context: Decided): Learned => ({ ...context, memory: buildAgentMemory(context.input.products) })

const toRun = (context: Learned): AgentRun => ({
  stages: [...AGENT_STAGES],
  situation: context.situation,
  observation: context.observation,
  decision: context.decision,
  suggestion: context.suggestion,
  memory: context.memory,
})

/**
 * El agente de sugerido como composición de etapas puras:
 * Situación → (exigir calendario) → Observar → Evaluar → Decidir → Aprender.
 * Determinista: mismos datos → mismo resultado; sin modelos de IA. Los efectos (leer Supabase, el Excel)
 * los hace quien lo llama y le pasa los datos.
 */
export const runOrderAgent = (input: OrderAgentInput): AgentRun =>
  pipe(situate, requireSchedule, observe, evaluate, decide, learn, toRun)({ input })

/** Envoltorio para quien ya usaba la clase. */
export class OrderAgent {
  run(input: OrderAgentInput): AgentRun {
    return runOrderAgent(input)
  }
}
