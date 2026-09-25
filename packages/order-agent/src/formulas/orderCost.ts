import { multiplyBy, sumBy } from "../functional/arithmetic.js"

/** F6: costo de una línea = unidades × c. */
export const calculateLineCost = (unitCost: number) => multiplyBy(unitCost)

/** F7: máximo del pedido = Σ costo máximo de las líneas. */
export const calculateMaximumOrderCost = sumBy((line: { maximumLineCost: number }) => line.maximumLineCost)

/** Costo de lo que alcanza = Σ costo asignado de las líneas. */
export const calculateAllocatedOrderCost = sumBy((line: { allocatedLineCost: number }) => line.allocatedLineCost)

/** Costo final del pedido = Σ costo final de las líneas (ya con ajustes del dueño). */
export const calculateFinalOrderCost = sumBy((line: { finalLineCost: number }) => line.finalLineCost)