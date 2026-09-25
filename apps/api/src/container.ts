import { createClient, type SupabaseClient } from "@supabase/supabase-js"
import { DataQualityInspector, OrderSuggestionCalculator } from "@agente-pedidos/order-agent"
import type { Database } from "@agente-pedidos/database-types"
import { SupabaseStoreRepository } from "./infrastructure/supabase/repositories/SupabaseStoreRepository.js"
import { SupabaseSupplierRepository } from "./infrastructure/supabase/repositories/SupabaseSupplierRepository.js"
import { SupabaseProductRepository } from "./infrastructure/supabase/repositories/SupabaseProductRepository.js"
import { SupabaseSalesReportRepository } from "./infrastructure/supabase/repositories/SupabaseSalesReportRepository.js"
import { SupabasePurchaseOrderRepository } from "./infrastructure/supabase/repositories/SupabasePurchaseOrderRepository.js"
import { SupabaseInventoryMovementRepository } from "./infrastructure/supabase/repositories/SupabaseInventoryMovementRepository.js"
import { SupabaseBrandRepository } from "./infrastructure/supabase/repositories/SupabaseBrandRepository.js"
import { CatalogImportRepository } from "./infrastructure/supabase/CatalogImportRepository.js"
import { SoftwareCatalogParser } from "./infrastructure/parsers/SoftwareCatalogParser.js"
import { SalesExcelParser } from "./infrastructure/parsers/SalesExcelParser.js"
import { CatalogImportService } from "./application/CatalogImportService.js"
import { SalesReportImportService } from "./application/SalesReportImportService.js"
import { OrderSuggestionService } from "./application/OrderSuggestionService.js"
import { PurchaseOrderService } from "./application/PurchaseOrderService.js"
import { TruckDeliveryService } from "./application/TruckDeliveryService.js"
import { SupplierSettingsService } from "./application/SupplierSettingsService.js"
import { ProductSettingsService } from "./application/ProductSettingsService.js"
import { StoreSettingsService } from "./application/StoreSettingsService.js"
import { DailyCashService } from "./application/DailyCashService.js"
import { StoreProfileService } from "./application/StoreProfileService.js"
import { OrderPaymentService } from "./application/OrderPaymentService.js"
import { SupabaseStoreProfileRepository } from "./infrastructure/supabase/repositories/SupabaseStoreProfileRepository.js"
import { SupabaseDailyCashRepository } from "./infrastructure/supabase/repositories/SupabaseDailyCashRepository.js"

export interface ContainerOptions {
  supabaseUrl: string
  supabaseSecretKey: string
}

export class Container {
  readonly supabase: SupabaseClient<Database>

  readonly storeRepository: SupabaseStoreRepository
  readonly supplierRepository: SupabaseSupplierRepository
  readonly productRepository: SupabaseProductRepository
  readonly salesReportRepository: SupabaseSalesReportRepository
  readonly purchaseOrderRepository: SupabasePurchaseOrderRepository
  readonly inventoryMovementRepository: SupabaseInventoryMovementRepository
  readonly brandRepository: SupabaseBrandRepository
  readonly catalogImportRepository: CatalogImportRepository

  readonly storeSettingsService: StoreSettingsService
  readonly catalogImportService: CatalogImportService
  readonly salesReportImportService: SalesReportImportService
  readonly supplierSettingsService: SupplierSettingsService
  readonly productSettingsService: ProductSettingsService
  readonly dailyCashService: DailyCashService
  readonly storeProfileService: StoreProfileService
  readonly orderPaymentService: OrderPaymentService
  readonly orderSuggestionService: OrderSuggestionService
  readonly purchaseOrderService: PurchaseOrderService
  readonly truckDeliveryService: TruckDeliveryService

  constructor(options: ContainerOptions) {
    this.supabase = createClient<Database>(options.supabaseUrl, options.supabaseSecretKey)

    this.storeRepository = new SupabaseStoreRepository(this.supabase)
    this.supplierRepository = new SupabaseSupplierRepository(this.supabase)
    this.productRepository = new SupabaseProductRepository(this.supabase)
    this.salesReportRepository = new SupabaseSalesReportRepository(this.supabase)
    this.purchaseOrderRepository = new SupabasePurchaseOrderRepository(this.supabase)
    this.inventoryMovementRepository = new SupabaseInventoryMovementRepository(this.supabase)
    this.brandRepository = new SupabaseBrandRepository(this.supabase)
    this.catalogImportRepository = new CatalogImportRepository(this.supabase)

    const softwareCatalogParser = new SoftwareCatalogParser()
    const salesExcelParser = new SalesExcelParser()
    const dataQualityInspector = new DataQualityInspector()
    const orderSuggestionCalculator = new OrderSuggestionCalculator()

    this.storeSettingsService = new StoreSettingsService(this.storeRepository)
    this.catalogImportService = new CatalogImportService(softwareCatalogParser, this.catalogImportRepository, dataQualityInspector)
    this.salesReportImportService = new SalesReportImportService(
      salesExcelParser,
      this.salesReportRepository,
      this.productRepository,
      this.brandRepository,
      dataQualityInspector,
    )
    this.supplierSettingsService = new SupplierSettingsService(this.supplierRepository)
    this.productSettingsService = new ProductSettingsService(this.productRepository, this.brandRepository)
    this.dailyCashService = new DailyCashService(new SupabaseDailyCashRepository(this.supabase))
    this.storeProfileService = new StoreProfileService(new SupabaseStoreProfileRepository(this.supabase))
    this.orderPaymentService = new OrderPaymentService(this.supabase)
    this.orderSuggestionService = new OrderSuggestionService(
      this.supplierRepository,
      this.productRepository,
      this.salesReportRepository,
      this.brandRepository,
      orderSuggestionCalculator,
      this.dailyCashService,
    )
    this.purchaseOrderService = new PurchaseOrderService(this.purchaseOrderRepository)
    this.truckDeliveryService = new TruckDeliveryService(this.purchaseOrderRepository, this.inventoryMovementRepository)
  }
}