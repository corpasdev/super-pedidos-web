import { divideBy } from "../functional/arithmetic.js"
import { pipe } from "../functional/pipe.js"

/** F2: ritmo diario de venta = v ÷ d. Se compone con las demás fórmulas. */
export const calculateDailySalesRate = (reportCoveredDays: number) => pipe(divideBy(reportCoveredDays))
export const dailySalesRate = calculateDailySalesRate