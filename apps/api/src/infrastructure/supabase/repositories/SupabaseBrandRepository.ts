import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"
import type { Brand } from "@agente-pedidos/order-agent"
import type { BrandRepository } from "../../../application/ports.js"
import { brandFromRow } from "../mappers.js"

export class SupabaseBrandRepository implements BrandRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listNamesByProductIds(storeId: string, productIds: string[]): Promise<Map<string, string>> {
    if (productIds.length === 0) return new Map()
    const namesById = new Map<string, string>()
    const { data: productRows, error: productError } = await this.supabase
      .from("products")
      .select("id, brand_id")
      .eq("store_id", storeId)
      .in("id", productIds)
      .not("brand_id", "is", null)
    if (productError) throw productError

    const brandIds = [
      ...new Set((productRows ?? []).map((row) => row.brand_id).filter((id): id is string => id !== null)),
    ]
    const { data: brandRows, error: brandError } = await this.supabase
      .from("brands")
      .select("*")
      .in("id", brandIds)
    if (brandError) throw brandError

    const nameById = new Map((brandRows ?? []).map((row) => [row.id, row.name]))
    for (const productRow of productRows ?? []) {
      const brandName = productRow.brand_id === null ? null : (nameById.get(productRow.brand_id) ?? null)
      if (brandName !== null) namesById.set(productRow.id, brandName)
    }
    return namesById
  }

  async findByNameAndSupplier(storeId: string, name: string, supplierId: string): Promise<Brand | null> {
    const { data, error } = await this.supabase
      .from("brands")
      .select("*")
      .eq("store_id", storeId)
      .eq("supplier_id", supplierId)
      .eq("name", name)
      .maybeSingle()
    if (error) throw error
    return data === null ? null : brandFromRow(data)
  }

  async create(storeId: string, name: string, supplierId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from("brands")
      .insert({ store_id: storeId, name, supplier_id: supplierId })
      .select("id")
      .single()
    if (error) throw error
    return data.id
  }

  async assignToProduct(storeId: string, productId: string, brandId: string): Promise<void> {
    const { error } = await this.supabase
      .from("products")
      .update({ brand_id: brandId, updated_at: new Date().toISOString() })
      .eq("store_id", storeId)
      .eq("id", productId)
    if (error) throw error
  }
}