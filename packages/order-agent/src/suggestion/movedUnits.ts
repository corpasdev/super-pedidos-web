/** Venta de un producto en un día (Excel de ventas, agrupado por código y fecha). */
export interface DailySale {
  readonly barcode: string
  /** YYYY-MM-DD en la hora de la tienda. */
  readonly soldOn: string
  readonly units: number
}

/**
 * CM por código de barras: unidades vendidas DESPUÉS del día de la última entrega de ese producto.
 * Sin entrega registrada se cuentan todas las ventas disponibles.
 * Las fechas YYYY-MM-DD se comparan como texto (orden cronológico).
 */
export const movedUnitsSince =
  (lastDeliveryDayByBarcode: ReadonlyMap<string, string>) =>
  (sales: readonly DailySale[]): ReadonlyMap<string, number> =>
    sales
      .filter((sale) => {
        const lastDelivery = lastDeliveryDayByBarcode.get(sale.barcode)
        return lastDelivery === undefined || sale.soldOn > lastDelivery
      })
      // Acumulador local: la función sigue siendo pura (misma entrada → misma salida, sin efectos afuera).
      .reduce((totals, sale) => totals.set(sale.barcode, (totals.get(sale.barcode) ?? 0) + sale.units), new Map<string, number>())
