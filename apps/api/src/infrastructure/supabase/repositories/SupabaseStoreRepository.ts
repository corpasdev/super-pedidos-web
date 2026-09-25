import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"
import type { StoreDataSource, StoreRepository } from "@agente-pedidos/order-agent"

export class SupabaseStoreRepository implements StoreRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async findStoreIdByOwner(ownerUserId: string): Promise<string | null> {
    const { data, error } = await this.supabase
      .from("stores")
      .select("id")
      .eq("owner_user_id", ownerUserId)
      .maybeSingle()
    if (error) throw error
    return data?.id ?? null
  }

  async findById(storeId: string): Promise<StoreDataSource | null> {
    const { data, error } = await this.supabase.from("stores").select("id, name").eq("id", storeId).maybeSingle()
    if (error) throw error
    return data ? { id: data.id, name: data.name } : null
  }

  async createForOwner(ownerUserId: string, name: string): Promise<string> {
    const { data, error } = await this.supabase
      .from("stores")
      .insert({ owner_user_id: ownerUserId, name })
      .select("id")
      .single()
    if (error) throw error
    return data.id
  }
}