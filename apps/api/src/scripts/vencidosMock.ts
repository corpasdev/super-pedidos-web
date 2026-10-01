/**
 * Vencidos para cambio de prueba: 4 productos reales de proveedores con visita activa, anotados
 * como vencidos en días recientes (con el mismo servicio que usa la web al anotarlos).
 *
 *   npm run mock:vencidos --workspace apps/api              # anota 4 vencidos de prueba
 *   npm run mock:vencidos --workspace apps/api -- --quitar  # quita solo los que anotó este script
 *
 * Los ids de los vencidos de prueba se guardan en data/mock/.vencidos-prueba.json (no se sube a git),
 * así «--quitar» nunca toca los que anotó el dueño.
 */
import "dotenv/config"
import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Container } from "../container.js"
import { loadEnvironment } from "../infrastructure/config/environment.js"

const REGISTRY = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../data/mock/.vencidos-prueba.json")

const env = loadEnvironment()
const container = new Container({ supabaseUrl: env.supabaseUrl, supabaseSecretKey: env.supabaseSecretKey })
const db = container.supabase

const { data: store, error: storeError } = await db.from("stores").select("id").limit(1).single()
if (storeError) throw storeError

const saved: string[] = existsSync(REGISTRY) ? (JSON.parse(readFileSync(REGISTRY, "utf8")) as string[]) : []

if (process.argv.includes("--quitar")) {
  for (const id of saved) await container.expiredExchangeService.remove(store.id, id)
  writeFileSync(REGISTRY, "[]\n")
  console.log(`Vencidos de prueba quitados: ${saved.length}`)
  process.exit(0)
}

// Proveedores con visita activa (los del calendario) y, de cada uno, productos perecederos o de alta rotación.
const { data: visits, error: visitsError } = await db.from("supplier_sellers").select("supplier_id").eq("store_id", store.id).eq("is_active", true)
if (visitsError) throw visitsError
const supplierIds = [...new Set((visits ?? []).map((visit) => visit.supplier_id))]

const { data: products, error: productsError } = await db
  .from("products")
  .select("id, name, category, supplier_id")
  .eq("store_id", store.id)
  .in("supplier_id", supplierIds)
  .in("category", ["lacteos", "abarrotes", "dulceria", "bebidas"])
  .order("name")
if (productsError) throw productsError

/** Lo que de verdad se vence en una tienda: pan, ponqué, lácteos, galletas, arepas, ponquecitos. */
const PERISHABLE = /pan |pan$|ponque|tajad|tostad|mogolla|yogo|yogurt|kumis|leche|queso|arepa|galleta|chocorramo|gala |bimbolete|chocoso/i

// Un perecedero de cada uno de 4 proveedores distintos, para que se vea de varios.
const picked = new Map<string, { id: string; name: string }>()
for (const product of products ?? []) {
  if (product.supplier_id && PERISHABLE.test(product.name) && !/caf[eé]/i.test(product.name) && !picked.has(product.supplier_id) && picked.size < 4) {
    picked.set(product.supplier_id, product)
  }
}

const units = [3, 2, 6, 1]
const created: string[] = []
let index = 0
for (const product of picked.values()) {
  const exchange = await container.expiredExchangeService.add(store.id, { productId: product.id, units: units[index] ?? 1 })
  // Anotados en días recientes (hace 1 a 4 días), como si se hubieran encontrado en la semana.
  const createdAt = new Date(Date.now() - (index + 1) * 86_400_000).toISOString()
  await db.from("expired_exchanges").update({ created_at: createdAt }).eq("id", exchange.id)
  created.push(exchange.id)
  console.log(`  ${exchange.productName} · ${exchange.units} u · ${exchange.supplierName ?? "sin proveedor"}`)
  index += 1
}
writeFileSync(REGISTRY, `${JSON.stringify([...saved, ...created], null, 2)}\n`)
console.log(`Vencidos de prueba anotados: ${created.length}. Se quitan con --quitar.`)
