import { Money, SupplierSchedule } from "@agente-pedidos/order-agent"
import type { Supplier, VisitFrequency, Weekday } from "@agente-pedidos/order-agent"
import type { SupabaseSupplierRepository } from "../infrastructure/supabase/repositories/SupabaseSupplierRepository.js"

export interface SupplierScheduleInput {
  orderWeekday: number
  deliveryWeekday: number
  visitFrequency: "weekly" | "biweekly"
  /** Obligatoria si es quincenal; debe caer en orderWeekday (la valida SupplierSchedule). */
  biweeklyAnchorDate?: string | null
}

export interface UpdateSupplierInput {
  name?: string
  taxId?: string | null
  contactEmail?: string | null
  schedule?: SupplierScheduleInput | null
  minimumOrderAmount?: number | null
  /** Tope por pedido; null = sin tope. */
  maximumOrderAmount?: number | null
  settingsAreEstimated?: boolean
}

/** Caso de uso: escribir el calendario del proveedor y sus ajustes (paso 1 y HU2). */
export class SupplierSettingsService {
  constructor(private readonly supplierRepository: SupabaseSupplierRepository) {}

  async update(storeId: string, supplierId: string, changes: UpdateSupplierInput): Promise<Supplier> {
    const supplier = await this.supplierRepository.findById(storeId, supplierId)
    if (supplier === null) throw new Error(`El proveedor ${supplierId} no existe en esta tienda.`)

    const nextSchedule = changes.schedule === undefined ? undefined : buildSchedule(changes.schedule)
    supplier.updateSettings({
      schedule: nextSchedule,
      minimumOrderAmount: changes.minimumOrderAmount === undefined ? undefined : Money.fromPesos(changes.minimumOrderAmount ?? 0),
      maximumOrderAmount:
        changes.maximumOrderAmount === undefined
          ? undefined
          : changes.maximumOrderAmount === null
            ? null
            : Money.fromPesos(changes.maximumOrderAmount),
      isEstimated: changes.settingsAreEstimated,
    })
    await this.supplierRepository.save(storeId, supplier)
    if (changes.name !== undefined || changes.taxId !== undefined || changes.contactEmail !== undefined) {
      await this.supplierRepository.saveIdentity(storeId, supplier.id, {
        name: changes.name ?? supplier.name,
        taxId: changes.taxId === undefined ? supplier.taxId : changes.taxId,
        contactEmail: changes.contactEmail === undefined ? supplier.contactEmail : changes.contactEmail,
      })
    }
    return supplier
  }
}

const buildSchedule = (input: SupplierScheduleInput | null): SupplierSchedule | null => {
  if (input === null) return null
  const anchor = input.biweeklyAnchorDate === null || input.biweeklyAnchorDate === undefined ? null : parseLocalDate(input.biweeklyAnchorDate)
  return new SupplierSchedule(
    input.orderWeekday as Weekday,
    input.deliveryWeekday as Weekday,
    input.visitFrequency as VisitFrequency,
    anchor,
  )
}

const parseLocalDate = (value: string): Date => {
  const [year, month, day] = value.split("-").map(Number)
  const date = new Date(year ?? 0, (month ?? 1) - 1, day ?? 1)
  if (Number.isNaN(date.getTime())) throw new Error(`Fecha inválida: ${value}`)
  return date
}