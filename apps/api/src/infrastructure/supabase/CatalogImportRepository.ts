import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"
import { estimateUnitCost, type DataQualityIssue } from "@agente-pedidos/order-agent"

export interface SupplierDraft {
  externalId: number
  name: string
  taxId: string | null
  contactEmail: string | null
}

export interface ProductDraft {
  externalId: number
  barcode: string
  reference: string | null
  name: string
  category: string
  salePrice: number
  stockUnits: number | null
  supplierDbId: string | null
}

/** Persistencia del catálogo importado: upsert por external_id (7.1), sin tocar ajustes del dueño. */
export class CatalogImportRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async upsertSuppliers(storeId: string, drafts: SupplierDraft[]): Promise<Map<number, string>> {
    if (drafts.length === 0) return new Map()
    const { data, error } = await this.supabase
      .from("suppliers")
      .upsert(
        drafts.map((draft) => ({
          store_id: storeId,
          external_id: draft.externalId,
          name: draft.name,
          tax_id: draft.taxId,
          contact_email: draft.contactEmail,
          minimum_order_amount: 0,
          settings_are_estimated: true,
          updated_at: new Date().toISOString(),
        })),
        { onConflict: "store_id,external_id" },
      )
      .select("id, external_id")
    if (error) throw error
    return new Map((data ?? []).map((row) => [row.external_id as number, row.id]))
  }

  async upsertProductsByBarcode(storeId: string, drafts: ProductDraft[]): Promise<Map<string, string>> {
    const upgraded = new Map<string, string>()
    if (drafts.length === 0) return upgraded

    for (const chunk of chunkArray(drafts, UPSERT_CHUNK_SIZE)) {
      const { data, error } = await this.supabase
        .from("products")
        .upsert(
          chunk.map((draft) => ({
            store_id: storeId,
            external_id: draft.externalId,
            barcode: draft.barcode,
            reference: draft.reference,
            name: draft.name,
            category: draft.category,
            sale_price: draft.salePrice,
            supplier_id: draft.supplierDbId,
            brand_id: null,
            stock_units: 0,
            is_stock_reliable: false,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "store_id,barcode" },
        )
        .select("id, barcode")
      if (error) throw error
      for (const row of data ?? []) upgraded.set(row.barcode, row.id)
    }

    for (const chunk of chunkArray(drafts, UPSERT_CHUNK_SIZE)) {
      const settingsRowsToInsert = chunk.flatMap((draft) => {
        const productId = upgraded.get(draft.barcode)
        return productId === undefined
          ? []
          : [{
              store_id: storeId,
              product_id: productId,
              pack_size: 1,
              // R8 estimado: el catálogo no trae costo; se estima con el recargo del dueño (dulcería 30 %, resto 20 %).
              unit_cost: estimateUnitCost(draft.salePrice, draft.category),
              cost_source: "estimated",
              is_estimated: true,
            }]
      })
      if (settingsRowsToInsert.length === 0) continue
      // Solo productos nuevos: reimportar el catálogo no debe pisar el empaque, la base ni el costo ya guardados.
      const { error } = await this.supabase
        .from("product_settings")
        .upsert(settingsRowsToInsert, { onConflict: "product_id", ignoreDuplicates: true })
      if (error) throw error
    }
    return upgraded
  }

  /** Stock del Excel: solo se aplica si el producto no tiene stock contado por el dueño (7.3). En lote. */
  async applyInitialStock(storeId: string, drafts: ProductDraft[]): Promise<void> {
    if (drafts.length === 0) return
    const { data, error: readError } = await this.supabase
      .from("products")
      .select("id, store_id, barcode, name, category, stock_units, is_stock_reliable")
      .eq("store_id", storeId)
    if (readError) throw readError

    const currentByBarcode = new Map((data ?? []).map((row) => [row.barcode, row]))
    const stockUpdates: Array<{
      id: string
      store_id: string
      barcode: string
      name: string
      category: string
      stock_units: number
      is_stock_reliable: boolean
      updated_at: string
    }> = []

    for (const draft of drafts) {
      const current = currentByBarcode.get(draft.barcode)
      if (!current || current.is_stock_reliable) continue
      const fixedStock = Math.max(0, draft.stockUnits ?? 0)
      const stockIsPlausible = draft.stockUnits !== null && draft.stockUnits <= 10_000
      stockUpdates.push({
        id: current.id,
        store_id: current.store_id,
        barcode: current.barcode,
        name: current.name,
        category: current.category,
        stock_units: fixedStock,
        is_stock_reliable: current.is_stock_reliable || !stockIsPlausible,
        updated_at: new Date().toISOString(),
      })
    }

    for (const chunk of chunkArray(stockUpdates, UPSERT_CHUNK_SIZE)) {
      const { error } = await this.supabase.from("products").upsert(chunk, { onConflict: "id" })
      if (error) throw error
    }
  }

  async replaceDataQualityIssues(storeId: string, issues: DataQualityIssue[]): Promise<void> {
    const { error: deleteError } = await this.supabase.from("data_quality_issues").delete().eq("store_id", storeId)
    if (deleteError) throw deleteError
    if (issues.length === 0) return

    const { error: insertError } = await this.supabase.from("data_quality_issues").insert(
      issues.map((issue) => ({
        store_id: storeId,
        product_id: issue.productId,
        barcode: issue.barcode,
        issue_code: issue.issueCode,
        original_value: issue.originalValue,
        description: issue.description,
      })),
    )
    if (insertError) throw insertError
  }
}

const UPSERT_CHUNK_SIZE = 500

const chunkArray = <T,>(items: T[], size: number): T[][] => {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}