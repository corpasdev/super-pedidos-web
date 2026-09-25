/** Errores de negocio con código estable, mapeados a HTTP en la API (sección 3.4). */
export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class InvalidMoneyError extends DomainError {
  constructor(amountInPesos: number) {
    super("invalid_money", `La plata debe ser un entero mayor o igual a 0. Recibido: ${amountInPesos}.`)
  }
}

export class NegativeMoneyResultError extends DomainError {
  constructor(minuend: number, subtrahend: number) {
    super("negative_money_result", `No se puede restar ${subtrahend} de ${minuend}: el resultado sería negativo.`)
  }
}

export class InvalidPackSizeError extends DomainError {
  constructor(unitsPerPack: number) {
    super("invalid_pack_size", `El empaque debe ser un entero mayor o igual a 1. Recibido: ${unitsPerPack}.`)
  }
}

export class InvalidBarcodeError extends DomainError {
  constructor(barcode: string | number) {
    super("invalid_barcode", `El código de barras no puede estar vacío. Recibido: "${barcode}".`)
  }
}

export class InvalidDateRangeError extends DomainError {
  constructor(startsAt: Date, endsAt: Date) {
    super(
      "invalid_date_range",
      `El rango debe empezar antes de terminar. Inicio: ${startsAt.toISOString()}, fin: ${endsAt.toISOString()}.`,
    )
  }
}

export class BiweeklyAnchorRequiredError extends DomainError {
  constructor() {
    super("biweekly_anchor_required", "Un proveedor quincenal necesita una fecha de visita conocida (biweeklyAnchorDate).")
  }
}

export class SupplierScheduleNotConfiguredError extends DomainError {
  constructor(supplierName: string) {
    super(
      "supplier_schedule_not_configured",
      `El proveedor "${supplierName}" no tiene calendario (día de pedido, día de entrega y frecuencia). Escríbelos en el paso 1 antes del primer pedido.`,
    )
  }
}

export class AnchorDateOnWrongWeekdayError extends DomainError {
  constructor(anchorDate: string, expectedWeekday: string) {
    super(
      "anchor_date_wrong_weekday",
      `La fecha de visita de referencia (${anchorDate}) debe caer en el día de pedido (${expectedWeekday}).`,
    )
  }
}

export class SalesReportMissingColumnsError extends DomainError {
  constructor(missingColumns: string[]) {
    super(
      "sales_report_missing_columns",
      `El archivo no tiene las columnas obligatorias: ${missingColumns.join(", ")}.`,
    )
  }
}

export class SalesReportEmptyError extends DomainError {
  constructor() {
    super("sales_report_empty", "El archivo no tiene ventas con código de barras y cantidad.")
  }
}

export class SalesReportPeriodOverlapError extends DomainError {
  constructor(message: string) {
    super("sales_report_overlap", message)
  }
}

export class ProductNotFoundException extends DomainError {
  constructor(productId: string) {
    super("product_not_found", `No existe el producto con id "${productId}".`)
  }
}

export class CatalogImportError extends DomainError {
  constructor(detail: string) {
    super("catalog_import_failed", `No se pudo importar el catálogo: ${detail}`)
  }
}

export class SalesReportImportError extends DomainError {
  constructor(detail: string) {
    super("sales_report_import_failed", `No se pudo procesar el Excel: ${detail}`)
  }
}

export class PurchaseOrderConflictError extends DomainError {
  constructor(supplierName: string) {
    super("purchase_order_conflict", `Ya hay un pedido pendiente para ${supplierName}. Aterrízalo con el vendedor antes de confirmar otro.`)
  }
}