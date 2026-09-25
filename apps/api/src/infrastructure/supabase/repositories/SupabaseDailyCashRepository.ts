import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"

export interface StoreDayBounds {
  /** YYYY-MM-DD en la hora de la tienda. */
  cashDate: string
  startsAt: string
  endsAt: string
}

export class SupabaseDailyCashRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  async findOpeningAmount(storeId: string, cashDate: string): Promise<number | null> {
    const { data, error } = await this.supabase
      .from("daily_cash")
      .select("opening_amount")
      .eq("store_id", storeId)
      .eq("cash_date", cashDate)
      .maybeSingle()
    if (error) throw error
    return data?.opening_amount ?? null
  }

  async saveOpeningAmount(storeId: string, cashDate: string, openingAmount: number): Promise<void> {
    const { error } = await this.supabase.from("daily_cash").upsert(
      {
        store_id: storeId,
        cash_date: cashDate,
        opening_amount: openingAmount,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "store_id,cash_date" },
    )
    if (error) throw error
  }

  /** Σ total de los pedidos confirmados (o ya recibidos) creados ese día. */
  async sumOrdersPlaced(storeId: string, day: StoreDayBounds): Promise<number> {
    const { data, error } = await this.supabase
      .from("purchase_orders")
      .select("total_cost")
      .eq("store_id", storeId)
      .gte("created_at", day.startsAt)
      .lt("created_at", day.endsAt)
    if (error) throw error
    return (data ?? []).reduce((total, row) => total + row.total_cost, 0)
  }
}
