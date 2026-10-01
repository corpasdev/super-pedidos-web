import {
  ReplenishmentMode,
  addDaysToDay,
  arrivalsDueOn,
  isoWeekdayOfDay,
  debtsBySupplier,
  debtReserveFor,
  pendingInvoicesBySupplier,
  deliversSameDay,
  expectedDeliveryDay,
  orderOfSupplierOn,
  visitsOnDay,
  type BudgetTier,
  type InboxOrder,
  type PendingInvoice,
  type SellerVisit,
} from "@agente-pedidos/order-agent"

/** ISO: domingo. Los proveedores vienen de lunes a sábado. */
const SUNDAY = 7

/** Cuántos pedidos listos se calculan a la vez. */
const CONCURRENCY = 4
import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@agente-pedidos/database-types"
import type { SupabaseSellerRepository } from "../infrastructure/supabase/repositories/SupabaseSellerRepository.js"
import type { DailyCash, DailyCashService } from "./DailyCashService.js"
import { storeDayOf } from "./DailyCashService.js"
import type { OrderSuggestionService } from "./OrderSuggestionService.js"

/** Resumen del pedido que el agente dejó listo para un vendedor. */
export interface ReadyOrderSummary {
  totalCost: number
  productCount: number
  budgetTier: BudgetTier | null
  belowBaseCount: number
  /** Plata que le tocó de la caja del día (null = caja sin abrir: solo el tope del proveedor). */
  cashShare: number | null
}

export interface InboxVendor {
  sellerId: string
  sellerName: string | null
  supplierId: string
  supplierName: string
  /** WhatsApp del proveedor para enviarle el pedido (null si no lo tiene). */
  whatsappNumber: string | null
  deliversSameDay: boolean
  /** YYYY-MM-DD en que llega si se pide hoy. */
  expectedDeliveryDay: string
  /** Pedido ya hecho hoy a este proveedor (confirmado o recibido); null si falta. */
  orderToday: { id: string; status: "confirmed" | "received"; totalCost: number; pendingAmount: number } | null
  /** Pedido listo del agente; null si ya se hizo el de hoy o no se pudo calcular. */
  ready: ReadyOrderSummary | null
  readyError: string | null
}

export interface InboxArrival {
  orderId: string
  supplierId: string
  supplierName: string
  totalCost: number
  orderDay: string
  expectedDeliveryDay: string
}

export interface InboxDebt {
  supplierId: string
  supplierName: string
  amount: number
  /** Facturas con saldo, de la más vieja a la más reciente. */
  invoices: PendingInvoice[]
}

/** Un día de los próximos: cuántos proveedores vienen (para los tags de la bandeja). */
export interface InboxDay {
  day: string
  isToday: boolean
  vendorCount: number
}

export interface Inbox {
  /** Día cuyos proveedores se muestran (hoy o uno de los próximos). */
  day: string
  /** Hoy en la tienda (la caja, las llegadas y las deudas son siempre de hoy). */
  today: string
  cash: DailyCash
  /** Plata de la caja apartada para pagar lo que se les debe a los proveedores del día. */
  debtReserve: number
  vendors: InboxVendor[]
  arrivals: InboxArrival[]
  debts: InboxDebt[]
}

type OrderRow = Pick<
  Database["public"]["Tables"]["purchase_orders"]["Row"],
  "id" | "supplier_id" | "status" | "total_cost" | "pending_amount" | "created_at" | "expected_delivery_date"
>

const toInboxOrder = (row: OrderRow): InboxOrder => ({
  id: row.id,
  supplierId: row.supplier_id,
  status: row.status as "confirmed" | "received",
  totalCost: row.total_cost,
  pendingAmount: row.pending_amount,
  orderDay: storeDayOf(new Date(row.created_at)).cashDate,
  expectedDeliveryDay: row.expected_delivery_date,
})

/**
 * Caso de uso: la bandeja del día. Lee Supabase (borde de efectos) y arma la bandeja con funciones puras:
 * vendedores que vienen hoy (visitsOnDay), llegadas (arrivalsDueOn) y deudas por distribuidor (debtsBySupplier).
 * Para cada vendedor sin pedido hoy, corre el agente y trae el resumen del pedido listo.
 */
export class InboxService {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly sellerRepository: SupabaseSellerRepository,
    private readonly dailyCashService: DailyCashService,
    private readonly orderSuggestionService: OrderSuggestionService,
  ) {}

  /**
   * Bandeja de un día: por defecto hoy; con `requestedDay` (YYYY-MM-DD), los proveedores de ese día.
   * La caja, las llegadas y las deudas siempre son las de hoy.
   */
  async today(storeId: string, now = new Date(), requestedDay?: string): Promise<Inbox> {
    const today = storeDayOf(now).cashDate
    const day = requestedDay ?? today
    const [cash, sellers, supplierNames, orders] = await Promise.all([
      this.dailyCashService.today(storeId, now),
      this.sellerRepository.listActive(storeId),
      this.supplierNames(storeId),
      this.ordersToWatch(storeId),
    ])
    const nameOf = (supplierId: string): string => supplierNames.get(supplierId)?.name ?? "Proveedor"

    // La caja es una sola para todo el día. Primero se aparta lo que se les debe a los proveedores que vienen
    // (se les paga cuando llegan); con el resto, cada pedido sale de lo que quedó después de los anteriores.
    const visitsToday = visitsOnDay(day)(sellers)
    const debtReserve =
      cash.remainingAmount === null
        ? 0
        : Math.min(cash.remainingAmount, debtReserveFor(new Set(visitsToday.map((visit) => visit.supplierId)), today)(orders))
    let cashLeft = cash.remainingAmount === null ? null : cash.remainingAmount - debtReserve

    const buildVendor = async (visit: SellerVisit): Promise<InboxVendor> => {
      const existing = orderOfSupplierOn(day)(visit.supplierId)(orders)
      const ready = existing === null ? await this.readySummary(storeId, visit.supplierId, cashLeft) : { summary: null, error: null }
      if (cashLeft !== null && ready.summary !== null) cashLeft = Math.max(0, cashLeft - ready.summary.totalCost)
      return {
        sellerId: visit.id,
        sellerName: visit.sellerName,
        supplierId: visit.supplierId,
        supplierName: nameOf(visit.supplierId),
        whatsappNumber: supplierNames.get(visit.supplierId)?.whatsappNumber ?? null,
        deliversSameDay: deliversSameDay(visit),
        expectedDeliveryDay: expectedDeliveryDay(visit)(day),
        orderToday:
          existing === null
            ? null
            : { id: existing.id, status: existing.status, totalCost: existing.totalCost, pendingAmount: existing.pendingAmount },
        ready: ready.summary,
        readyError: ready.error,
      }
    }

    // El agente corre para cada vendedor sin pedido hoy, uno tras otro: con caja abierta, cada uno
    // necesita saber cuánto dejó el anterior. Sin caja, no hay reparto y se calculan de a 4 a la vez.
    const vendors: InboxVendor[] = []
    const batch = cashLeft === null ? CONCURRENCY : 1
    for (let start = 0; start < visitsToday.length; start += batch) {
      vendors.push(...(await Promise.all(visitsToday.slice(start, start + batch).map(buildVendor))))
    }

    const arrivals = arrivalsDueOn(today)(orders).map((order) => ({
      orderId: order.id,
      supplierId: order.supplierId,
      supplierName: nameOf(order.supplierId),
      totalCost: order.totalCost,
      orderDay: order.orderDay,
      expectedDeliveryDay: order.expectedDeliveryDay!,
    }))

    const invoices = pendingInvoicesBySupplier(orders)
    const debts = [...debtsBySupplier(orders).entries()]
      .map(([supplierId, amount]) => ({ supplierId, supplierName: nameOf(supplierId), amount, invoices: [...(invoices.get(supplierId) ?? [])] }))
      .sort((left, right) => right.amount - left.amount)

    return {
      day,
      today,
      cash,
      debtReserve,
      // Primero los que faltan por pedir.
      vendors: vendors.sort((left, right) => Number(left.orderToday !== null) - Number(right.orderToday !== null)),
      arrivals,
      debts,
    }
  }

  /**
   * Próximos 7 días (desde hoy) con cuántos proveedores vienen cada uno. Sin domingos: los proveedores
   * vienen de lunes a sábado, así que ese día no hay pedidos. No corre el agente: solo el calendario.
   */
  async upcomingDays(storeId: string, now = new Date(), count = 7): Promise<InboxDay[]> {
    const today = storeDayOf(now).cashDate
    const sellers = await this.sellerRepository.listActive(storeId)
    return Array.from({ length: count }, (_, offset) => addDaysToDay(offset)(today))
      .filter((day) => isoWeekdayOfDay(day) !== SUNDAY)
      .map((day) => ({
        day,
        isToday: day === today,
        vendorCount: new Set(visitsOnDay(day)(sellers).map((visit) => visit.supplierId)).size,
      }))
  }

  /** Pedido listo de un proveedor con la parte de la caja que le queda (`cashShare`; null = caja sin abrir). */
  private async readySummary(
    storeId: string,
    supplierId: string,
    cashShare: number | null,
  ): Promise<{ summary: ReadyOrderSummary | null; error: string | null }> {
    try {
      const { suggestion, decision } = await this.orderSuggestionService.buildSuggestion({
        storeId,
        supplierId,
        budgetPesos: cashShare,
        replenishmentMode: ReplenishmentMode.Levels,
      })
      return {
        summary: {
          totalCost: suggestion.finalOrderCost.pesos,
          productCount: suggestion.lines.filter((line) => line.finalUnits > 0).length,
          budgetTier: decision.budgetTier,
          belowBaseCount: decision.belowBaseCount,
          cashShare,
        },
        error: null,
      }
    } catch (error) {
      return { summary: null, error: error instanceof Error ? error.message : "No se pudo calcular el pedido." }
    }
  }

  private async supplierNames(storeId: string): Promise<Map<string, { name: string; whatsappNumber: string | null }>> {
    const { data, error } = await this.supabase.from("suppliers").select("id, name, whatsapp_number").eq("store_id", storeId)
    if (error) throw error
    return new Map((data ?? []).map((row) => [row.id, { name: row.name, whatsappNumber: row.whatsapp_number }]))
  }

  /** Pedidos por recibir, con saldo pendiente o hechos en los últimos días. */
  private async ordersToWatch(storeId: string): Promise<InboxOrder[]> {
    const since = new Date(Date.now() - 3 * 86_400_000).toISOString()
    const { data, error } = await this.supabase
      .from("purchase_orders")
      .select("id, supplier_id, status, total_cost, pending_amount, created_at, expected_delivery_date")
      .eq("store_id", storeId)
      .or(`status.eq.confirmed,pending_amount.gt.0,created_at.gte.${since}`)
      .order("created_at", { ascending: false })
      .limit(500)
    if (error) throw error
    return (data ?? []).map(toInboxOrder)
  }
}
