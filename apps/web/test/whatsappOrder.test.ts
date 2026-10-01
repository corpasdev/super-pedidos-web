import { describe, expect, it } from "vitest"
import { orderMessage, whatsappLink } from "../src/presentation/whatsappOrder"

describe("pedido por WhatsApp", () => {
  it("arma un texto simple: productos y unidades, sin precios", () => {
    const text = orderMessage({
      storeName: "Tienda Don Amauris",
      supplierName: "POSTOBON",
      day: "2026-10-05",
      lines: [
        { name: "agua cristal x 1 L", units: 12 },
        { name: "gaseosa colombiana zero 250 ml", units: 6 },
      ],
    })
    expect(text).toBe(
      [
        "*Pedido · Tienda Don Amauris*",
        "POSTOBON · lunes 05/10/2026",
        "",
        "1. agua cristal x 1 L — 12 u",
        "2. gaseosa colombiana zero 250 ml — 6 u",
        "",
        "Total: 2 productos · 18 unidades",
      ].join("\n"),
    )
    expect(text).not.toContain("$")
  })

  it("el enlace usa solo dígitos y agrega el 57 a los celulares colombianos", () => {
    expect(whatsappLink("300 123 4567", "hola")).toBe("https://wa.me/573001234567?text=hola")
    expect(whatsappLink("+57 300-123-4567", "a b")).toBe("https://wa.me/573001234567?text=a%20b")
  })
})
