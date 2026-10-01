import type {
  BuildSuggestionResponse,
  ConfirmOrderResponse,
  DailyCashItem,
  InboxDayItem,
  InboxItem,
  SalesReportItem,
  SuggestionResponse,
} from "./apiTypes"
import { ApiError } from "./ApiHttpClient"

/**
 * Modo de prueba de Sugeridos: la web responde con los datos de data/mock/api (generados por
 * data/mock/generar.mjs) en lugar de llamar a la API. Nada se guarda en Supabase: los pedidos
 * confirmados y la caja cambian solo en memoria, y se pierden al recargar.
 *
 * Se activa con VITE_MOCK=1 en el .env de la web, o abriendo la página con ?mock (se recuerda en la
 * pestaña; ?mock=0 lo apaga).
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
  return import.meta.env.VITE_MOCK === "1"
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
}

let statePromise: Promise<MockState> | null = null

const loadState = (): Promise<MockState> => {
  statePromise ??= (async () => {
    const [{ inbox }, { days }, { report }] = await Promise.all([
      loadFile<{ inbox: InboxItem }>("inbox-today.json"),
      loadFile<{ days: InboxDayItem[] }>("inbox-days.json"),
      loadFile<{ report: SalesReportItem | null }>("sales-report-latest.json"),
    ])
    const suggestionEntries = await Promise.all(
      Object.keys(mockFiles)
        .filter((path) => path.includes("/suggestions/"))
        .map(async (path) => {
          const response = await loadFile<BuildSuggestionResponse>(path.replace("../../../../data/mock/api/", ""))
          return [response.suggestion.supplier.id, response] as const
        }),
    )
    return { inbox, days, report, suggestions: new Map(suggestionEntries) }
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

/**
 * Responde una petición con el mock. Devuelve `undefined` si la ruta no es de Sugeridos y es de
 * solo lectura (entonces va a la API real); cualquier otra escritura queda bloqueada.
 */
export const mockRequest = async (method: string, path: string, body?: unknown): Promise<unknown> => {
  const route = path.split("?")[0] ?? path
  const state = await loadState()

  if (method === "GET") {
    if (route === "/inbox/today") return { inbox: structuredClone(state.inbox) }
    if (route === "/inbox/days") return { days: structuredClone(state.days) }
    if (route === "/daily-cash/today") return cashPayload(state.inbox.cash)
    if (route === "/sales-reports/latest") return { report: structuredClone(state.report) }
    return undefined
  }

  if (method === "PUT" && route === "/daily-cash/today") {
    const { openingAmount } = (body ?? {}) as { openingAmount?: number }
    const cash = state.inbox.cash
    cash.openingAmount = openingAmount ?? cash.openingAmount
    cash.remainingAmount = cash.openingAmount === null ? null : Math.max(0, cash.openingAmount - cash.spentAmount)
    return cashPayload(cash)
  }

  if (method === "POST") {
    const confirmMatch = CONFIRM.exec(route)
    if (confirmMatch) return confirm(state, confirmMatch[1]!, (body ?? {}) as ConfirmBody)
    const suggestionMatch = SUGGESTION.exec(route)
    if (suggestionMatch) {
      const built = suggestionFor(state, suggestionMatch[1]!)
      const overrides = ((body ?? {}) as ConfirmBody).unitCostOverrides ?? []
      return { ...structuredClone(built), suggestion: withCostOverrides(structuredClone(built.suggestion), overrides) }
    }
  }

  return notAvailable(method, path)
}
