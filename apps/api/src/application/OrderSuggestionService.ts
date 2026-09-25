import { Money, calculateOrderBudget } from "@agente-pedidos/order-agent"
import type { OrderSuggestion, OrderSuggestionCalculator, ReplenishmentMode } from "@agente-pedidos/order-agent"
import type { SupabaseSupplierRepository } from "../infrastructure/supabase/repositories/SupabaseSupplierRepository.js"
import type { SupabaseProductRepository } from "../infrastructure/supabase/repositories/SupabaseProductRepository.js"
import type { SupabaseSalesReportRepository } from "../infrastructure/supabase/repositories/SupabaseSalesReportRepository.js"
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
}

/** Caso de uso 6.1: armar el pedido sugerido de un proveedor con su reporte de ventas más reciente. */
export class OrderSuggestionService {
  constructor(
    private readonly supplierRepository: SupabaseSupplierRepository,
    private readonly productRepository: SupabaseProductRepository,
    private readonly salesReportRepository: SupabaseSalesReportRepository,
    private readonly brandRepository: BrandRepository,
    private readonly calculator: OrderSuggestionCalculator,
    private readonly dailyCashService: DailyCashService,
  ) {}

  async buildSuggestion(input: BuildSuggestionInput): Promise<BuiltSuggestion> {
    const supplier = await this.supplierRepository.findById(input.storeId, input.supplierId)
    if (supplier === null) throw new Error(`El proveedor ${input.supplierId} no existe en esta tienda.`)
    if (!supplier.hasSchedule) throw new Error(`El proveedor ${supplier.name} aún no tiene calendario. Escríbelo en el paso 1.`)

    const [products, salesReport, dailyCash] = await Promise.all([
      this.productRepository.listBySupplier(input.storeId, input.supplierId),
      this.salesReportRepository.findLatest(input.storeId),
      this.dailyCashService.today(input.storeId),
    ])
    const brandNamesByProductId = await this.brandRepository.listNamesByProductIds(
      input.storeId,
      products.map((product) => product.id),
    )

    const maximumOrderAmount = supplier.maximumOrderAmount?.pesos ?? null
    const orderBudget = calculateOrderBudget({
      remainingCash: dailyCash.remainingAmount,
      maximumOrderAmount,
      ownerBudget: input.budgetPesos,
    })

    const suggestion = this.calculator.buildSuggestion({
      supplier,
      products,
      brandNamesByProductId,
      salesReport,
      availableBudget: Money.fromPesos(orderBudget ?? Number.MAX_SAFE_INTEGER),
      replenishmentMode: input.replenishmentMode,
      unitCostOverrides: new Map(
        (input.unitCostOverrides ?? []).map((override) => [override.productId, Money.fromPesos(override.unitCost)]),
      ),
    })

    return {
      suggestion,
      budget: {
        remainingCash: dailyCash.remainingAmount,
        minimumOrderAmount: supplier.minimumOrderAmount.pesos,
        maximumOrderAmount,
        ownerBudget: input.budgetPesos,
        orderBudget,
      },
    }
  }
}
