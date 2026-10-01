import { iterateUntil } from "../functional/pipe.js"
import type { BudgetTier, LevelReached, ProductPosition, SuggestedLine, SuggestionPlan } from "./types.js"

/** Borrador de una línea mientras se reparte la plata. */
interface Draft {
  readonly position: ProductPosition
  readonly allocated: number
}

interface FillState {
  readonly drafts: readonly Draft[]
  readonly remaining: number
}

/** Meta de unidades de una fase del reparto (base o tope). */
type LevelTarget = (position: ProductPosition) => number

export const toBase: LevelTarget = (position) => position.unitsToBase
export const toTope: LevelTarget = (position) => position.unitsToTope

const packCostOf = (draft: Draft): number => draft.position.packSize * draft.position.unitCost

const missingFor = (target: LevelTarget) => (draft: Draft): number => Math.max(0, target(draft.position) - draft.allocated)

const costToReach = (target: LevelTarget) => (drafts: readonly Draft[]): number =>
  drafts.reduce((total, draft) => total + missingFor(target)(draft) * draft.position.unitCost, 0)

/** Cuánto de la meta de la fase ya tiene la línea (0 = nada, 1 = completa). */
const progressOf = (target: LevelTarget) => (draft: Draft): number => {
  const goal = target(draft.position)
  return goal === 0 ? 1 : draft.allocated / goal
}

/** Orden de prioridad: menos avance en la fase → más urgente (EA más negativa) → más movido → código menor. */
const byUrgency = (target: LevelTarget) => (left: Draft, right: Draft): number =>
  progressOf(target)(left) - progressOf(target)(right) ||
  (left.position.unitsAboveBase ?? 0) - (right.position.unitsAboveBase ?? 0) ||
  right.position.movedUnits - left.position.movedUnits ||
  left.position.barcode.localeCompare(right.position.barcode)

const nextInLine = (target: LevelTarget) => (state: FillState): Draft | null =>
  [...state.drafts]
    .filter((draft) => missingFor(target)(draft) > 0 && packCostOf(draft) <= state.remaining)
    .sort(byUrgency(target))[0] ?? null

const giveOnePack = (target: LevelTarget) => (state: FillState): FillState => {
  const chosen = nextInLine(target)(state)
  if (chosen === null) return state
  return {
    remaining: state.remaining - packCostOf(chosen),
    drafts: state.drafts.map((draft) =>
      draft.position.productId === chosen.position.productId
        ? { ...draft, allocated: draft.allocated + draft.position.packSize }
        : draft,
    ),
  }
}

const fillCompletely = (target: LevelTarget) => (state: FillState): FillState => ({
  remaining: state.remaining - costToReach(target)(state.drafts),
  drafts: state.drafts.map((draft) => ({ ...draft, allocated: Math.max(draft.allocated, target(draft.position)) })),
})

/** Lleva las líneas hacia la meta: todas de una vez si alcanza; si no, de a un empaque al más urgente. */
export const fillTowards = (target: LevelTarget) => (state: FillState): FillState =>
  costToReach(target)(state.drafts) <= state.remaining
    ? fillCompletely(target)(state)
    : iterateUntil((current: FillState) => nextInLine(target)(current) === null, giveOnePack(target))(state)

const reachedOf = (draft: Draft): LevelReached => {
  const { unitsToBase, unitsToTope } = draft.position
  if (draft.allocated >= unitsToTope) return "tope"
  if (draft.allocated >= unitsToBase) return "base"
  return draft.allocated > 0 ? "partial" : "none"
}

const toSuggestedLine = (draft: Draft): SuggestedLine => ({
  ...draft.position,
  suggestedUnits: draft.allocated,
  lineCost: draft.allocated * draft.position.unitCost,
  reached: reachedOf(draft),
})

const tierOf = (lines: readonly SuggestedLine[]): BudgetTier => {
  if (lines.length === 0) return "nothing_to_order"
  if (lines.every((line) => line.reached === "tope")) return "tope"
  if (lines.every((line) => line.reached === "tope" || line.reached === "base")) return "between_base_and_tope"
  if (lines.every((line) => line.suggestedUnits === 0)) return "not_even_one_pack"
  return "below_base"
}

/**
 * Regla del dueño: con poca plata, hasta la base; con mucha, hasta el tope; si no, hasta donde alcance.
 * Fase 1: cubrir la base de todos (el más urgente primero). Fase 2: con lo que sobre, subir hacia el tope.
 * budget null = sin límite: todo al tope.
 */
export const allocateByLevels = (budget: number | null) => (positions: readonly ProductPosition[]): SuggestionPlan => {
  const drafts: readonly Draft[] = positions.map((position) => ({ position, allocated: 0 }))
  const filled =
    budget === null
      ? fillCompletely(toTope)({ drafts, remaining: Number.POSITIVE_INFINITY })
      : fillTowards(toTope)(fillTowards(toBase)({ drafts, remaining: Math.max(0, budget) }))
  const lines = filled.drafts.map(toSuggestedLine)
  const totalCost = lines.reduce((total, line) => total + line.lineCost, 0)
  return {
    lines,
    budget,
    totalCost,
    remainingBudget: budget === null ? null : Math.max(0, budget - totalCost),
    tier: tierOf(lines),
  }
}
