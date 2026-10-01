import type { PaginationProps } from "naive-ui"
import { es } from "../i18n/es"

/** Todas las tablas de la app muestran de a 5 filas. */
export const TABLE_PAGE_SIZE = 5

/**
 * Paginación común de `n-data-table`: 5 por página y, a la izquierda de los controles,
 * el rango visible sobre el total ("6–10 de 23"). El total registrado va además en la cabecera de la tarjeta.
 */
export const tablePagination = (): PaginationProps => ({
  pageSize: TABLE_PAGE_SIZE,
  prefix: ({ page, pageSize, itemCount }) => {
    const total = itemCount ?? 0
    if (total === 0) return es.table.range(0, 0, 0)
    const start = (page - 1) * pageSize + 1
    const end = Math.min(page * pageSize, total)
    return es.table.range(start, end, total)
  },
})

/** "23 proveedores", "1 pedido"… para la etiqueta de total de la cabecera. */
/** Solo la cifra (3.752); el texto completo queda para lectores de pantalla con totalLabel. */
export const totalCount = (count: number): string => count.toLocaleString("es-CO")

export const totalLabel = (count: number, noun: keyof typeof es.table.nouns | string): string => {
  const [singular, plural] = es.table.nouns[noun] ?? [noun, noun]
  return es.table.count(count, singular, plural)
}
