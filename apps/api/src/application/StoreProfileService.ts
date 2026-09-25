import type {
  StoreProfileChanges,
  SupabaseStoreProfileRepository,
} from "../infrastructure/supabase/repositories/SupabaseStoreProfileRepository.js"

export const LOGO_MAX_BYTES = 2 * 1024 * 1024

const LOGO_EXTENSION_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
}

export const isAllowedLogoType = (mimeType: string): boolean => mimeType in LOGO_EXTENSION_BY_MIME

export interface StoreProfile {
  id: string
  name: string
  adminName: string | null
  contactEmail: string | null
  /** URL pública del logo, o null si la tienda no tiene logo. */
  logoUrl: string | null
  updatedAt: string
}

export class StoreLogoRejectedError extends Error {
  readonly code = "store_logo_rejected"
}

/** Caso de uso: Configuración de la tienda (nombre, administrador, correo y logo). */
export class StoreProfileService {
  constructor(private readonly repository: SupabaseStoreProfileRepository) {}

  async get(storeId: string): Promise<StoreProfile> {
    const record = await this.repository.find(storeId)
    if (record === null) throw new Error("La tienda ya no existe.")
    return {
      id: record.id,
      name: record.name,
      adminName: record.adminName,
      contactEmail: record.contactEmail,
      logoUrl: record.logoPath === null ? null : this.repository.publicLogoUrl(record.logoPath),
      updatedAt: record.updatedAt,
    }
  }

  async update(storeId: string, changes: StoreProfileChanges): Promise<StoreProfile> {
    await this.repository.update(storeId, changes)
    return this.get(storeId)
  }

  /** Sube el logo nuevo a {storeId}/ y borra el anterior. Nombre con fecha para que el navegador no muestre el viejo. */
  async replaceLogo(storeId: string, file: { buffer: Buffer; mimeType: string; size: number }): Promise<StoreProfile> {
    const extension = LOGO_EXTENSION_BY_MIME[file.mimeType]
    if (extension === undefined) throw new StoreLogoRejectedError("El logo debe ser PNG, JPG o WebP.")
    if (file.size > LOGO_MAX_BYTES) throw new StoreLogoRejectedError("El logo pesa más de 2 MB.")

    const previous = await this.repository.find(storeId)
    const path = `${storeId}/logo-${Date.now()}.${extension}`
    await this.repository.uploadLogo(path, file.buffer, file.mimeType)
    await this.repository.setLogoPath(storeId, path)
    if (previous?.logoPath) await this.repository.removeLogo(previous.logoPath).catch(() => undefined)
    return this.get(storeId)
  }

  async removeLogo(storeId: string): Promise<StoreProfile> {
    const previous = await this.repository.find(storeId)
    await this.repository.setLogoPath(storeId, null)
    if (previous?.logoPath) await this.repository.removeLogo(previous.logoPath).catch(() => undefined)
    return this.get(storeId)
  }
}
