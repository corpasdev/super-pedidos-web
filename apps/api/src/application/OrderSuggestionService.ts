import { Money, ReplenishmentMode, calculateOrderBudget, movedUnitsSince, runOrderAgent } from "@agente-pedidos/order-agent"
import type { AgentDecision, OrderSuggestion, Product } from "@agente-pedidos/order-agent"
import type { SupabaseSupplierRepository } from "../infrastructure/supabase/repositories/SupabaseSupplierRepository.js"
import type { SupabaseProductRepository } from "../infrastructure/supabase/repositories/SupabaseProductRepository.js"
import type { SupabaseSalesReportRepository } from "../infrastructure/supabase/repositories/SupabaseSalesReportRepository.js"
import type { SupabaseSalesDailyRepository } from "../infrastructure/supabase/repositories/SupabaseSalesDailyRepository.js"
import type { BrandRepository } from "./ports.js"
import type { DailyCashService } from "./DailyCashService.js"

export interface BuildSuggestionInput {
  storeId: string
  supplierId: string
  /** null = el dueño no escribió un límite propio para este pedido. */
  budgetPesos: number | null
  replenishmentMode: ReplenishmentMode
  /** Precio que dio el vendedor para este pedido, por producto. */
  unitCostOverrides?: { productId: string; unitCost: number }[]
}

/** De dónde salió la plata del pedido (B): el menor de los límites conocidos. */
export interface OrderBudgetBreakdown {
  remainingCash: number | null
  minimumOrderAmount: number
  maximumOrderAmount: number | null
  ownerBudget: number | null
  /** null = sin límite. */
  orderBudget: number | null
}

export interface BuiltSuggestion {
  suggestion: OrderSuggestion
  budget: OrderBudgetBreakdown
  /** Qué decidió el agente: estado, qué permitió la plata y cuántos productos están bajo la base. */
  decision: AgentDecision
}

/**
 * Caso de uso: pedido sugerido de un proveedor.
 * Este servicio es el borde de efectos: lee Supabase (productos, ventas por día, entregas, caja) y le pasa
 * los datos al agente, que es una composición de funciones puras (runOrderAgent).
 */
export class OrderSuggestionService {
  constructor(
    private readonly supplierRepository: SupabaseSupplierRepository,
    private readonly productRepository: SupabaseProductRepository,
    private readonly salesReportRepository: SupabaseSalesReportRepository,
    private readonly brandRepository: BrandRepository,
    private readonly dailyCashService: DailyCashService,
    private readonly salesDailyRepository: SupabaseSalesDailyRepository,
  ) {}

  async buildSuggestion(input: BuildSuggestionInput): Promise<BuiltSuggestion> {
    const supplier = await this.supplierRepository.findById(input.storeId, input.supplierId)
    if (supplier === null) throw new Error(`El proveedor ${input.supplierId} no existe en esta tienda.`)
    if (!supplier.hasSchedule) throw new Error(`El proveedor ${supplier.name} aún no tiene calendario.`)

    const [products, salesReport, dailyCash] = await Promise.all([
      this.productRepository.listBySupplier(input.storeId, input.supplierId),
      this.salesReportRepository.findLatest(input.storeId),
      this.dailyCashService.today(input.storeId),
    ])
    const [brandNamesByProductId, movedUnitsByBarcode] = await Promise.all([
      this.brandRepository.listNamesByProductIds(input.storeId, products.map((product) => product.id)),
      input.replenishmentMode === ReplenishmentMode.Levels ? this.movedUnitsFor(input.storeId, products) : Promise.resolve(undefined),
    ])

    const maximumOrderAmount = supplier.maximumOrderAmount?.pesos ?? null
    const orderBudget = calculateOrderBudget({
      remainingCash: dailyCash.remainingAmount,
      maximumOrderAmount,
      ownerBudget: input.budgetPesos,
    })

    const run = runOrderAgent({
      supplier,
      products,
      brandNamesByProductId,
      salesReport,
      availableBudget: Money.fromPesos(orderBudget ?? Number.MAX_SAFE_INTEGER),
      replenishmentMode: input.replenishmentMode,
      today: new Date(),
      unitCostOverrides: new Map(
        (input.unitCostOverrides ?? []).map((override) => [override.productId, Money.fromPesos(override.unitCost)]),
      ),
      movedUnitsByBarcode,
      budgetPesos: orderBudget,
    })

    return {
      suggestion: run.suggestion,
      decision: run.decision,
      budget: {
        remainingCash: dailyCash.remainingAmount,
        minimumOrderAmount: supplier.minimumOrderAmount.pesos,
        maximumOrderAmount,
        ownerBudget: input.budgetPesos,
        orderBudget,
      },
    }
  }

  /** CM de cada producto: lo vendido (ventas por día) después de su última entrega recibida. */
  private async movedUnitsFor(storeId: string, products: readonly Product[]): Promise<ReadonlyMap<string, number>> {
    const [sales, lastDeliveryByProductId] = await Promise.all([
      this.salesDailyRepository.listForBarcodes(storeId, products.map((product) => product.barcode.value)),
      this.salesDailyRepository.lastDeliveryDayByProductId(storeId, products.map((product) => product.id)),
    ])
    const lastDeliveryByBarcode = new Map(
      products.flatMap((product) => {
        const day = lastDeliveryByProductId.get(product.id)
        return day === undefined ? [] : [[product.barcode.value, day] as const]
      }),
    )
    return movedUnitsSince(lastDeliveryByBarcode)(sales)
  }
}
