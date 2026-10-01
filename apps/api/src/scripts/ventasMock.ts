/**
 * Excel de ventas de prueba (data/mock/ventas-mock.xlsx) armado con los productos de las tablas de
 * Supabase, para que el agente calcule los sugeridos con la API real.
 *
 *   npm run mock:ventas --workspace apps/api                         # Excel de la semana pasada (7 días hasta ayer)
 *   npm run mock:ventas --workspace apps/api -- --para 2026-10-05    # la semana anterior a ese día de pedido
 *   npm run mock:ventas --workspace apps/api -- --hasta 2026-09-30   # 7 días que terminan en esa fecha
 *   npm run mock:ventas --workspace apps/api -- --cargar             # además lo carga, igual que subirlo en la web
 *   ... --cargar --reemplazar                                         # antes quita los Excel de prueba ya cargados
 *
 * El archivo queda en data/mock/ventas-semana-<desde>-al-<hasta>.xlsx (mismo formato del software de la tienda).
 *
 * Solo usa las tablas: proveedores con visita activa (supplier_sellers), sus productos (products) y
 * los niveles y costos de cada uno (product_settings). Las cantidades vendidas son inventadas, pero
 * salen de los niveles: cada producto vende entre 0,3 y 1,9 veces lo que cabe entre su base y su
 * punto de pedido, así unos quedan sobre la base y otros por debajo (urgentes).
 */
import "dotenv/config"
import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Container } from "../container.js"
import { loadEnvironment } from "../infrastructure/config/environment.js"
import { writeXlsx } from "./xlsxWriter.js"

const MOCK_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../data/mock")
/** Los Excel de prueba se reconocen por el nombre (para poder quitarlos sin tocar los reales). */
const MOCK_PREFIXES = ["ventas-semana-", "ventas-mock"]
/** Parte de los productos que se vendió en la semana (los demás no se movieron). */
const SOLD_SHARE = 0.7

const argValue = (name: string): string | null => {
  const index = process.argv.indexOf(name)
  return index >= 0 ? (process.argv[index + 1] ?? null) : null
}

const isoDay = (date: Date): string => date.toISOString().slice(0, 10)
const addDays = (day: string, days: number): string => isoDay(new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000))
const yesterday = (): string => addDays(new Date().toLocaleDateString("en-CA"), -1)

const forDay = argValue("--para")
const until = argValue("--hasta") ?? (forDay !== null ? addDays(forDay, -1) : yesterday())
if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new Error(`Fecha inválida: ${until} (usa AAAA-MM-DD)`)
const from = addDays(until, -6)
const FILE_NAME = `ventas-semana-${from}-al-${until}.xlsx`
const OUTPUT = resolve(MOCK_DIR, FILE_NAME)

/** Azar con semilla: la misma fecha da el mismo Excel. */
const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const random = seeded(Number(until.replace(/-/g, "")))

/** Costo con el que se vende en el Excel: el de la tabla o, si no hay, el estimado por categoría del dueño. */
const purchaseCost = (unitCost: number, salePrice: number, category: string): number =>
  unitCost > 0 ? unitCost : Math.round(salePrice / (category.toLowerCase() === "dulceria" ? 1.3 : 1.2))

const env = loadEnvironment()
const container = new Container({ supabaseUrl: env.supabaseUrl, supabaseSecretKey: env.supabaseSecretKey })
const db = container.supabase

const { data: store, error: storeError } = await db.from("stores").select("id").limit(1).single()
if (storeError) throw storeError

const { data: visits, error: visitsError } = await db
  .from("supplier_sellers")
  .select("supplier_id")
  .eq("store_id", store.id)
  .eq("is_active", true)
if (visitsError) throw visitsError
const supplierIds = [...new Set((visits ?? []).map((visit) => visit.supplier_id))]

const { data: products, error: productsError } = await db
  .from("products")
  .select("id, barcode, name, category, sale_price, product_settings(unit_cost, min_stock_units, reorder_point_units)")
  .eq("store_id", store.id)
  .in("supplier_id", supplierIds)
  .order("name")
if (productsError) throw productsError

interface Sale {
  barcode: string
  category: string
  name: string
  quantity: number
  cost: number
  price: number
  day: string
}

const sales: Sale[] = []
for (const product of products ?? []) {
  const settings = Array.isArray(product.product_settings) ? product.product_settings[0] : product.product_settings
  const base = settings?.min_stock_units ?? null
  const reorderPoint = settings?.reorder_point_units ?? null
  if (base === null || reorderPoint === null || product.sale_price <= 0 || random() > SOLD_SHARE) continue
  const weekly = Math.max(1, Math.round((reorderPoint - base) * (0.3 + random() * 1.6)))
  const cost = purchaseCost(settings?.unit_cost ?? 0, product.sale_price, product.category)
  // Se reparte la semana en ventas de 1 a 3 unidades.
  for (let left = weekly; left > 0; ) {
    const quantity = Math.min(left, 1 + Math.floor(random() * 3))
    sales.push({
      barcode: product.barcode,
      category: product.category,
      name: product.name,
      quantity,
      cost,
      price: product.sale_price,
      day: addDays(from, Math.floor(random() * 7)),
    })
    left -= quantity
  }
}

const pad = (n: number) => String(n).padStart(2, "0")
const rows = sales
  .map((sale) => ({ ...sale, time: `${pad(7 + Math.floor(random() * 13))}:${pad(Math.floor(random() * 60))}:${pad(Math.floor(random() * 60))}` }))
  .sort((a, b) => `${b.day} ${b.time}`.localeCompare(`${a.day} ${a.time}`))

const HEADER = [
  "ID", "FECHA", "RECIBO", "TERMINAL", "COD. BARRA", "CATEGORIA", "PRODUCTO", "CANTIDAD", "PRECIO COMPRA", "PVP",
  "PRECIO VENTA", "CLIENTE", "CAJERO", "COMISION", "MEDIO PAGO", "TOTAL VENTA + IMP", "TOTAL VENTA", "UTILIDAD",
]
const sheet: (string | null)[][] = [
  HEADER,
  ...rows.map((row, index) => [
    String(index + 1), `${row.day} ${row.time}`, String(30000 + rows.length - index), null, row.barcode, row.category, row.name,
    String(row.quantity), String(row.cost), String(row.price), String(row.price), null, "cajero de prueba", "0", "EFECTIVO",
    String(row.price * row.quantity), String(row.price * row.quantity), String((row.price - row.cost) * row.quantity),
  ]),
]

const buffer = writeXlsx("Informe", sheet)
mkdirSync(dirname(OUTPUT), { recursive: true })
writeFileSync(OUTPUT, buffer)
const units = sales.reduce((sum, sale) => sum + sale.quantity, 0)
const soldProducts = new Set(sales.map((sale) => sale.barcode)).size
console.log(`${FILE_NAME}: ventas del ${from} al ${until} · ${rows.length} filas · ${units} unidades · ${soldProducts} de ${(products ?? []).length} productos`)
console.log(`  proveedores con visita activa: ${supplierIds.length}`)

if (process.argv.includes("--cargar")) {
  if (process.argv.includes("--reemplazar")) {
    const reports = await container.salesReportRepository.listAll(store.id)
    for (const report of reports.filter((item) => MOCK_PREFIXES.some((prefix) => item.fileName.startsWith(prefix)))) {
      await container.salesReportImportService.remove(store.id, report.id)
      console.log(`  quitado el Excel de prueba anterior: ${report.fileName}`)
    }
  }
  const result = await container.salesReportImportService.import(store.id, { buffer, originalName: FILE_NAME })
  console.log(`  cargado como Excel de ventas (${result.report.lines.length} productos; sin producto en el catálogo: ${result.unmatchedSales.length})`)
}
