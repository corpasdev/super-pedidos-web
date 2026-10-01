import { computed } from "vue"
import { useWizardStore } from "../../stores/wizardStore"
import type { SuggestionLine } from "../../infrastructure/apiTypes"

/**
 * Edición del pedido sugerido abierto (bandeja en acordeón y vista de revisión):
 * líneas ordenadas por urgencia, unidades con los ajustes del dueño, total y acciones −/+ y precio.
 */
export function useOrderEditor() {
  const wizard = useWizardStore()

  /** Primero los más urgentes: los que ya se comieron la base (EA más negativa). */
  const lines = computed<SuggestionLine[]>(() =>
    (wizard.suggestion?.groups ?? [])
      .flatMap((group) => group.lines)
      .sort((left, right) => (left.stockPosition?.unitsAboveBase ?? 0) - (right.stockPosition?.unitsAboveBase ?? 0)),
  )

  const unitsOf = (line: SuggestionLine): number => wizard.ownerUnits[line.productId] ?? line.finalUnits
  const total = computed(() => lines.value.reduce((sum, line) => sum + unitsOf(line) * line.unitCost, 0))
  const productCount = computed(() => lines.value.filter((line) => unitsOf(line) > 0).length)
  const remainingCash = computed(() => wizard.dailyCash?.remainingAmount ?? null)

  /** Sube o baja de a un empaque, sin pasar del tope. */
  function step(line: SuggestionLine, packDelta: number): void {
    const next = unitsOf(line) + packDelta * line.packSize
    wizard.setOwnerUnits(line.productId, Math.max(0, Math.min(next, line.suggestedMaximumUnits)))
  }

  /** Precio que da el vendedor para este pedido: el pedido se recalcula en el servidor. */
  async function price(line: SuggestionLine, unitCost: number): Promise<void> {
    await wizard.setUnitCost(line.productId, unitCost)
  }

  return { lines, unitsOf, total, productCount, remainingCash, step, price }
}
