/** Entidad: llegada del camión que convierte un pedido confirmado en recibido. */
export class TruckDelivery {
  constructor(
    readonly purchaseOrderId: string,
    readonly deliveredAt: Date,
    readonly receivedUnitsByProduct: ReadonlyMap<string, number>,
  ) {}
}