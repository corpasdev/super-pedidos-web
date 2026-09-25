import type { Product } from "../domain/entities/Product.js"
import { CostSource } from "../domain/enums.js"
import type { AgentMemory } from "./agentTypes.js"

/** Etapa «Aprender»: lo que el agente ya sabe de la tienda viene de lo que el dueño escribió y de las entregas recibidas. */
export const buildAgentMemory = (products: Product[]): AgentMemory => ({
  stage: "learn",
  correctedCostProductCount: products.filter((product) => product.costSource === CostSource.Owner).length,
  estimatedCostProductCount: products.filter((product) => product.isEstimated).length,
  countedStockProductCount: products.filter((product) => product.isStockReliable).length,
  fillToTargetEligibleProductCount: products.filter((product) => product.isStockReliable || product.stockUnits === 0).length,
})