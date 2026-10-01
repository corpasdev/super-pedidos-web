import { pipe } from "../functional/pipe.js"
import { allocateByLevels } from "./allocation.js"
import { hasMoved, positionOf } from "./levels.js"
import type { SuggestionItem, SuggestionPlan } from "./types.js"

const onlyMoved = (items: readonly SuggestionItem[]): readonly SuggestionItem[] => items.filter(hasMoved)
const toPositions = (items: readonly SuggestionItem[]) => items.map(positionOf)

/**
 * Pedido sugerido como composición de funciones puras:
 * productos movidos → posición de cada uno (EA, existencia, faltantes) → reparto de la plata por niveles.
 * Mismos datos → mismo plan. Sin efectos: la lectura de Supabase y del Excel queda en los bordes.
 */
export const planSuggestion = (budget: number | null): ((items: readonly SuggestionItem[]) => SuggestionPlan) =>
  pipe(onlyMoved, toPositions, allocateByLevels(budget))
