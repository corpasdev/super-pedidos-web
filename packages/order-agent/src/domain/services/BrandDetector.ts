export interface BrandDetectionResult {
  brandName: string
  detectedFrom: "name" | "supplier" | "none"
}

/**
 * Servicio de dominio sin estado: detecta la marca de un producto.
 * La marca no viene en el software de ventas (sección 1.1).
 */
export class BrandDetector {
  constructor(
    private readonly knownBrandNames: string[],
    private readonly singleBrandSuppliers: ReadonlyMap<string, string>,
  ) {}

  detect(productName: string, supplierName: string): BrandDetectionResult {
    const normalizedProductName = productName.toLowerCase()
    const fromName = this.knownBrandNames.find((brandName) =>
      normalizedProductName.includes(brandName.toLowerCase()),
    )
    if (fromName) return { brandName: fromName, detectedFrom: "name" }

    const fromSupplier = this.singleBrandSuppliers.get(supplierName)
    if (fromSupplier) return { brandName: fromSupplier, detectedFrom: "supplier" }

    return { brandName: OTHER_BRANDS_BRAND_NAME, detectedFrom: "none" }
  }
}

export const OTHER_BRANDS_BRAND_NAME = "Otras marcas"