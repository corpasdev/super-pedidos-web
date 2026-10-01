/**
 * Facturas pendientes de prueba para «Le debes»: pedidos ya recibidos y no pagados (o pagados en parte)
 * de proveedores reales con visita activa, en sus días de visita anteriores a hoy.
 *
 *   npm run mock:deudas --workspace apps/api              # crea 2 facturas a un proveedor y 1 a otro
 *   npm run mock:deudas --workspace apps/api -- --quitar  # quita las facturas de prueba
 *
 * Las facturas de prueba no tienen productos (purchase_order_lines): así no cambian lo vendido ni la
 * existencia que usa el agente, y se pueden reconocer para quitarlas. Un pedido real siempre tiene productos.
 */
import "dotenv/config"
import { Container } from "../container.js"
import { loadEnvironment } from "../infrastructure/config/environment.js"

const env = loadEnvironment()
const container = new Container({ supabaseUrl: env.supabaseUrl, supabaseSecretKey: env.supabaseSecretKey })
const db = container.supabase

const isoDay = (date: Date): string => date.toLocaleDateString("en-CA")
const isoWeekday = (day: string): number => ((new Date(`${day}T12:00:00`).getDay() + 6) % 7) + 1
/** Las últimas `count` fechas (antes de hoy) que caen en ese día de la semana, de la más vieja a la más reciente. */
const previousVisits = (weekday: number, count: number): string[] => {
  const days: string[] = []
  for (let back = 1; days.length < count && back <= 60; back += 1) {
    const day = isoDay(new Date(Date.now() - back * 86_400_000))
    if (isoWeekday(day) === weekday) days.push(day)
  }
  return days.reverse()
}

const { data: store, error: storeError } = await db.from("stores").select("id").limit(1).single()
if (storeError) throw storeError

/** Pedidos de prueba = pedidos sin productos. */
const mockOrderIds = async (): Promise<string[]> => {
  const { data: orders, error } = await db.from("purchase_orders").select("id").eq("store_id", store.id)
  if (error) throw error
  const ids = (orders ?? []).map((order) => order.id)
  if (ids.length === 0) return []
  const { data: lines, error: linesError } = await db.from("purchase_order_lines").select("purchase_order_id").in("purchase_order_id", ids)
  if (linesError) throw linesError
  const withLines = new Set((lines ?? []).map((line) => line.purchase_order_id))
  return ids.filter((id) => !withLines.has(id))
}

if (process.argv.includes("--quitar")) {
  const ids = await mockOrderIds()
  if (ids.length > 0) {
    const { error } = await db.from("purchase_orders").delete().in("id", ids)
    if (error) throw error
  }
  console.log(`Facturas de prueba quitadas: ${ids.length}`)
  process.exit(0)
}

// Proveedores con visita activa y más productos (los que más mueven la tienda).
const { data: visits, error: visitsError } = await db
  .from("supplier_sellers")
  .select("id, supplier_id, order_weekday, delivery_weekday, suppliers(name)")
  .eq("store_id", store.id)
  .eq("is_active", true)
if (visitsError) throw visitsError

const { data: products, error: productsError } = await db.from("products").select("supplier_id").eq("store_id", store.id)
if (productsError) throw productsError
const productCount = new Map<string, number>()
for (const product of products ?? []) if (product.supplier_id) productCount.set(product.supplier_id, (productCount.get(product.supplier_id) ?? 0) + 1)

const chosen = [...(visits ?? [])]
  .filter((visit) => (productCount.get(visit.supplier_id) ?? 0) > 0)
  .sort((left, right) => (productCount.get(right.supplier_id) ?? 0) - (productCount.get(left.supplier_id) ?? 0))
  .slice(0, 2)

// Primer proveedor: 2 facturas (la vieja sin abonar, la reciente con un abono). Segundo: 1 factura sin abonar.
const plan = [
  { visit: chosen[0], invoices: [{ total: 186_400, paid: 0 }, { total: 142_750, paid: 60_000 }] },
  { visit: chosen[1], invoices: [{ total: 97_300, paid: 0 }] },
].filter((item) => item.visit !== undefined)

for (const { visit, invoices } of plan) {
  const days = previousVisits(visit!.order_weekday, invoices.length)
  for (const [index, invoice] of invoices.entries()) {
    const day = days[index]!
    const deliveryOffset = (visit!.delivery_weekday - visit!.order_weekday + 7) % 7
    const delivery = isoDay(new Date(Date.parse(`${day}T12:00:00`) + deliveryOffset * 86_400_000))
    const { error } = await db.from("purchase_orders").insert({
      store_id: store.id,
      supplier_id: visit!.supplier_id,
      seller_id: visit!.id,
      status: "received",
      total_cost: invoice.total,
      maximum_order_cost: invoice.total,
      paid_amount: invoice.paid,
      created_at: `${day}T15:00:00.000Z`,
      expected_delivery_date: delivery,
      received_at: `${delivery}T16:00:00.000Z`,
    })
    if (error) throw error
    const name = (visit!.suppliers as { name: string } | null)?.name ?? visit!.supplier_id
    console.log(`  ${name}: factura del ${day} por ${invoice.total} · saldo ${invoice.total - invoice.paid}`)
  }
}
console.log("Facturas de prueba creadas. Se quitan con --quitar.")
