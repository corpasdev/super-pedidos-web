const COP_GROUP = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 0 })

export const formatMoney = (pesos: number): string => `$${COP_GROUP.format(pesos)}`

const DATE_FORMAT = new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short", weekday: "short" })

export const formatDate = (iso: string): string => DATE_FORMAT.format(new Date(iso))

/** Día YYYY-MM-DD (sin hora): se arma en hora local para no correrse un día por la zona horaria. */
export const formatDay = (day: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return ""
  const [year, month, dayOfMonth] = day.split("-").map(Number)
  return DATE_FORMAT.format(new Date(year ?? 0, (month ?? 1) - 1, dayOfMonth ?? 1))
}

const SHORT_DATE_FORMAT = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short" })

/** «21 sept» a partir de "2026-09-21" (sin día de la semana ni punto final). */
export const formatShortDay = (day: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return ""
  const [year, month, dayOfMonth] = day.split("-").map(Number)
  return SHORT_DATE_FORMAT.format(new Date(year ?? 0, (month ?? 1) - 1, dayOfMonth ?? 1)).replace(/\.$/, "").replace(" de ", " ")
}

const LONG_DATE_FORMAT = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long" })

/** «miércoles, 30 de septiembre» a partir de "2026-09-30". */
export const formatLongDay = (day: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return ""
  const [year, month, dayOfMonth] = day.split("-").map(Number)
  return LONG_DATE_FORMAT.format(new Date(year ?? 0, (month ?? 1) - 1, dayOfMonth ?? 1))
}

const WEEKDAY_LABELS = ["", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"] as const

export const weekdayLabel = (weekday: number): string => WEEKDAY_LABELS[weekday] ?? ""

/** Interpola `{param}` de statusExplanation. Los números se formatean como pesos. */
export const interpolateParams = (template: string, params: Record<string, number | string>): string =>
  template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key]
    if (value === undefined) return match
    return typeof value === "number" ? formatMoney(value) : value
  })

export const formatSupplyUnits = (units: number): string => `${units.toLocaleString("es-CO")} u`

export const shortId = (id: string): string => id.slice(0, 8)

/**
 * Pesos colombianos en n-input-number: se pasan como `:format="moneyFormatter"` y `:parse="moneyParser"`
 * (en Naive UI las props se llaman format/parse; `formatter`/`parser` no existen y se ignoran).
 * Muestra "$25.988": signo de pesos, punto de miles y sin decimales.
 */
export const moneyFormatter = (value: number | null): string => (value === null ? "" : formatMoney(value))

/** Parser de pesos: ignora símbolos y separadores, deja solo dígitos. */
export const moneyParser = (input: string): number | null => {
  const digits = input.replace(/[^\d]/g, "")
  return digits === "" ? null : Number(digits)
}