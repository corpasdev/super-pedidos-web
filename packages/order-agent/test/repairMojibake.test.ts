import { describe, expect, it } from "vitest"
import { hasBrokenCharacters, repairMojibake } from "../src/text/repairMojibake.js"

describe("repairMojibake", () => {
  it("casos reales de la base: � + apóstrofo → Ñ", () => {
    expect(repairMojibake("ALVARO MU�'OZ")).toBe("ALVARO MUÑOZ")
    expect(repairMojibake("DOG CHOW ADULTOS MINIS Y PEQUE�'OS X475G")).toBe("DOG CHOW ADULTOS MINIS Y PEQUEÑOS X475G")
    expect(repairMojibake("HELADO PI�'A")).toBe("HELADO PIÑA")
  })

  it("UTF-8 leído como Windows-1252 con Ã", () => {
    expect(repairMojibake("MUÃ‘OZ")).toBe("MUÑOZ")
    expect(repairMojibake("piÃ±a")).toBe("piña")
    expect(repairMojibake("cafÃ© azÃºcar limÃ³n")).toBe("café azúcar limón")
    expect(repairMojibake("CAMIÃ“N")).toBe("CAMIÓN")
  })

  it("no toca texto sano ni apóstrofos normales", () => {
    expect(repairMojibake("D'Onofrio Ñandú")).toBe("D'Onofrio Ñandú")
    expect(repairMojibake("Azúcar Manuelita")).toBe("Azúcar Manuelita")
  })

  it("deja marcado lo que no puede reparar", () => {
    expect(repairMojibake("A�B")).toBe("A�B")
    expect(hasBrokenCharacters("A�B")).toBe(true)
    expect(hasBrokenCharacters("MUÑOZ")).toBe(false)
  })
})
