import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"
import type { Supplier, SupplierDataSource, SupplierRepository } from "@agente-pedidos/order-agent"
import { supplierFromRow, supplierToUpdate } from "../mappers.js"

export class SupabaseSupplierRepository implements SupplierRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async listWithProductCount(storeId: string): Promise<SupplierDataSource[]> {
    const { data: supplierRows, error: suppliersError } = await this.supabase
      .from("suppliers")
      .select("*, products(count)")
      .eq("store_id", storeId)
      .order("name")
    if (suppliersError) throw suppliersError

    const { data: lastOrderRows, error: ordersError } = await this.supabase
      .from("purchase_orders")
      .select("supplier_id, created_at")
      .eq("store_id", storeId)
      .order("created_at", { ascending: false })
    if (ordersError) throw ordersError

    const lastOrderAtBySupplierId = new Map<string, Date>()
    for (const row of lastOrderRows ?? []) {
      if (!lastOrderAtBySupplierId.has(row.supplier_id)) {
        lastOrderAtBySupplierId.set(row.supplier_id, new Date(row.created_at))
      }
    }

    return (supplierRows ?? []).map((row) => {
      const embedded = (row as unknown as { products: unknown }).products
      let productCount = 0
      if (Array.isArray(embedded)) {
        const first = (embedded as Array<{ count: unknown }>)[0]
        productCount = typeof first?.count === "number" ? first.count : Number(first?.count ?? 0)
      } else {
        productCount = Number((embedded as { count: unknown } | null)?.count ?? 0)
      }
      return {
        supplier: supplierFromRow(row),
        productCount,
        lastOrderAt: lastOrderAtBySupplierId.get(row.id) ?? null,
      }
    })
  }

  async findById(storeId: string, supplierId: string): Promise<Supplier | null> {
    const { data, error } = await this.supabase
      .from("suppliers")
      .select("*")
      .eq("store_id", storeId)
      .eq("id", supplierId)
      .maybeSingle()
    if (error) throw error
    return data === null ? null : supplierFromRow(data)
  }

  async save(storeId: string, supplier: Supplier): Promise<void> {
    const { error } = await this.supabase
      .from("suppliers")
      .update(supplierToUpdate(supplier))
      .eq("store_id", storeId)
      .eq("id", supplier.id)
    if (error) throw error
  }

  async saveIdentity(
    storeId: string,
    supplierId: string,
    identity: { name: string; taxId: string | null; contactEmail: string | null },
  ): Promise<void> {
    const { error } = await this.supabase
      .from("suppliers")
      .update({
        name: identity.name,
        tax_id: identity.taxId,
        contact_email: identity.contactEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("store_id", storeId)
      .eq("id", supplierId)
    if (error) throw error
  }
}