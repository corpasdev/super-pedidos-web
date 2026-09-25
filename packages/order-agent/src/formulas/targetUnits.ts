import { capAt, multiplyBy, roundUp } from "../functional/arithmetic.js"
import { pipe } from "../functional/pipe.js"
import { calculateDailySalesRate } from "./salesRate.js"
import { ReplenishmentMode } from "../domain/enums.js"

export interface FillToTargetParameters {
  reportCoveredDays: number
  coverageDays: number
  safetyMarginRatio: number
  maxStockUnits: number | null
}

/** F3b: objetivo en modo `FillToTarget` = min(ceil((v ÷ d) × (F + L) × (1 + m)), T). */
export const calculateFillToTargetUnits = (parameters: FillToTargetParameters) =>
  pipe(
    calculateDailySalesRate(parameters.reportCoveredDays),
    multiplyBy(parameters.coverageDays),
    multiplyBy(1 + parameters.safetyMarginRatio),
    roundUp,
    capAt(parameters.maxStockUnits),
  )

/** Rellenar la base: objetivo = base (T). Sin base escrita, se repone lo vendido (v). */
export const calculateFillToBaseUnits = (maxStockUnits: number | null) => (unitsSold: number) =>
  maxStockUnits === null ? unitsSold : maxStockUnits

/** F3a / F3b / base según el modo de reposición. En `ReplenishSold` el objetivo es exactamente lo vendido (v). */
export const calculateTargetUnits = (mode: ReplenishmentMode, parameters: FillToTargetParameters) => {
  if (mode === ReplenishmentMode.ReplenishSold) return (unitsSold: number) => unitsSold
  if (mode === ReplenishmentMode.FillToBase) return calculateFillToBaseUnits(parameters.maxStockUnits)
  return calculateFillToTargetUnits(parameters)
}