import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"

export const STORE_LOGOS_BUCKET = "store-logos"

export interface StoreProfileRecord {
  id: string
  name: string
  adminName: string | null
  contactEmail: string | null
  logoPath: string | null
  updatedAt: string
}

export interface StoreProfileChanges {
  name?: string
  adminName?: string | null
  contactEmail?: string | null
}

/** Perfil de la tienda (tabla stores) y su logo (bucket store-logos). */
export class SupabaseStoreProfileRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async find(storeId: string): Promise<StoreProfileRecord | null> {
    const { data, error } = await this.supabase
      .from("stores")
      .select("id, name, admin_name, contact_email, logo_path, updated_at")
      .eq("id", storeId)
      .maybeSingle()
    if (error) throw error
    return data === null
      ? null
      : {
          id: data.id,
          name: data.name,
          adminName: data.admin_name,
          contactEmail: data.contact_email,
          logoPath: data.logo_path,
          updatedAt: data.updated_at,
        }
  }

  async update(storeId: string, changes: StoreProfileChanges): Promise<void> {
    const { error } = await this.supabase
      .from("stores")
      .update({
        ...(changes.name !== undefined ? { name: changes.name } : {}),
        ...(changes.adminName !== undefined ? { admin_name: changes.adminName } : {}),
        ...(changes.contactEmail !== undefined ? { contact_email: changes.contactEmail } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", storeId)
    if (error) throw error
  }

  async setLogoPath(storeId: string, logoPath: string | null): Promise<void> {
    const { error } = await this.supabase
      .from("stores")
      .update({ logo_path: logoPath, updated_at: new Date().toISOString() })
      .eq("id", storeId)
    if (error) throw error
  }

  async uploadLogo(path: string, file: Buffer, contentType: string): Promise<void> {
    const { error } = await this.supabase.storage.from(STORE_LOGOS_BUCKET).upload(path, file, { contentType, upsert: false })
    if (error) throw error
  }

  async removeLogo(path: string): Promise<void> {
    const { error } = await this.supabase.storage.from(STORE_LOGOS_BUCKET).remove([path])
    if (error) throw error
  }

  publicLogoUrl(path: string): string {
    return this.supabase.storage.from(STORE_LOGOS_BUCKET).getPublicUrl(path).data.publicUrl
  }
}
