/** Objeto de valor: stock en la tienda. `isReliable=false` mientras es provisional (carga inicial). */
export class StockLevel {
  constructor(
    readonly units: number,
    readonly isReliable: boolean,
  ) {}
}