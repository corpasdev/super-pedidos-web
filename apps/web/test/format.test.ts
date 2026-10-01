import { describe, expect, it } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { formatDay, moneyFormatter, moneyParser } from "../src/i18n/format"

const SOURCE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)), "src")

const collectVueFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? collectVueFiles(path) : path.endsWith(".vue") ? [path] : []
  })

describe("pesos colombianos en los campos", () => {
  it("muestra el valor como $25.988 (punto de miles, sin decimales)", () => {
    expect(moneyFormatter(25_988)).toBe("$25.988")
    expect(moneyFormatter(1_250_000)).toBe("$1.250.000")
    expect(moneyFormatter(0)).toBe("$0")
    expect(moneyFormatter(null)).toBe("")
  })

  it("lee lo que escribe el dueño, con o sin signo y puntos", () => {
    expect(moneyParser("$25.988")).toBe(25_988)
    expect(moneyParser("25988")).toBe(25_988)
    expect(moneyParser("$ 1.250.000")).toBe(1_250_000)
    expect(moneyParser("")).toBeNull()
  })

  it("ida y vuelta: formatear y leer devuelve el mismo número", () => {
    for (const value of [0, 850, 25_988, 250_000, 1_250_000]) expect(moneyParser(moneyFormatter(value))).toBe(value)
  })

  it("ningún campo usa formatter/parser (Naive UI los ignora; son format/parse)", () => {
    const offending = collectVueFiles(SOURCE_ROOT).filter((file) => /(?::formatter=|:parser=|\bformatter:\s*money|\bparser:\s*money)/.test(readFileSync(file, "utf8")))
    expect(offending).toEqual([])
  })
})

describe("formatDay", () => {
  it("no corre la fecha un día por la zona horaria", () => {
    expect(formatDay("2026-09-30")).toContain("30")
    expect(formatDay("")).toBe("")
  })
})
