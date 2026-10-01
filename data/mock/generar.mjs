/**
 * Genera el mock de la vista «Sugeridos»: un Excel de ventas con el mismo formato que el modelo
 * (data/ventas-16-al-23-sept.xlsx) y las respuestas de la API que usa la vista.
 *
 * Uso (desde la raíz del proyecto):
 *   npm run build --workspace packages/order-agent   # una vez, para usar el motor real del sugerido
 *   node data/mock/generar.mjs                       # hoy = próximo lunes
 *   node data/mock/generar.mjs 2026-10-05            # hoy = esa fecha (debería ser lunes)
 *
 * Todo es determinista (semilla fija): correrlo dos veces con la misma fecha da los mismos archivos.
 * Los productos, proveedores, precios, costos y niveles B/PD/T son los de Supabase (productos-supabase.json);
 * la rotación parte del Excel modelo. Las ventas de la semana, los vendedores, la caja y las deudas son inventados.
 */
/* global Buffer, process, console -- script de Node */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { crc32 } from "node:zlib"
import readXlsxFile from "read-excel-file/node"
import { planSuggestion, resolveOrderStatus } from "../../packages/order-agent/dist/index.js"

const here = dirname(fileURLToPath(import.meta.url))

// ───────────────────────── Fechas ─────────────────────────
const isoDay = (date) => date.toISOString().slice(0, 10)
const addDays = (day, days) => isoDay(new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000))
const isoWeekday = (day) => ((new Date(`${day}T00:00:00Z`).getUTCDay() + 6) % 7) + 1

const nextMonday = () => {
  const today = new Date().toLocaleDateString("en-CA")
  return addDays(today, (8 - isoWeekday(today)) % 7)
}
const TODAY = process.argv[2] ?? nextMonday()
if (!/^\d{4}-\d{2}-\d{2}$/.test(TODAY)) throw new Error(`Fecha inválida: ${TODAY} (usa AAAA-MM-DD)`)
/** La última entrega de los proveedores del lunes fue hace una semana: CM = ventas de esos 7 días. */
const PERIOD_START = addDays(TODAY, -7)

// ───────────────────────── Azar con semilla ─────────────────────────
const mulberry32 = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const random = mulberry32(20260927)
const pick = (list) => list[Math.floor(random() * list.length)]

// ───────────────────────── Proveedores del lunes (calendario real) ─────────────────────────
// deliveryWeekday: 1 = entrega el mismo lunes; 2 martes; 3 miércoles; 4 jueves.
// Los productos de cada proveedor salen de Supabase (productos-supabase.json). CENNECA y AREPAS GERMAN
// aún no tienen productos asignados en la base: se les dan unos códigos a mano (`barcodes`).
const SUPPLIERS = [
  { id: "sup-postobon", name: "POSTOBON", seller: "Jhon Ramírez", deliveryWeekday: 3 },
  { id: "sup-cocacola", name: "COCACOLA DISTRIBUCIONES", seller: "Andrea Gómez", deliveryWeekday: 2 },
  { id: "sup-ramo", name: "RAMO", seller: null, deliveryWeekday: 2 },
  { id: "sup-bimbo", name: "BIMBO DISTRIVENTAS DEL SUR", seller: "Luis Herrera", deliveryWeekday: 4 },
  { id: "sup-guadalupe", name: "GUADALUPE ARDICOLL", seller: "Marta Rojas", deliveryWeekday: 3 },
  {
    id: "sup-cenneca", name: "CENNECA", seller: null, deliveryWeekday: 3,
    barcodes: ["7702001047161", "7702001047178", "7702001171057"],
  },
  { id: "sup-colombina", name: "COLOMBINA DISTRIBUCIONES", seller: "Pedro Castillo", deliveryWeekday: 1 },
  // Ya se les hizo el pedido hoy (entregan el mismo día): no tienen sugerido, solo estado.
  {
    id: "sup-md", name: "MD DISTRIBUCIONES", seller: "Carlos Díaz", deliveryWeekday: 1,
    orderToday: { status: "received", totalCost: 95_400, pendingAmount: 0 },
  },
  {
    id: "sup-arepas-german", name: "AREPAS GERMAN", seller: "Germán", deliveryWeekday: 1,
    orderToday: { status: "received", totalCost: 38_000, pendingAmount: 18_000 },
    barcodes: ["67", "37", "161"],
  },
]

/** Cuántos productos del proveedor entran al mock (los que más rotan), para que el panel sea legible. */
const MAX_PRODUCTS_PER_SUPPLIER = 10

// ───────────────────────── Caja y deudas ─────────────────────────
const MAX_ORDER = 250_000
const OPENING_CASH = 450_000
const spentToday = SUPPLIERS.reduce((sum, s) => sum + (s.orderToday?.totalCost ?? 0), 0)
const remainingCash = Math.max(0, OPENING_CASH - spentToday)

/** Deudas: incluye una de un proveedor que no viene hoy (ALPINA), que la vista debe ocultar. */
const DEBTS = [
  { supplierId: "sup-postobon", supplierName: "POSTOBON", amount: 120_000 },
  { supplierId: "sup-arepas-german", supplierName: "AREPAS GERMAN", amount: 18_000 },
  { supplierId: "sup-alpina", supplierName: "ALPINA", amount: 45_000 },
]

// ───────────────────────── Catálogo: Supabase + rotación del Excel modelo ─────────────────────────
const snapshot = JSON.parse(readFileSync(join(here, "productos-supabase.json"), "utf8")).products

/** Unidades por semana de cada código en el Excel modelo (cubre 8 días: 16 al 23 de sept). */
const modelSheets = await readXlsxFile(readFileSync(join(here, "..", "ventas-16-al-23-sept.xlsx")))
const modelRows = (modelSheets[0]?.data ?? modelSheets).slice(1)
const modelUnits = new Map()
for (const row of modelRows) {
  const barcode = String(row[4] ?? "").trim()
  const quantity = Number(row[7])
  if (barcode && Number.isFinite(quantity) && quantity > 0) modelUnits.set(barcode, (modelUnits.get(barcode) ?? 0) + quantity)
}
const weeklyInModel = (barcode) => ((modelUnits.get(barcode) ?? 0) * 7) / 8

/**
 * Venta de la semana del mock (CM): la rotación del modelo con una variación por producto (×0,6 a ×1,9),
 * para que unos queden sobre la base, otros en la base y otros por debajo (urgentes).
 */
const weekSales = (barcode) => Math.max(1, Math.round(weeklyInModel(barcode) * (0.6 + random() * 1.3)))

const productsOf = (supplier) => {
  const own = supplier.barcodes
    ? snapshot.filter((product) => supplier.barcodes.includes(product.barcode))
    : snapshot.filter((product) => product.supplier_name.toUpperCase() === supplier.name && weeklyInModel(product.barcode) > 0)
  return [...own].sort((a, b) => weeklyInModel(b.barcode) - weeklyInModel(a.barcode)).slice(0, MAX_PRODUCTS_PER_SUPPLIER)
}

const catalog = SUPPLIERS.flatMap((supplier) =>
  productsOf(supplier).map((product) => ({
    productId: `prod-${product.barcode}`,
    supplierId: supplier.id,
    supplierName: supplier.name,
    barcode: product.barcode,
    category: product.category,
    name: product.name,
    unitCost: product.unit_cost,
    salePrice: product.sale_price,
    packSize: product.pack_size,
    weeklyUnits: weekSales(product.barcode),
    levels: { base: product.base, reorderPoint: product.reorder_point, tope: product.tope },
  })),
)

// ───────────────────────── Ventas por día (Excel) ─────────────────────────
/** Reparte las unidades de la semana entre los 7 días (lunes a domingo anteriores a hoy). */
const dailySplit = (units) => {
  const days = Array.from({ length: 7 }, () => 0)
  for (let unit = 0; unit < units; unit += 1) days[Math.floor(random() * 7)] += 1
  return days
}

const sales = catalog.flatMap((product) =>
  dailySplit(product.weeklyUnits).flatMap((units, dayIndex) => {
    const day = addDays(PERIOD_START, dayIndex)
    // Cada venta del día sale en 1 a 3 recibos.
    const lines = []
    let left = units
    while (left > 0) {
      const quantity = Math.min(left, 1 + Math.floor(random() * 3))
      lines.push({ product, day, quantity })
      left -= quantity
    }
    return lines
  }),
)

const CASHIERS = ["cajero demo", "brandon corpas"]
const pad = (n) => String(n).padStart(2, "0")
const rows = sales
  .map((sale) => ({
    ...sale,
    time: `${pad(7 + Math.floor(random() * 13))}:${pad(Math.floor(random() * 60))}:${pad(Math.floor(random() * 60))}`,
  }))
  .sort((a, b) => `${b.day} ${b.time}`.localeCompare(`${a.day} ${a.time}`))

const HEADER = [
  "ID", "FECHA", "RECIBO", "TERMINAL", "COD. BARRA", "CATEGORIA", "PRODUCTO", "CANTIDAD", "PRECIO COMPRA", "PVP",
  "PRECIO VENTA", "CLIENTE", "CAJERO", "COMISION", "MEDIO PAGO", "TOTAL VENTA + IMP", "TOTAL VENTA", "UTILIDAD",
]
const excelRows = [
  HEADER,
  ...rows.map((row, index) => {
    const { product, quantity } = row
    const total = product.salePrice * quantity
    return [
      String(index + 1), `${row.day} ${row.time}`, String(20000 + rows.length - index), null, product.barcode,
      product.category, product.name, String(quantity), String(product.unitCost), String(product.salePrice),
      String(product.salePrice), null, pick(CASHIERS), "0", "EFECTIVO", String(total), String(total),
      String((product.salePrice - product.unitCost) * quantity),
    ]
  }),
]

// ───────────────────────── Escritor .xlsx mínimo (sin dependencias) ─────────────────────────
const escapeXml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
const columnName = (index) => {
  let name = ""
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name
  return name
}
/** Como el modelo, todas las celdas van como texto. */
const sheetXml = (data) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${data
    .map(
      (row, r) =>
        `<row r="${r + 1}">${row
          .map((value, c) =>
            value === null ? "" : `<c r="${columnName(c)}${r + 1}" t="inlineStr"><is><t>${escapeXml(value)}</t></is></c>`,
          )
          .join("")}</row>`,
    )
    .join("")}</sheetData></worksheet>`

const xlsxParts = (sheetName, data) => ({
  "[Content_Types].xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
  "_rels/.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  "xl/workbook.xml": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  "xl/_rels/workbook.xml.rels": `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
  "xl/worksheets/sheet1.xml": sheetXml(data),
})

/** ZIP sin compresión (método «store»): suficiente para un .xlsx válido. */
const zip = (files) => {
  const locals = []
  const centrals = []
  let offset = 0
  for (const [name, content] of Object.entries(files)) {
    const nameBuffer = Buffer.from(name, "utf8")
    const data = Buffer.from(content, "utf8")
    const crc = crc32(data)
    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6) // nombres en UTF-8
    local.writeUInt32LE(crc, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(nameBuffer.length, 26)
    locals.push(local, nameBuffer, data)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(0x02014b50, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(0x0800, 8)
    central.writeUInt32LE(crc, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(nameBuffer.length, 28)
    central.writeUInt32LE(offset, 42)
    centrals.push(central, nameBuffer)
    offset += 30 + nameBuffer.length + data.length
  }
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(Object.keys(files).length, 8)
  end.writeUInt16LE(Object.keys(files).length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  return Buffer.concat([...locals, ...centrals, end])
}

// ───────────────────────── Sugerido por proveedor (motor real) ─────────────────────────
const budget = Math.min(remainingCash, MAX_ORDER)

const suggestionFor = (supplier) => {
  const items = catalog
    .filter((product) => product.supplierId === supplier.id)
    .map((product) => ({
      productId: product.productId,
      barcode: product.barcode,
      name: product.name,
      category: product.category,
      packSize: product.packSize,
      unitCost: product.unitCost,
      levels: product.levels,
      movedUnits: product.weeklyUnits,
    }))
  const plan = planSuggestion(budget)(items)
  const byId = new Map(catalog.map((product) => [product.productId, product]))
  const lines = plan.lines.map((line) => {
    const product = byId.get(line.productId)
    return {
      productId: line.productId,
      barcode: line.barcode,
      productName: line.name,
      category: line.category,
      brandName: supplier.name,
      packSize: line.packSize,
      unitCost: line.unitCost,
      costSource: "sales_report",
      isCostEstimated: false,
      hasNoCost: false,
      salePrice: product.salePrice,
      unitsSold: line.movedUnits,
      targetUnits: line.unitsToTope,
      suggestedMaximumUnits: line.unitsToTope,
      stockToDiscount: line.estimatedStock ?? 0,
      allocatedUnits: line.suggestedUnits,
      finalUnits: line.suggestedUnits,
      maximumLineCost: line.unitsToTope * line.unitCost,
      allocatedLineCost: line.lineCost,
      finalLineCost: line.lineCost,
      coverageRatio: line.unitsToTope === 0 ? 1 : line.suggestedUnits / line.unitsToTope,
      isCutByBudget: line.suggestedUnits < line.unitsToTope,
      isAdjustedByOwner: false,
      stockPosition: {
        base: line.levels.base,
        reorderPoint: line.levels.reorderPoint,
        tope: line.levels.tope,
        movedUnits: line.movedUnits,
        unitsAboveBase: line.unitsAboveBase,
        estimatedStock: line.estimatedStock,
        status: line.status,
        unitsToBase: line.unitsToBase,
        unitsToTope: line.unitsToTope,
        reached: line.reached,
      },
    }
  })
  const maximumOrderCost = lines.reduce((sum, line) => sum + line.maximumLineCost, 0)
  const resolved = resolveOrderStatus({
    lineCount: lines.length,
    finalOrderCost: plan.totalCost,
    availableBudget: budget,
    maximumOrderCost,
    minimumOrderAmount: 20_000,
    hasMinimumOrder: true,
    hasOwnerAdjustments: false,
  })
  const belowBaseCount = lines.filter((line) => line.stockPosition.status === "below_base").length
  return {
    suggestion: {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        orderWeekday: 1,
        deliveryWeekday: supplier.deliveryWeekday,
        minimumOrderAmount: 20_000,
        maximumOrderAmount: MAX_ORDER,
      },
      replenishmentMode: "levels",
      salesReportId: "mock-sales-report",
      availableBudget: budget,
      maximumOrderCost,
      allocatedOrderCost: plan.totalCost,
      finalOrderCost: plan.totalCost,
      remainingBudget: plan.remainingBudget ?? 0,
      status: resolved.status,
      budgetTier: plan.tier,
      estimatedCostLineCount: 0,
      noCostLineCount: 0,
      statusExplanation: resolved.explanation,
      groups: lines.length === 0 ? [] : [{ brandName: supplier.name, subtotal: plan.totalCost, lines }],
      plainText: lines.map((line) => `${line.finalUnits} x ${line.productName}`).join("\n"),
    },
    budget: {
      remainingCash,
      minimumOrderAmount: 20_000,
      maximumOrderAmount: MAX_ORDER,
      ownerBudget: null,
      orderBudget: budget,
    },
    decision: { status: resolved.status, budgetTier: plan.tier, belowBaseCount, budgetCoversMaximum: plan.tier === "tope" },
  }
}

// ───────────────────────── Respuestas de la API ─────────────────────────
const suggestions = Object.fromEntries(
  SUPPLIERS.filter((supplier) => !supplier.orderToday).map((supplier) => [supplier.id, suggestionFor(supplier)]),
)

const vendors = SUPPLIERS.map((supplier) => {
  const built = suggestions[supplier.id]
  return {
    sellerId: `seller-${supplier.id.slice(4)}`,
    sellerName: supplier.seller,
    supplierId: supplier.id,
    supplierName: supplier.name,
    deliversSameDay: supplier.deliveryWeekday === 1,
    expectedDeliveryDay: addDays(TODAY, supplier.deliveryWeekday - 1),
    orderToday: supplier.orderToday ? { id: `order-${supplier.id.slice(4)}`, ...supplier.orderToday } : null,
    ready: built
      ? {
          totalCost: built.suggestion.finalOrderCost,
          productCount: built.suggestion.groups.reduce((sum, group) => sum + group.lines.filter((l) => l.finalUnits > 0).length, 0),
          budgetTier: built.suggestion.budgetTier,
          belowBaseCount: built.decision.belowBaseCount,
        }
      : null,
    readyError: null,
  }
})

const cash = {
  cashDate: TODAY,
  openingAmount: OPENING_CASH,
  spentAmount: spentToday,
  remainingAmount: remainingCash,
  originalValue: String(OPENING_CASH),
  description: "Caja de prueba (mock)",
}

const inbox = { day: TODAY, today: TODAY, cash, vendors, arrivals: [], debts: DEBTS }

/** Lunes a sábado de la semana: solo el lunes tiene proveedores (es el único calendario cargado). */
const days = Array.from({ length: 6 }, (_, index) => {
  const day = addDays(TODAY, index)
  return { day, isToday: index === 0, vendorCount: isoWeekday(day) === 1 ? vendors.length : 0 }
})

const salesReport = {
  id: "mock-sales-report",
  fileName: "ventas-mock.xlsx",
  period: { startsAt: PERIOD_START, endsAt: addDays(TODAY, -1), coveredDays: 7 },
  coveredDaysOverride: null,
  lineCount: excelRows.length - 1,
  totalUnits: catalog.reduce((sum, product) => sum + product.weeklyUnits, 0),
}

// ───────────────────────── Catálogo completo (Productos y Proveedores) ─────────────────────────
const supplierIdByName = new Map(SUPPLIERS.map((supplier) => [supplier.name, supplier.id]))
const handpicked = new Map(SUPPLIERS.flatMap((supplier) => (supplier.barcodes ?? []).map((barcode) => [barcode, supplier])))
const catalogById = new Map(catalog.map((product) => [product.productId, product]))

/** Todos los productos de los proveedores del mock (no solo los del sugerido), como GET /products. */
const productList = snapshot
  .filter((row) => handpicked.has(row.barcode) || supplierIdByName.has(row.supplier_name.toUpperCase()))
  .map((row) => {
    const supplier = handpicked.get(row.barcode) ?? SUPPLIERS.find((item) => item.id === supplierIdByName.get(row.supplier_name.toUpperCase()))
    const id = `prod-${row.barcode}`
    const inSuggestion = catalogById.get(id)
    // Tras la entrega el producto queda en su PD; los del sugerido ya vendieron CM esta semana.
    const stockUnits = Math.max(0, (row.reorder_point ?? 0) - (inSuggestion?.weeklyUnits ?? 0))
    return {
      id,
      barcode: row.barcode,
      name: row.name,
      category: row.category,
      salePrice: row.sale_price,
      supplierId: supplier.id,
      supplierName: supplier.name,
      brandName: null,
      packSize: row.pack_size,
      unitCost: row.unit_cost,
      costSource: "sales_report",
      maxStockUnits: row.tope,
      minStockUnits: row.base,
      reorderPointUnits: row.reorder_point,
      stockUnits,
      isStockReliable: false,
      isEstimated: false,
    }
  })
  .sort((a, b) => a.name.localeCompare(b.name, "es"))

/** Proveedores como GET /suppliers: los 9 del lunes y ALPINA (sin calendario, con deuda). */
const supplierList = [
  ...SUPPLIERS.map((supplier) => ({
    id: supplier.id,
    name: supplier.name,
    taxId: null,
    contactEmail: null,
    hasSchedule: true,
    orderWeekday: 1,
    deliveryWeekday: supplier.deliveryWeekday,
    visitFrequencyDays: 7,
    deliveryLeadDays: supplier.deliveryWeekday - 1,
    nextOrderDate: TODAY,
    lastDeliveryDate: PERIOD_START,
    isVisitingToday: true,
    minimumOrderAmount: 20_000,
    maximumOrderAmount: MAX_ORDER,
    isEstimated: false,
    productCount: productList.filter((product) => product.supplierId === supplier.id).length,
    lastOrderAt: `${PERIOD_START}T10:00:00.000Z`,
  })),
  {
    id: "sup-alpina",
    name: "ALPINA",
    taxId: null,
    contactEmail: null,
    hasSchedule: false,
    orderWeekday: null,
    deliveryWeekday: null,
    visitFrequencyDays: null,
    deliveryLeadDays: 0,
    nextOrderDate: null,
    lastDeliveryDate: null,
    isVisitingToday: false,
    minimumOrderAmount: 20_000,
    maximumOrderAmount: MAX_ORDER,
    isEstimated: true,
    productCount: 0,
    lastOrderAt: null,
  },
].sort((a, b) => a.name.localeCompare(b.name, "es"))

/** Un par de vencidos ya anotados, para ver la lista llena (uno de un proveedor que viene hoy). */
const pick2 = (supplierId) => productList.find((product) => product.supplierId === supplierId)
const expiredSeed = [pick2("sup-bimbo"), pick2("sup-colombina")]
  .filter(Boolean)
  .map((product, index) => ({
    id: `mock-expired-${index + 1}`,
    productId: product.id,
    productName: product.name,
    barcode: product.barcode,
    supplierId: product.supplierId,
    supplierName: product.supplierName,
    units: index + 2,
    createdAt: `${addDays(TODAY, -2)}T09:00:00.000Z`,
  }))

// ───────────────────────── Escritura ─────────────────────────
const json = (value) => `${JSON.stringify(value, null, 2)}\n`
const write = (relative, content) => {
  const path = join(here, relative)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content)
}

rmSync(join(here, "api"), { recursive: true, force: true })
write("ventas-mock.xlsx", zip(xlsxParts("Informe", excelRows)))
write("catalogo-niveles.json", json(catalog.map(({ weeklyUnits, ...product }) => ({ ...product, movedUnits: weeklyUnits }))))
write("api/inbox-today.json", json({ inbox }))
write("api/inbox-days.json", json({ days }))
write("api/daily-cash-today.json", json({ dailyCash: cash }))
write("api/sales-report-latest.json", json({ report: salesReport }))
write("api/products.json", json({ products: productList }))
write("api/suppliers.json", json({ suppliers: supplierList }))
write("api/expired-exchanges.json", json({ exchanges: expiredSeed }))
for (const [supplierId, response] of Object.entries(suggestions)) {
  write(`api/suggestions/${supplierId.slice(4)}.json`, json(response))
}

console.log(`Mock de Sugeridos para ${TODAY} (ventas del ${PERIOD_START} al ${addDays(TODAY, -1)})`)
console.log(`  ventas-mock.xlsx: ${excelRows.length - 1} filas, ${salesReport.totalUnits} unidades`)
console.log(`  catálogo: ${productList.length} productos de ${supplierList.length} proveedores`)
console.log(`  caja: ${OPENING_CASH} abierta, ${spentToday} pedida, ${remainingCash} queda · presupuesto por pedido ${budget}`)
for (const vendor of vendors) {
  const state = vendor.orderToday ? `pedido hecho (${vendor.orderToday.status})` : `${vendor.ready.productCount} productos · ${vendor.ready.budgetTier}`
  console.log(`  ${vendor.supplierName.padEnd(28)} ${String(vendor.orderToday?.totalCost ?? vendor.ready.totalCost).padStart(8)} · ${state}`)
}
