import { describe, expect, it, vi } from "vitest"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { moneyInputProps, unitsInputProps } from "../src/presentation/numericInput"

const SOURCE_ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)), "src")

const collectVueFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap((entry) => {
    const path = join(directory, entry)
    return statSync(path).isDirectory() ? collectVueFiles(path) : path.endsWith(".vue") ? [path] : []
  })

/** Simula lo que el navegador manda antes de escribir en el campo. */
const typing = (props: Record<string, unknown>, data: string, inputType = "insertText") => {
  const preventDefault = vi.fn()
  ;(props.onBeforeinput as (event: Event) => void)({ inputType, data, dataTransfer: null, preventDefault } as unknown as Event)
  return preventDefault.mock.calls.length > 0
}

describe("campos numéricos que no aceptan texto", () => {
  it("cantidades: solo dígitos", () => {
    const props = unitsInputProps()
    expect(typing(props, "7")).toBe(false)
    expect(typing(props, "a")).toBe(true)
    expect(typing(props, ".")).toBe(true)
    expect(typing(props, "-")).toBe(true)
    expect(props.inputmode).toBe("numeric")
  })

  it("pesos: dígitos y los caracteres del formato, nada de letras", () => {
    const props = moneyInputProps()
    expect(typing(props, "25.000")).toBe(false)
    expect(typing(props, "$ 25.000", "insertFromPaste")).toBe(false)
    expect(typing(props, "25k")).toBe(true)
    expect(typing(props, "e")).toBe(true)
    for (const letter of "abcdefghijklmnopqrstuvwxyzñ") expect(typing(props, letter)).toBe(true)
    expect(typing(props, "$ 25.000", "insertFromPaste")).toBe(false) // espacio no separable del formato es-CO
  })

  it("borrar siempre se permite", () => {
    expect(typing(unitsInputProps(), "", "deleteContentBackward")).toBe(false)
  })

  it("conserva los props propios del campo (id, etiqueta)", () => {
    expect(moneyInputProps({ id: "caja", "aria-label": "Efectivo" })).toMatchObject({ id: "caja", "aria-label": "Efectivo" })
  })

  it("todo n-input-number de la app usa el filtro", () => {
    const missing = collectVueFiles(SOURCE_ROOT).flatMap((file) => {
      const source = readFileSync(file, "utf8")
      const uses = (source.match(/<n-input-number\b|h\(NInputNumber/g) ?? []).length
      const filtered = (source.match(/(?:money|units)InputProps\(/g) ?? []).length
      return uses > filtered ? [`${file}: ${uses} campos, ${filtered} con filtro`] : []
    })
    expect(missing).toEqual([])
  })
})
