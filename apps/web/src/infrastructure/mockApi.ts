import type {
  BuildSuggestionResponse,
  ConfirmOrderResponse,
  DailyCashItem,
  ExpiredExchangeItem,
  InboxDayItem,
  InboxItem,
  ProductItem,
  SalesReportItem,
  StoreProfileItem,
  SuggestionResponse,
  SupplierListItem,
} from "./apiTypes"
import { ApiError } from "./ApiHttpClient"

/**
 * Modo de prueba: simula todo el software con los datos de data/mock/api (generados por
 * data/mock/generar.mjs) sin API ni Supabase. Sugeridos, Productos, Proveedores, vencidos, caja y
 * sesión responden desde memoria; lo que se crea o confirma se pierde al recargar.
 *
 * Se activa con `npm run dev:mock` (modo «mock» de Vite), con VITE_MOCK=1 en el .env de la web, o
 * abriendo la página con ?mock (se recuerda en la pestaña; ?mock=0 lo apaga).
 */
const STORAGE_KEY = "superpedido.mock"

const readMockFlag = (): boolean => {
  try {
    const param = new URLSearchParams(window.location.search).get("mock")
    if (param !== null) sessionStorage.setItem(STORAGE_KEY, param === "0" ? "0" : "1")
    const stored = sessionStorage.getItem(STORAGE_KEY)
    if (stored !== null) return stored === "1"
  } catch {
    // Sin acceso a sessionStorage: queda lo que diga el .env.
  }
  return import.meta.env.VITE_MOCK === "1" || import.meta.env.MODE === "mock"
}

export const isMockMode: boolean = typeof window !== "undefined" && readMockFlag()

// Carga perezosa: los JSON solo se descargan en modo de prueba.
const mockFiles = import.meta.glob<{ default: unknown }>("../../../../data/mock/api/**/*.json")

const loadFile = async <T>(relative: string): Promise<T> => {
  const loader = mockFiles[`../../../../data/mock/api/${relative}`]
  if (!loader) throw new ApiError(404, "MOCK_NOT_FOUND", `Falta data/mock/api/${relative}. Corre node data/mock/generar.mjs.`)
  return structuredClone((await loader()).default) as T
}

interface MockState {
  inbox: InboxItem
  days: InboxDayItem[]
  report: SalesReportItem | null
  suggestions: Map<string, BuildSuggestionResponse>
  products: ProductItem[]
  suppliers: SupplierListItem[]
  exchanges: ExpiredExchangeItem[]
  profile: StoreProfileItem
}

/** Tienda y dueño de prueba (también los usa la sesión simulada). */
export const MOCK_STORE = { id: "mock-store", name: "Tienda de prueba" } as const
export const MOCK_USER = { id: "mock-user", email: "demo@superpedido.local" } as const

let statePromise: Promise<MockState> | null = null

const loadState = (): Promise<MockState> => {
  statePromise ??= (async () => {
    const [{ inbox }, { days }, { report }, { products }, { suppliers }, { exchanges }] = await Promise.all([
      loadFile<{ inbox: InboxItem }>("inbox-today.json"),
      loadFile<{ days: InboxDayItem[] }>("inbox-days.json"),
      loadFile<{ report: SalesReportItem | null }>("sales-report-latest.json"),
      loadFile<{ products: ProductItem[] }>("products.json"),
      loadFile<{ suppliers: SupplierListItem[] }>("suppliers.json"),
      loadFile<{ exchanges: ExpiredExchangeItem[] }>("expired-exchanges.json"),
    ])
    const suggestionEntries = await Promise.all(
      Object.keys(mockFiles)
        .filter((path) => path.includes("/suggestions/"))
        .map(async (path) => {
          const response = await loadFile<BuildSuggestionResponse>(path.replace("../../../../data/mock/api/", ""))
          return [response.suggestion.supplier.id, response] as const
        }),
    )
    const profile: StoreProfileItem = {
      id: MOCK_STORE.id,
      name: MOCK_STORE.name,
      adminName: "Dueño de prueba",
      contactEmail: MOCK_USER.email,
      logoUrl: null,
      updatedAt: new Date().toISOString(),
    }
    return { inbox, days, report, suggestions: new Map(suggestionEntries), products, suppliers, exchanges, profile }
  })()
  return statePromise
}

const notAvailable = (method: string, path: string): never => {
  throw new ApiError(501, "MOCK_NOT_AVAILABLE", `En modo de prueba no se puede ${method} ${path}.`)
}

/** Aplica al sugerido los precios que escribió el dueño en este pedido. */
const withCostOverrides = (suggestion: SuggestionResponse, overrides: { productId: string; unitCost: number }[]): SuggestionResponse => {
  const costs = new Map(overrides.map((override) => [override.productId, override.unitCost]))
  const groups = suggestion.groups.map((group) => {
    const lines = group.lines.map((line) => {
      const unitCost = costs.get(line.productId)
      if (unitCost === undefined) return line
      return {
        ...line,
        unitCost,
        costSource: "order" as const,
        allocatedLineCost: line.allocatedUnits * unitCost,
        finalLineCost: line.finalUnits * unitCost,
        maximumLineCost: line.suggestedMaximumUnits * unitCost,
      }
    })
    return { ...group, lines, subtotal: lines.reduce((sum, line) => sum + line.finalLineCost, 0) }
  })
  const total = groups.reduce((sum, group) => sum + group.subtotal, 0)
  return { ...suggestion, groups, allocatedOrderCost: total, finalOrderCost: total }
}

const suggestionFor = (state: MockState, supplierId: string): BuildSuggestionResponse => {
  const response = state.suggestions.get(supplierId)
  if (!response) throw new ApiError(404, "MOCK_NOT_FOUND", "Este proveedor no tiene sugerido en el mock.")
  return response
}

const cashPayload = (cash: DailyCashItem): { dailyCash: DailyCashItem } => ({ dailyCash: structuredClone(cash) })

interface ConfirmBody {
  unitCostOverrides?: { productId: string; unitCost: number }[]
  adjustments?: { productId: string; units: number }[]
  sellerId?: string
  paidNow?: boolean
}

const confirm = (state: MockState, supplierId: string, body: ConfirmBody): ConfirmOrderResponse => {
  const built = suggestionFor(state, supplierId)
  const suggestion = withCostOverrides(built.suggestion, body.unitCostOverrides ?? [])
  const adjusted = new Map((body.adjustments ?? []).map((adjustment) => [adjustment.productId, adjustment.units]))
  const lines = suggestion.groups
    .flatMap((group) => group.lines)
    .map((line) => ({ productId: line.productId, units: adjusted.get(line.productId) ?? line.finalUnits, unitCost: line.unitCost }))
    .filter((line) => line.units > 0)
    .map((line) => ({ ...line, lineCost: line.units * line.unitCost }))
  const totalCost = lines.reduce((sum, line) => sum + line.lineCost, 0)

  const vendor = state.inbox.vendors.find((item) => item.supplierId === supplierId && (body.sellerId === undefined || item.sellerId === body.sellerId))
  const received = vendor?.deliversSameDay ?? false
  const paid = body.paidNow ?? false
  const orderId = `mock-order-${supplierId}-${Date.now()}`
  if (vendor) {
    vendor.orderToday = { id: orderId, status: received ? "received" : "confirmed", totalCost, pendingAmount: paid ? 0 : totalCost }
  }
  const cash = state.inbox.cash
  cash.spentAmount += totalCost
  if (cash.openingAmount !== null) cash.remainingAmount = Math.max(0, cash.openingAmount - cash.spentAmount)
  if (!paid) {
    const debt = state.inbox.debts.find((item) => item.supplierId === supplierId)
    if (debt) debt.amount += totalCost
    else state.inbox.debts.push({ supplierId, supplierName: suggestion.supplier.name, amount: totalCost })
  }

  return {
    order: {
      id: orderId,
      supplierId,
      createdAt: new Date().toISOString(),
      status: received ? "received" : "confirmed",
      totalCost,
      availableBudget: suggestion.availableBudget,
      maximumOrderCost: suggestion.maximumOrderCost,
      lines,
    },
    received,
    paid,
    suggestion,
    budget: built.budget,
    decision: built.decision,
    dailyCash: structuredClone(cash),
  }
}

const SUGGESTION = /^\/order-suggestions\/suppliers\/([^/]+)$/
const CONFIRM = /^\/order-suggestions\/suppliers\/([^/]+)\/confirm$/
const SUPPLIER = /^\/suppliers\/([^/]+)$/
const SUPPLIER_PRODUCTS = /^\/suppliers\/([^/]+)\/products$/
const PRODUCT_SETTINGS = /^\/products\/([^/]+)\/settings$/
const PRODUCT_STOCK = /^\/products\/([^/]+)\/stock$/
const EXCHANGE_DONE = /^\/expired-exchanges\/([^/]+)\/exchanged$/
const EXCHANGE = /^\/expired-exchanges\/([^/]+)$/

type Body = Record<string, unknown>

const byId = <T extends { id: string }>(items: T[], id: string, what: string): T => {
  const found = items.find((item) => item.id === id)
  if (!found) throw new ApiError(404, "MOCK_NOT_FOUND", `${what} no existe en el modo de prueba.`)
  return found
}

const supplierName = (state: MockState, supplierId: string | null): string | null =>
  supplierId === null ? null : (state.suppliers.find((supplier) => supplier.id === supplierId)?.name ?? null)

/** Producto nuevo (Crear producto). El punto de pedido queda entre la base y el tope, como en la API. */
const createProduct = (state: MockState, body: Body): ProductItem => {
  const barcode = String(body.barcode ?? "").trim()
  if (state.products.some((product) => product.barcode === barcode)) {
    throw new ApiError(409, "duplicate_catalog_entry", `Ya existe un producto con el código ${barcode}.`)
  }
  const base = (body.minStockUnits as number | null | undefined) ?? null
  const tope = (body.maxStockUnits as number | null | undefined) ?? null
  if (base !== null && tope !== null && tope - base < 2) {
    throw new ApiError(400, "invalid_levels", "Entre la base y el tope debe haber al menos 2 unidades.")
  }
  const salePrice = Number(body.salePrice ?? 0)
  const unitCost = (body.unitCost as number | null | undefined) ?? null
  const supplierId = (body.supplierId as string | null | undefined) ?? null
  const product: ProductItem = {
    id: `mock-product-${Date.now()}`,
    barcode,
    name: String(body.name ?? "").trim(),
    category: String(body.category ?? "").trim(),
    salePrice,
    supplierId,
    supplierName: supplierName(state, supplierId),
    brandName: null,
    packSize: 1,
    unitCost: unitCost ?? Math.round(salePrice / 1.2),
    costSource: unitCost === null ? "estimated" : "owner",
    maxStockUnits: tope,
    minStockUnits: base,
    reorderPointUnits: base !== null && tope !== null ? Math.floor((base + tope) / 2) : null,
    stockUnits: Number(body.stockUnits ?? 0),
    isStockReliable: true,
    isEstimated: unitCost === null,
  }
  state.products = [...state.products, product].sort((left, right) => left.name.localeCompare(right.name, "es"))
  const owner = state.suppliers.find((supplier) => supplier.id === supplierId)
  if (owner) owner.productCount += 1
  return product
}

/** Proveedor nuevo (Crear proveedor). */
const createSupplier = (state: MockState, body: Body): string => {
  const name = String(body.name ?? "").trim().toUpperCase()
  if (state.suppliers.some((supplier) => supplier.name.toUpperCase() === name)) {
    throw new ApiError(409, "duplicate_catalog_entry", `Ya existe un proveedor llamado ${name}.`)
  }
  const id = `mock-supplier-${Date.now()}`
  const orderWeekday = Number(body.orderWeekday)
  const deliveryWeekday = Number(body.deliveryWeekday)
  state.suppliers = [
    ...state.suppliers,
    {
      id,
      name,
      taxId: (body.taxId as string | null | undefined) ?? null,
      contactEmail: (body.contactEmail as string | null | undefined) ?? null,
      hasSchedule: true,
      orderWeekday,
      deliveryWeekday,
      visitFrequencyDays: body.visitFrequency === "biweekly" ? 14 : 7,
      deliveryLeadDays: (deliveryWeekday - orderWeekday + 7) % 7,
      nextOrderDate: null,
      lastDeliveryDate: null,
      isVisitingToday: false,
      minimumOrderAmount: Number(body.minimumOrderAmount ?? 20_000),
      maximumOrderAmount: (body.maximumOrderAmount as number | null | undefined) ?? 250_000,
      isEstimated: false,
      productCount: 0,
      lastOrderAt: null,
    },
  ].sort((left, right) => left.name.localeCompare(right.name, "es"))
  return id
}

/** Cambios de la tabla de Productos (precios, niveles). */
const updateProduct = (state: MockState, productId: string, body: Body): ProductItem => {
  const product = byId(state.products, productId, "El producto")
  const next = { ...product }
  if (typeof body.salePrice === "number") next.salePrice = body.salePrice
  if (typeof body.unitCost === "number") {
    next.unitCost = body.unitCost
    next.costSource = "owner"
  }
  if ("minStockUnits" in body) next.minStockUnits = body.minStockUnits as number | null
  if ("maxStockUnits" in body) next.maxStockUnits = body.maxStockUnits as number | null
  if ("reorderPointUnits" in body) next.reorderPointUnits = body.reorderPointUnits as number | null
  const { minStockUnits: base, reorderPointUnits: point, maxStockUnits: tope } = next
  if ((base !== null && point !== null && base >= point) || (point !== null && tope !== null && point >= tope)) {
    throw new ApiError(400, "invalid_levels", "Los niveles deben cumplir base < punto de pedido < tope.")
  }
  state.products = state.products.map((item) => (item.id === productId ? next : item))
  return next
}

const addExchange = (state: MockState, body: Body): ExpiredExchangeItem => {
  const product = byId(state.products, String(body.productId), "El producto")
  const supplierId = (body.supplierId as string | null | undefined) ?? product.supplierId
  const exchange: ExpiredExchangeItem = {
    id: `mock-expired-${Date.now()}`,
    productId: product.id,
    productName: product.name,
    barcode: product.barcode,
    supplierId,
    supplierName: supplierName(state, supplierId),
    units: Number(body.units ?? 1),
    createdAt: new Date().toISOString(),
  }
  state.exchanges = [...state.exchanges, exchange]
  return exchange
}

/** Responde una petición con el mock. Nada llega a la API real; lo que no se simula queda bloqueado. */
export const mockRequest = async (method: string, path: string, body?: unknown): Promise<unknown> => {
  const route = path.split("?")[0] ?? path
  const state = await loadState()
  const data = (body ?? {}) as Body

  if (method === "GET") {
    if (route === "/inbox/today") return { inbox: structuredClone(state.inbox) }
    if (route === "/inbox/days") return { days: structuredClone(state.days) }
    if (route === "/daily-cash/today") return cashPayload(state.inbox.cash)
    if (route === "/sales-reports/latest") return { report: structuredClone(state.report) }
    if (route === "/stores") return { store: { ...MOCK_STORE } }
    if (route === "/store-profile") return { profile: { ...state.profile } }
    if (route === "/products") return { products: structuredClone(state.products) }
    if (route === "/suppliers") return { suppliers: structuredClone(state.suppliers) }
    if (route === "/expired-exchanges") return { exchanges: structuredClone(state.exchanges) }
    const supplierProducts = SUPPLIER_PRODUCTS.exec(route)
    if (supplierProducts) return { products: structuredClone(state.products.filter((product) => product.supplierId === supplierProducts[1])) }
    return notAvailable(method, path)
  }

  if (method === "PUT" && route === "/daily-cash/today") {
    const cash = state.inbox.cash
    cash.openingAmount = (data.openingAmount as number | undefined) ?? cash.openingAmount
    cash.remainingAmount = cash.openingAmount === null ? null : Math.max(0, cash.openingAmount - cash.spentAmount)
    return cashPayload(cash)
  }

  if (method === "POST") {
    if (route === "/products") return { id: createProduct(state, data).id }
    if (route === "/suppliers") return { id: createSupplier(state, data) }
    if (route === "/expired-exchanges") return { exchange: addExchange(state, data) }
    const done = EXCHANGE_DONE.exec(route)
    if (done) {
      byId(state.exchanges, done[1]!, "El cambio")
      state.exchanges = state.exchanges.filter((exchange) => exchange.id !== done[1])
      return { ok: true }
    }
    const confirmMatch = CONFIRM.exec(route)
    if (confirmMatch) return confirm(state, confirmMatch[1]!, data as ConfirmBody)
    const suggestionMatch = SUGGESTION.exec(route)
    if (suggestionMatch) {
      const built = suggestionFor(state, suggestionMatch[1]!)
      return { ...structuredClone(built), suggestion: withCostOverrides(structuredClone(built.suggestion), (data as ConfirmBody).unitCostOverrides ?? []) }
    }
  }

  if (method === "PATCH") {
    const settings = PRODUCT_SETTINGS.exec(route)
    if (settings) return { product: updateProduct(state, settings[1]!, data) }
    const stock = PRODUCT_STOCK.exec(route)
    if (stock) {
      const product = byId(state.products, stock[1]!, "El producto")
      state.products = state.products.map((item) => (item.id === product.id ? { ...item, stockUnits: Number(data.units ?? 0), isStockReliable: true } : item))
      return { ok: true }
    }
    const supplier = SUPPLIER.exec(route)
    if (supplier) {
      const current = byId(state.suppliers, supplier[1]!, "El proveedor")
      if (typeof data.minimumOrderAmount === "number") current.minimumOrderAmount = data.minimumOrderAmount
      if ("maximumOrderAmount" in data) current.maximumOrderAmount = data.maximumOrderAmount as number | null
      return { supplier: { ...current } }
    }
    if (route === "/store-profile") {
      state.profile = { ...state.profile, ...(data as Partial<StoreProfileItem>), updatedAt: new Date().toISOString() }
      return { profile: { ...state.profile } }
    }
  }

  if (method === "DELETE") {
    const exchange = EXCHANGE.exec(route)
    if (exchange) {
      state.exchanges = state.exchanges.filter((item) => item.id !== exchange[1])
      return { ok: true }
    }
  }

  return notAvailable(method, path)
}
