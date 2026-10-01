import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"
import type { Supplier, SupplierDataSource, SupplierRepository } from "@agente-pedidos/order-agent"
import { supplierFromRow, supplierToUpdate } from "../mappers.js"
import type { NewSupplierRow } from "../../../application/CatalogEntryService.js"

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

  /** ¿Hay otro proveedor con ese nombre (sin distinguir mayúsculas)? */
  async existsByName(storeId: string, name: string): Promise<boolean> {
    const { data, error } = await this.supabase.from("suppliers").select("id").eq("store_id", storeId).ilike("name", name).limit(1)
    if (error) throw error
    return (data ?? []).length > 0
  }

  /**
   * Proveedor nuevo registrado a mano, con su calendario. También crea su visita activa
   * (supplier_sellers), que es lo que lee la bandeja de Sugeridos.
   */
  async create(storeId: string, input: NewSupplierRow): Promise<string> {
    const { data, error } = await this.supabase
      .from("suppliers")
      .insert({
        store_id: storeId,
        name: input.name,
        tax_id: input.taxId,
        contact_email: input.contactEmail,
        whatsapp_number: input.whatsappNumber,
        order_weekday: input.orderWeekday,
        delivery_weekday: input.deliveryWeekday,
        visit_frequency: input.visitFrequency,
        biweekly_anchor_date: input.biweeklyAnchorDate,
        minimum_order_amount: input.minimumOrderAmount,
        maximum_order_amount: input.maximumOrderAmount,
        settings_are_estimated: false,
      })
      .select("id")
      .single()
    if (error) throw error

    const { error: visitError } = await this.supabase.from("supplier_sellers").insert({
      store_id: storeId,
      supplier_id: data.id,
      seller_name: null,
      order_weekday: input.orderWeekday,
      delivery_weekday: input.deliveryWeekday,
      visit_frequency: input.visitFrequency,
      biweekly_anchor_date: input.biweeklyAnchorDate,
      is_active: true,
    })
    if (visitError) {
      await this.supabase.from("suppliers").delete().eq("store_id", storeId).eq("id", data.id)
      throw visitError
    }
    return data.id
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
    identity: { name: string; taxId: string | null; contactEmail: string | null; whatsappNumber: string | null },
  ): Promise<void> {
    const { error } = await this.supabase
      .from("suppliers")
      .update({
        name: identity.name,
        tax_id: identity.taxId,
        contact_email: identity.contactEmail,
        whatsapp_number: identity.whatsappNumber,
        updated_at: new Date().toISOString(),
      })
      .eq("store_id", storeId)
      .eq("id", supplierId)
    if (error) throw error
  }
}