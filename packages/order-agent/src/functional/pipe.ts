export type UnaryFunction<Input, Output> = (input: Input) => Output

export function pipe<A>(): UnaryFunction<A, A>
export function pipe<A, B>(f1: UnaryFunction<A, B>): UnaryFunction<A, B>
export function pipe<A, B, C>(f1: UnaryFunction<A, B>, f2: UnaryFunction<B, C>): UnaryFunction<A, C>
export function pipe<A, B, C, D>(
  f1: UnaryFunction<A, B>,
  f2: UnaryFunction<B, C>,
  f3: UnaryFunction<C, D>,
): UnaryFunction<A, D>
export function pipe<A, B, C, D, E>(
  f1: UnaryFunction<A, B>,
  f2: UnaryFunction<B, C>,
  f3: UnaryFunction<C, D>,
  f4: UnaryFunction<D, E>,
): UnaryFunction<A, E>
export function pipe<A, B, C, D, E, F>(
  f1: UnaryFunction<A, B>,
  f2: UnaryFunction<B, C>,
  f3: UnaryFunction<C, D>,
  f4: UnaryFunction<D, E>,
  f5: UnaryFunction<E, F>,
): UnaryFunction<A, F>
export function pipe<A, B, C, D, E, F, G>(
  f1: UnaryFunction<A, B>,
  f2: UnaryFunction<B, C>,
  f3: UnaryFunction<C, D>,
  f4: UnaryFunction<D, E>,
  f5: UnaryFunction<E, F>,
  f6: UnaryFunction<F, G>,
): UnaryFunction<A, G>
export function pipe<A, B, C, D, E, F, G, H>(
  f1: UnaryFunction<A, B>,
  f2: UnaryFunction<B, C>,
  f3: UnaryFunction<C, D>,
  f4: UnaryFunction<D, E>,
  f5: UnaryFunction<E, F>,
  f6: UnaryFunction<F, G>,
  f7: UnaryFunction<G, H>,
): UnaryFunction<A, H>
export function pipe<A, B, C, D, E, F, G, H, I>(
  f1: UnaryFunction<A, B>,
  f2: UnaryFunction<B, C>,
  f3: UnaryFunction<C, D>,
  f4: UnaryFunction<D, E>,
  f5: UnaryFunction<E, F>,
  f6: UnaryFunction<F, G>,
  f7: UnaryFunction<G, H>,
  f8: UnaryFunction<H, I>,
): UnaryFunction<A, I>
export function pipe(...functions: UnaryFunction<unknown, unknown>[]) {
  return (initialValue: unknown) => functions.reduce((accumulated, applyStep) => applyStep(accumulated), initialValue)
}

export const compose = (...functions: Array<UnaryFunction<any, any>>) => (initialValue: unknown) =>
  [...functions].reduce((accumulated, applyStep) => applyStep(accumulated), initialValue)

/**
 * Aplica `step` hasta que `isFinished` sea verdadero.
 * Base de los algoritmos iterativos (F9: reparto de la plata por cobertura).
 */
export const iterateUntil =
  <State>(isFinished: (state: State) => boolean, step: (state: State) => State) =>
  (initialState: State): State => {
    let currentState = initialState
    while (!isFinished(currentState)) currentState = step(currentState)
    return currentState
  }