import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { es } from "../src/i18n/es"
import { formatMoney, interpolateParams } from "../src/i18n/format"

const SOURCE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)), "src")

function collectFiles(directory: string, extension: string): string[] {
  const results: string[] = []
  for (const entry of readdirSync(directory)) {
    const absolutePath = join(directory, entry)
    const isDirectory = statSync(absolutePath).isDirectory()
    if (isDirectory) results.push(...collectFiles(absolutePath, extension))
    else if (absolutePath.endsWith(extension)) results.push(absolutePath)
  }
  return results
}

describe("i18n/es.ts", () => {
  it("no deja textos TODO de fases anteriores", () => {
    const serialized = JSON.stringify(es)
    expect(serialized).not.toContain("TODO")
    expect(serialized).not.toContain("fase 8")
  })

  it("expone estados y explicaciones del pedido", () => {
    expect(Object.keys(es.orderStatus)).toContain("complete")
    expect(Object.keys(es.orderStatus)).toContain("received")
    for (const key of Object.keys(es.statusExplanation)) {
      expect(key.startsWith("order.status.")).toBe(true)
    }
  })

  it("centraliza los textos que antes estaban hardcodeados", () => {
    expect(es.nav.openMenu).toBe("Abrir menú")
    expect(es.nav.closeMenu).toBe("Cerrar menú")
    expect(es.reviewStep.noBrand).toBe("Sin marca")
    expect(es.reviewStep.packMeta(12, "Abarrotes")).toBe("12 u/paq · Abarrotes")
    expect(es.reviewStep.decrement("huevos")).toContain("huevos")
    expect(es.reviewStep.increment("huevos")).toContain("huevos")
  })
})

describe("compliance: sin español hardcodeado en plantillas", () => {
  it("ningún .vue contiene cadenas con tildes fuera de es.ts", () => {
    const offending: string[] = []
    for (const filePath of collectFiles(SOURCE_ROOT, ".vue")) {
      const lines = readFileSync(filePath, "utf8").split("\n")
      for (let index = 0; index < lines.length; index += 1) {
        if (/["'][^"']*[áéíóúÁÉÍÓÚñÑ][^"']*["']/.test(lines[index] ?? "")) {
          offending.push(`${filePath}:${index + 1}`)
        }
      }
    }
    expect(offending).toEqual([])
  })
})

describe("i18n/format.ts", () => {
  it("formatea pesos en español colombiano", () => {
    expect(formatMoney(25988)).toBe("$25.988")
    expect(formatMoney(0)).toBe("$0")
  })

  it("interpola parámetros y formatea números como pesos", () => {
    expect(interpolateParams("Te pasas por {overBy}", { overBy: 2500 })).toBe("Te pasas por $2.500")
    expect(interpolateParams("Hola {nombre}", { nombre: "Ana" })).toBe("Hola Ana")
  })
})