import { multiplyBy, ratioOf } from "../functional/arithmetic.js"
import { iterateUntil, pipe } from "../functional/pipe.js"

export interface AllocatableLine {
  productId: string
  barcode: string
  packSize: number
  unitCost: number
  unitsSold: number
  targetUnits: number
  stockToDiscount: number
  suggestedMaximumUnits: number
  allocatedUnits: number
}

interface AllocationState {
  readonly remainingBudget: number
  readonly lines: AllocatableLine[]
}

const packCostOf = (line: AllocatableLine) => multiplyBy(line.unitCost)(line.packSize)

/** Máximo del pedido (F7) = Σ máximo sugerido × costo unitario. */
const maximumOrderCostOf = (lines: AllocatableLine[]) =>
  lines.reduce((total, line) => total + line.suggestedMaximumUnits * line.unitCost, 0)

/** R5 (múltiplos de empaque) y nunca pasarse de la plata. */
const canReceiveAnotherPack = (remainingBudget: number) => (line: AllocatableLine) =>
  line.allocatedUnits < line.suggestedMaximumUnits && packCostOf(line) <= remainingBudget

/** F8: cobertura de la línea = (stock descontado + asignado) ÷ objetivo. */
const coverageOf = (line: AllocatableLine) =>
  pipe((units: number) => units + line.stockToDiscount, ratioOf(line.targetUnits))(line.allocatedUnits)

const byCoverageThenUnitsSoldThenBarcode =
  (coverageOfLine: (line: AllocatableLine) => number) => (left: AllocatableLine, right: AllocatableLine) => {
    const coverageDifference = coverageOfLine(left) - coverageOfLine(right)
    if (coverageDifference !== 0) return coverageDifference
    if (left.unitsSold !== right.unitsSold) return right.unitsSold - left.unitsSold
    return left.barcode.localeCompare(right.barcode)
  }

const selectLeastCoveredLine = (state: AllocationState) =>
  state.lines.filter(canReceiveAnotherPack(state.remainingBudget)).sort(byCoverageThenUnitsSoldThenBarcode(coverageOf))[0] ?? null

const giveOnePack = (state: AllocationState): AllocationState => {
  const chosenLine = selectLeastCoveredLine(state)
  if (chosenLine === null) return state
  return {
    remainingBudget: state.remainingBudget - packCostOf(chosenLine),
    lines: state.lines.map((line) =>
      line.productId === chosenLine.productId
        ? { ...line, allocatedUnits: line.allocatedUnits + line.packSize }
        : line,
    ),
  }
}

const hasNoLineToFeed = (state: AllocationState) => selectLeastCoveredLine(state) === null

const startAtZero = (lines: AllocatableLine[]) => lines.map((line) => ({ ...line, allocatedUnits: 0 }))

const allocateEverything = (lines: AllocatableLine[]) =>
  lines.map((line) => ({ ...line, allocatedUnits: line.suggestedMaximumUnits }))

/**
 * F9: reparto de la plata. Si B >= máximo, cada línea recibe su máximo.
 * Si no, un empaque por paso a la línea de menor cobertura hasta agotar la plata.
 */
export const allocateBudgetByCoverage = (availableBudget: number) => (lines: AllocatableLine[]): AllocatableLine[] =>
  maximumOrderCostOf(lines) <= availableBudget
    ? allocateEverything(lines)
    : iterateUntil(hasNoLineToFeed, giveOnePack)({ remainingBudget: availableBudget, lines: startAtZero(lines) })
        .lines.map((line) => line)

/** F8 como función pura exportada (la usa `OrderLine.coverageRatio`). */
export const calculateCoverageRatio = (stockToDiscount: number, targetUnits: number) => (allocatedUnits: number) =>
  pipe((units: number) => units + stockToDiscount, ratioOf(targetUnits))(allocatedUnits)