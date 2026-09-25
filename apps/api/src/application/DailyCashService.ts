import { calculateRemainingCash } from "@agente-pedidos/order-agent"
import type { StoreDayBounds, SupabaseDailyCashRepository } from "../infrastructure/supabase/repositories/SupabaseDailyCashRepository.js"

/** La tienda está en Colombia (UTC−5, sin horario de verano). */
const STORE_TIME_ZONE = "America/Bogota"
const STORE_UTC_OFFSET = "-05:00"

export interface DailyCash {
  cashDate: string
  /** null = el dueño todavía no escribió el efectivo de hoy. */
  openingAmount: number | null
  spentAmount: number
  /** null si no hay caja escrita. */
  remainingAmount: number | null
}

/** Día de la tienda que contiene `now`: fecha local y sus límites en hora de Colombia. */
export const storeDayOf = (now: Date): StoreDayBounds => {
  const cashDate = new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE }).format(now)
  const startsAt = new Date(`${cashDate}T00:00:00${STORE_UTC_OFFSET}`)
  const endsAt = new Date(startsAt.getTime() + 86_400_000)
  return { cashDate, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() }
}

/** Caso de uso: la caja del día. Cada pedido confirmado hoy se descuenta; el siguiente vendedor usa lo que quedó. */
export class DailyCashService {
  constructor(private readonly dailyCashRepository: SupabaseDailyCashRepository) {}

  async today(storeId: string, now = new Date()): Promise<DailyCash> {
    const day = storeDayOf(now)
    const [openingAmount, spentAmount] = await Promise.all([
      this.dailyCashRepository.findOpeningAmount(storeId, day.cashDate),
      this.dailyCashRepository.sumOrdersPlaced(storeId, day),
    ])
    return {
      cashDate: day.cashDate,
      openingAmount,
      spentAmount,
      remainingAmount: openingAmount === null ? null : calculateRemainingCash(openingAmount)(spentAmount),
    }
  }

  async open(storeId: string, openingAmount: number, now = new Date()): Promise<DailyCash> {
    await this.dailyCashRepository.saveOpeningAmount(storeId, storeDayOf(now).cashDate, openingAmount)
    return this.today(storeId, now)
  }
}
