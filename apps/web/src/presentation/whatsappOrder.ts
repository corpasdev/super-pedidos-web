/**
 * Pedido para enviar por WhatsApp: texto corto y fácil de leer en el celular del proveedor.
 * Sin precios (el proveedor pone los suyos): solo qué productos y cuántas unidades.
 *
 *   Pedido · Tienda Don Amauris
 *   POSTOBON · lunes 05/10/2026
 *
 *   1. agua cristal x 1 L — 12 u
 *   2. gaseosa colombiana zero 250 ml — 6 u
 *
 *   Total: 2 productos · 18 unidades
 */
export interface OrderMessageInput {
  storeName: string | null
  supplierName: string
  /** YYYY-MM-DD del pedido. */
  day: string
  lines: { name: string; units: number }[]
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]

const dayLabel = (day: string): string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day)
  if (!match) return ""
  const weekday = WEEKDAYS[new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getDay()]
  return `${weekday} ${match[3]}/${match[2]}/${match[1]}`
}

export const orderMessage = (input: OrderMessageInput): string => {
  const units = input.lines.reduce((sum, line) => sum + line.units, 0)
  const header = input.storeName ? `*Pedido · ${input.storeName}*` : "*Pedido*"
  const subheader = [input.supplierName, dayLabel(input.day)].filter(Boolean).join(" · ")
  const items = input.lines.map((line, index) => `${index + 1}. ${line.name} — ${line.units} u`)
  const total = `Total: ${input.lines.length} producto${input.lines.length === 1 ? "" : "s"} · ${units} unidad${units === 1 ? "" : "es"}`
  return [header, subheader, "", ...items, "", total].join("\n")
}

/**
 * Enlace de WhatsApp para ese número con el texto ya escrito. Se quedan solo los dígitos;
 * un celular colombiano de 10 dígitos (empieza por 3) recibe el indicativo 57.
 */
export const whatsappLink = (number: string, text: string): string => {
  const digits = number.replace(/\D/g, "")
  const international = digits.length === 10 && digits.startsWith("3") ? `57${digits}` : digits
  return `https://wa.me/${international}?text=${encodeURIComponent(text)}`
}
