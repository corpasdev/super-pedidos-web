/**
 * Campos numéricos que no aceptan texto.
 * `n-input-number` de Naive solo valida al salir del campo; con estos `input-props` el `<input>` del navegador
 * bloquea la tecla (o lo pegado) antes de que aparezca, y en el celular abre el teclado numérico.
 */

type InputProps = Record<string, unknown>

/** Solo dígitos: unidades, empaques, niveles. */
const DIGITS_ONLY = /^\d*$/
/** Pesos: dígitos más los caracteres del formato ($, punto de miles y espacios), que el lector de pesos ignora. */
const MONEY_CHARACTERS = /^[\d$.\s]*$/

const insertedText = (event: InputEvent): string => event.data ?? event.dataTransfer?.getData("text") ?? ""

/** Cancela la inserción si trae algún carácter que no está permitido. Borrar y mover el cursor siempre se permite. */
const blockUnless = (allowed: RegExp) => (event: Event): void => {
  const inputEvent = event as InputEvent
  if (!inputEvent.inputType?.startsWith("insert")) return
  if (!allowed.test(insertedText(inputEvent))) inputEvent.preventDefault()
}

const numericBase = (allowed: RegExp): InputProps => ({
  inputmode: "numeric",
  autocomplete: "off",
  onBeforeinput: blockUnless(allowed),
})

/** Cantidades enteras (unidades, empaque, base, punto de pedido, tope): solo dígitos. */
export const unitsInputProps = (extra: InputProps = {}): InputProps => ({ ...numericBase(DIGITS_ONLY), pattern: "[0-9]*", ...extra })

/** Pesos colombianos: dígitos y los caracteres del formato ($25.988). */
export const moneyInputProps = (extra: InputProps = {}): InputProps => ({ ...numericBase(MONEY_CHARACTERS), ...extra })
