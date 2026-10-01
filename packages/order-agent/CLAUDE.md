# Dominio del sugerido (packages/order-agent)

- Programación funcional: funciones puras, datos inmutables y composición con `pipe`. Sin Supabase, Excel ni fechas del sistema aquí; los efectos quedan en `apps/api`.
- Modelo por niveles: B < PD < T; CM = unidades vendidas desde la última entrega; `EA = PD − (B + CM)` con signo. Entra todo producto con CM > 0. La plata cubre primero la base de todos (el más urgente primero) y luego sube hacia el tope.
- Entrada principal: `planSuggestion` en `src/suggestion/`; agente en `runOrderAgent`. Calendario y bandeja en `src/inbox/`.
- Todo cambio de regla lleva su prueba en vitest: `npm test --workspace packages/order-agent`.
