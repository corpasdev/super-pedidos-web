/** Entidad: marca a la que pertenece un producto dentro de un proveedor. */
export class Brand {
  constructor(
    readonly id: string,
    readonly name: string,
    readonly supplierId: string,
  ) {}
}