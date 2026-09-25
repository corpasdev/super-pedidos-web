/**
 * Repara texto UTF-8 que se leyó como Windows-1252 ("mojibake").
 *
 * Una letra acentuada en UTF-8 son dos bytes: C3 + xx (Ñ = C3 91, ñ = C3 B1, á = C3 A1…).
 * Leídos como Windows-1252, C3 se vuelve "Ã" (o el carácter de reemplazo "�" si se perdió en el camino)
 * y xx se vuelve otro carácter ("‘", "±", "¡"…). Como la regla es fija, se puede deshacer:
 * la letra original es U+00C0 + (xx − 0x80).
 *
 * Caso real del software de ventas: "ALVARO MU�'OZ" (el "‘" llegó además como apóstrofo simple) → "ALVARO MUÑOZ".
 */

/** Carácter Windows-1252 del rango 0x80–0x9F → su byte. (0xA0–0xBF coinciden con Latin-1.) */
const CP1252_HIGH: Record<string, number> = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87, "ˆ": 0x88, "‰": 0x89,
  "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91, "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95,
  "–": 0x96, "—": 0x97, "˜": 0x98, "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
}

/** El apóstrofo simple aparece cuando "‘" (0x91) se normalizó a ASCII: en español casi siempre es la Ñ. */
const ASCII_STANDINS: Record<string, number> = { "'": 0x91 }

const continuationByteOf = (character: string): number | null => {
  const fromCp1252 = CP1252_HIGH[character] ?? ASCII_STANDINS[character]
  if (fromCp1252 !== undefined) return fromCp1252
  const code = character.charCodeAt(0)
  return code >= 0xa0 && code <= 0xbf ? code : null
}

/** "�" o "Ã" seguido del carácter que era el segundo byte de la letra. */
const BROKEN_PAIR = /[�Ã](.)/gu

export const repairMojibake = (text: string): string =>
  text.includes("�") || text.includes("Ã")
    ? text.replace(BROKEN_PAIR, (match, second: string) => {
        const byte = continuationByteOf(second)
        return byte === null ? match : String.fromCharCode(0xc0 + (byte - 0x80))
      })
    : text

/** true si al texto todavía le quedan restos de mojibake que no se pudieron reparar. */
export const hasBrokenCharacters = (text: string): boolean => text.includes("�")
