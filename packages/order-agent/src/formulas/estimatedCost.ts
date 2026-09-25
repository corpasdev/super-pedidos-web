/**
 * Recargo que el dueño le suma al costo para fijar el precio de venta:
 * dulcería +30 %, el resto de categorías +20 %.
 */
export const CANDY_MARKUP_RATIO = 0.3
export const DEFAULT_MARKUP_RATIO = 0.2

const normalizeCategory = (category: string): string =>
  category.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

export const isCandyCategory = (category: string): boolean => normalizeCategory(category).includes("dulceri")

export const markupRatioFor = (category: string): number => (isCandyCategory(category) ? CANDY_MARKUP_RATIO : DEFAULT_MARKUP_RATIO)

/**
 * R8 (estimado): cuando no se conoce el costo, costo = precio de venta ÷ (1 + recargo), redondeado al peso.
 * Sin precio de venta no hay de dónde estimar: devuelve 0 y el pedido lo marca "sin costo".
 */
export const estimateUnitCost = (salePrice: number, category: string): number =>
  salePrice <= 0 ? 0 : Math.round(salePrice / (1 + markupRatioFor(category)))
