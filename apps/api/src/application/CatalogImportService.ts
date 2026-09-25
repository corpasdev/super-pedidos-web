import { CatalogImportError, type DataQualityInspector, type DataQualityIssue } from "@agente-pedidos/order-agent"
import type { CatalogImportRepository } from "../infrastructure/supabase/CatalogImportRepository.js"
import type { SoftwareCatalogParser, ParsedProductEntry, ParsedSupplierEntry } from "../infrastructure/parsers/SoftwareCatalogParser.js"

export interface CatalogImportResult {
  suppliersImported: number
  productsImported: number
  productsWithUnknownSupplier: number
  issues: DataQualityIssue[]
}

/** Caso de uso 7.1: importar el catálogo del software de ventas (upsert por external_id). */
export class CatalogImportService {
  constructor(
    private readonly parser: SoftwareCatalogParser,
    private readonly catalogRepository: CatalogImportRepository,
    private readonly dataQualityInspector: DataQualityInspector,
  ) {}

  async import(storeId: string, payload: { suppliers: unknown; products: unknown }): Promise<CatalogImportResult> {
    const parsedSuppliers = this.parser.parseSuppliers(payload.suppliers)
    const supplierIdsByExternalId = await this.catalogRepository.upsertSuppliers(storeId, parsedSuppliers)
    verifyUniqueExternalIds(parsedSuppliers)

    const parsedProducts = this.parser.parseProducts(payload.products, new Map(parsedSuppliers.map((supplier) => [supplier.externalId, supplier])))
    const productDrafts = parsedProducts.map((product) => ({
      externalId: product.externalId,
      barcode: product.barcode,
      reference: product.reference,
      name: product.name,
      category: product.category,
      salePrice: product.salePrice,
      stockUnits: product.stockUnits,
      supplierDbId: product.supplierExternalId === null ? null : supplierIdsByExternalId.get(product.supplierExternalId) ?? null,
    }))

    const productsByIdByBarcode = await this.catalogRepository.upsertProductsByBarcode(storeId, productDrafts)
    await this.catalogRepository.applyInitialStock(storeId, productDrafts)

    const rawProducts = parsedProducts.map((product, index) => ({
      id: productsByIdByBarcode.get(product.barcode) ?? `import-${index}`,
      supplierId: productDrafts[index]?.supplierDbId ?? null,
      supplierName: product.supplierName,
      barcode: product.barcode,
      productName: product.name,
      category: product.category,
      stockUnits: product.stockUnits,
      salePrice: product.salePrice,
    }))
    const issues = this.dataQualityInspector.inspect(rawProducts)
    await this.catalogRepository.replaceDataQualityIssues(storeId, issues)

    return {
      suppliersImported: parsedSuppliers.length,
      productsImported: parsedProducts.length,
      productsWithUnknownSupplier: parsedProducts.filter((product) => product.supplierExternalId === null).length,
      issues,
    }
  }
}

const verifyUniqueExternalIds = (suppliers: ParsedSupplierEntry[]): void => {
  const externalIds = suppliers.map((supplier) => supplier.externalId)
  if (new Set(externalIds).size !== externalIds.length) throw new CatalogImportError("hay proveedores repetidos (misma llave 'id')")
}

export type { ParsedProductEntry }