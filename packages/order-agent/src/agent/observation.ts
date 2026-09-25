import type { Supplier } from "../domain/entities/Supplier.js"
import type { Product } from "../domain/entities/Product.js"
import type { SalesReport } from "../domain/entities/SalesReport.js"
import { ReplenishmentMode } from "../domain/enums.js"
import type { AgentObservation, AgentObservationAlert } from "./agentTypes.js"

interface ObservationInput {
  supplier: Supplier
  products: Product[]
  salesReport: SalesReport | null
  replenishmentMode: ReplenishmentMode
}

/** Etapa «Observar»: el agente mira qué hay en el Excel, qué conoce del catálogo y qué le falta para decidir. */
export const buildAgentObservation = (input: ObservationInput): AgentObservation => {
  const { supplier, products, salesReport } = input
  const catalogBarcodes = new Set(products.map((product) => product.barcode.value))
  const reportBarcodes = new Set((salesReport?.lines ?? []).map((line) => line.barcode.value))
  const soldProductCount = products.filter((product) => reportBarcodes.has(product.barcode.value)).length
  const reportRange =
    salesReport === null
      ? null
      : { start: salesReport.period.startsAt.toISOString(), end: salesReport.period.endsAt.toISOString() }
  return {
    stage: "observe",
    reportCoveredDays: salesReport?.reportCoveredDays ?? 0,
    scheduledCycleDays: supplier.visitFrequencyDays ?? 0,
    reportRange,
    soldProductCount,
    catalogProductCount: products.length,
    unmatchedSalesCount: salesReport === null ? 0 : salesReport.unmatchedLines(catalogBarcodes).length,
    alerts: buildObservationAlerts({ ...input, reportBarcodes }),
  }
}

const buildObservationAlerts = (args: ObservationInput & { reportBarcodes: Set<string> }): AgentObservationAlert[] => {
  const alerts: AgentObservationAlert[] = []
  const candidates = args.products.filter((product) => args.reportBarcodes.has(product.barcode.value))

  for (const product of candidates) {
    if (product.unitCost.pesos === 0) {
      alerts.push({
        code: "zero_cost",
        productId: product.id,
        barcode: product.barcode.value,
        description: `${product.name} quedó con costo 0; se sugeriría sin saber cuánto vale.`,
      })
    }
    if (product.unitCost.pesos > 0 && product.unitCost.pesos >= product.salePrice.pesos) {
      alerts.push({
        code: "cost_above_sale_price",
        productId: product.id,
        barcode: product.barcode.value,
        description: `${product.name} cuesta ${product.unitCost.pesos} y se vende a ${product.salePrice.pesos}.`,
      })
    }
    if (product.isEstimated) {
      alerts.push({
        code: "estimated_cost",
        productId: product.id,
        barcode: product.barcode.value,
        description: `${product.name} usa un costo estimado; confírmalo con el vendedor.`,
      })
    }
  }

  if (args.replenishmentMode === ReplenishmentMode.FillToTarget) {
    for (const product of args.products) {
      if (product.stockUnits > 0 && !product.isStockReliable) {
        alerts.push({
          code: "unreliable_stock_for_fill",
          productId: product.id,
          barcode: product.barcode.value,
          description: `${product.name} tiene stock sin contar; queda fuera de Llenar inventario hasta contarlo.`,
        })
      }
    }
  }

  if (args.supplier.hasSchedule && args.salesReport !== null) {
    const frequency = args.supplier.visitFrequencyDays ?? Number.POSITIVE_INFINITY
    if (args.salesReport.reportCoveredDays < frequency) {
      alerts.push({
        code: "report_does_not_cover_cycle",
        productId: null,
        barcode: null,
        description: `El Excel cubre ${args.salesReport.reportCoveredDays} de ${frequency} días del ciclo; descargá el rango completo.`,
      })
    }
  }

  return alerts
}