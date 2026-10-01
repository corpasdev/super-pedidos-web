import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"
import type { DailySale } from "@agente-pedidos/order-agent"

const CHUNK = 200
const PAGE = 1000

const chunked = <Item>(items: readonly Item[], size: number): Item[][] =>
  Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size))

/** Día de la tienda (Colombia) de un instante ISO: YYYY-MM-DD. */
const storeDayOf = (iso: string): string => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(new Date(iso))

/** Ventas por día (para CM) y fecha de la última entrega de cada producto. */
export class SupabaseSalesDailyRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /** Guarda las ventas del Excel por día. Los días ya cargados se reemplazan (no se suman dos veces). */
  async upsert(storeId: string, reportId: string, sales: readonly DailySale[]): Promise<void> {
    for (const chunk of chunked(sales, CHUNK)) {
      const { error } = await this.supabase.from("sales_daily").upsert(
        chunk.map((sale) => ({
          store_id: storeId,
          barcode: sale.barcode,
          sold_on: sale.soldOn,
          units_sold: sale.units,
          sales_report_id: reportId,
        })),
        { onConflict: "store_id,barcode,sold_on" },
      )
      if (error) throw error
    }
  }

  async listForBarcodes(storeId: string, barcodes: readonly string[]): Promise<DailySale[]> {
    const sales: DailySale[] = []
    for (const chunk of chunked(barcodes, CHUNK)) {
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await this.supabase
          .from("sales_daily")
          .select("barcode, sold_on, units_sold")
          .eq("store_id", storeId)
          .in("barcode", chunk)
          .order("sold_on")
          .range(from, from + PAGE - 1)
        if (error) throw error
        for (const row of data ?? []) sales.push({ barcode: row.barcode, soldOn: row.sold_on, units: Number(row.units_sold) })
        if ((data ?? []).length < PAGE) break
      }
    }
    return sales
  }

  /** Día (hora de Colombia) de la última entrega recibida de cada producto, por su id. */
  async lastDeliveryDayByProductId(storeId: string, productIds: readonly string[]): Promise<Map<string, string>> {
    const lastDay = new Map<string, string>()
    for (const chunk of chunked(productIds, CHUNK)) {
      const { data, error } = await this.supabase
        .from("purchase_order_lines")
        .select("product_id, purchase_orders!inner(received_at)")
        .eq("store_id", storeId)
        .in("product_id", chunk)
        .not("purchase_orders.received_at", "is", null)
      if (error) throw error
      for (const row of data ?? []) {
        const receivedAt = (row as unknown as { purchase_orders: { received_at: string | null } }).purchase_orders.received_at
        if (receivedAt === null) continue
        const day = storeDayOf(receivedAt)
        const current = lastDay.get(row.product_id)
        if (current === undefined || day > current) lastDay.set(row.product_id, day)
      }
    }
    return lastDay
  }
}
