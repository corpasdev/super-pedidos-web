import { CatalogImportError, repairMojibake } from "@agente-pedidos/order-agent"

export interface ParsedSupplierEntry {
  externalId: number
  name: string
  taxId: string | null
  contactEmail: string | null
}

export interface ParsedProductEntry {
  externalId: number
  barcode: string
  reference: string | null
  name: string
  category: string
  salePrice: number
  /** null = la cantidad no es numérica (un código de barras escrito en la cantidad). */
  stockUnits: number | null
  supplierExternalId: number | null
  supplierName: string | null
}

const EMPTY_CATEGORY = "sin categoría"

/** Normaliza el nombre del proveedor: quita el " ." final (a veces sobra un punto) y colapsa espacios. */
export const normalizeSupplierName = (rawName: string): string =>
  rawName.replace(/\s*\.\s*$/, "").replace(/\s+/g, " ").trim()

const collapseSpaces = (value: string): string => value.replace(/\s+/g, " ").trim()

/** Texto limpio y con la codificación reparada ("MU�'OZ" → "MUÑOZ"). */
const cleanText = (value: unknown): string =>
  value === null || value === undefined ? "" : repairMojibake(String(value).trim())

const toIntegerOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value) : null
  const asText = String(value).trim()
  if (asText.length === 0) return null
  const parsed = Number(asText.replace(/[.\s]/g, ""))
  return Number.isFinite(parsed) ? parsed : null
}

const toBarcode = (value: unknown): string => (value === null || value === undefined ? "" : String(value).trim())

/**
 * Parser del catálogo que exporta el software de ventas:
 * `productos_completo.json` ({ productos: [...] }) y `proveedores_completo.json` ({ proveedores: [...] }).
 */
export class SoftwareCatalogParser {
  parseSuppliers(rawCatalog: unknown): ParsedSupplierEntry[] {
    const isEmpty = (candidate: unknown) => candidate === null || candidate === undefined || candidate === ""
    const suppliers = isObjectWithKey(rawCatalog, "proveedores") ? (rawCatalog as { proveedores: unknown[] }).proveedores : []
    if (!Array.isArray(suppliers)) throw new CatalogImportError("la llave 'proveedores' no es una lista")

    return suppliers.map((rawSupplier) => {
      const supplier = rawSupplier as Record<string, unknown>
      const rawName = cleanText(supplier.proveedor)
      if (rawName.length === 0) throw new CatalogImportError("hay un proveedor sin nombre (proveedor)")
      return {
        externalId: Number(supplier.id),
        name: normalizeSupplierName(rawName),
        taxId: isEmpty(supplier.nit_cc) ? null : cleanText(supplier.nit_cc),
        contactEmail: isEmpty(supplier.correo) ? null : cleanText(supplier.correo),
      }
    })
  }

  parseProducts(
    rawCatalog: unknown,
    suppliersByExternalId: ReadonlyMap<number, ParsedSupplierEntry>,
  ): ParsedProductEntry[] {
    const products = isObjectWithKey(rawCatalog, "productos") ? (rawCatalog as { productos: unknown[] }).productos : []
    if (!Array.isArray(products)) throw new CatalogImportError("la llave 'productos' no es una lista")
    const suppliersByNormalizedName = new Map([...suppliersByExternalId.values()].map((supplier) => [supplier.name, supplier]))

    return products.map((rawProduct) => {
      const product = rawProduct as Record<string, unknown>
      const barcode = toBarcode(product.cod_barra)
      const name = collapseSpaces(cleanText(product.producto))
      const rawCategory = collapseSpaces(cleanText(product.categoria))
      const salePrice = toIntegerOrNull(product.precio_venta) ?? 0
      const stockUnits = toIntegerOrNull(product.cantidad)
      const rawSupplierName = normalizeSupplierName(cleanText(product.proveedor))
      const matchedSupplier = suppliersByNormalizedName.get(rawSupplierName) ?? null

      if (barcode.length === 0) throw new CatalogImportError(`el producto ${name || "(sin nombre)"} no tiene código de barras`)
      if (name.length === 0) throw new CatalogImportError(`el código ${barcode} no tiene nombre de producto`)

      return {
        externalId: Number(product.id),
        barcode,
        reference: isEmptyProductReference(product) ? null : cleanText(product.referencia),
        name,
        category: rawCategory.length === 0 ? EMPTY_CATEGORY : rawCategory,
        salePrice,
        stockUnits,
        supplierExternalId: matchedSupplier?.externalId ?? null,
        supplierName: matchedSupplier?.name ?? rawSupplierName,
      }
    })
  }
}

// Mantiene "reference" como null cuando está vacío, sin duplicar la lectura de campos.
const isEmptyProductReference = (product: Record<string, unknown>) =>
  product.referencia === null || product.referencia === undefined || String(product.referencia).trim() === ""

const isObjectWithKey = (candidate: unknown, key: string): boolean =>
  candidate !== null && typeof candidate === "object" && key in (candidate as Record<string, unknown>)