# SuperPedido

Agente determinista (sin modelos de IA) que deja listo el pedido sugerido de cada proveedor de una tienda de barrio.

## Proyecto
- `apps/api`: Express 5 + zod + Supabase. `apps/web`: Vue 3 + Naive UI + Pinia (reglas en `apps/web/CLAUDE.md`).
- `packages/order-agent`: dominio puro del sugerido y el agente (reglas en `packages/order-agent/CLAUDE.md`).
- `packages/database-types`: tipos de Supabase; tras cambiarlos, `npm run build --workspace packages/database-types`.
- Migraciones en `supabase/migrations`; se aplican con `supabase db push --dry-run` y luego `supabase db push`.
- Reglas de negocio del dueño: `docs/mapa-del-agente.md`.

## Comandos
- `npm run dev:api` / `npm run dev:web`
- `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` (por paquete: `--workspace <ruta>`).

## Restricciones
- No hacer commit ni push sin que el usuario lo pida; conventional commits.
- No subir `.env` ni secretos. No borrar datos reales (ventas, pedidos) sin preguntar.

## Gestión del contexto
- Cada tarea arranca con la ventana limpia (`/clear`). Al empezar, leer `docs/pendientes.md`; al terminar, actualizarlo con lo hecho y lo pendiente.
- Entender la tarea antes de tocar archivos; identificar qué información hace falta antes de buscar.
- Buscar según la regla de la sección graphify: lo específico con `grep`, lo general con graphify.
- Leer solo los archivos y fragmentos pertinentes; no leer archivos completos si basta una función o sección, ni explorar directorios ajenos a la tarea.
- Antes de leer un archivo grande, tener claro por qué se necesita su contenido. Seguir una dependencia solo hasta donde haga falta.
- Filtrar la salida de terminal: mostrar el error relevante o el resumen (`grep`, `head`), no salidas completas.
- Investigaciones amplias (muchos archivos, registros, dependencias): delegarlas a un subagente que devuelva solo diagnóstico, archivos relevantes, evidencia y solución propuesta, sin modificar nada.
- No repetir información que ya está en la conversación; conservar las decisiones y restricciones importantes.

## Ejecución
- Cambios pequeños y verificables.
- Ejecutar typecheck, lint y las pruebas del paquete afectado.
- Informar qué archivos se modificaron y qué se verificó (y qué no).

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

### Regla: específico → grep, general → graphify

| Tipo de búsqueda | Herramienta |
|---|---|
| **Específica**: un texto, nombre de función, variable, componente, ruta de API, mensaje de error o clave de `es.ts` ya conocidos | `grep` (una llamada, sin gastar contexto de más) |
| **General**: «¿dónde se hace X?», «¿cómo se conecta X con Y?», «¿qué interviene en…?», «¿qué depende de esta función?», arquitectura o código relacionado con `docs/` | `graphify query` / `graphify path "<A>" "<B>"` / `graphify explain "<concepto>"` |

**Flujo:**
1. Si ya se sabe qué nombre o texto buscar, `grep` directo.
2. Si no se sabe dónde está o la pregunta es de relaciones, `graphify query` primero. Si sale recortada o con ruido, acotar con `--budget`, `explain` o `path`.
3. Con el archivo ya señalado, abrir solo el fragmento necesario para editarlo.
4. Leer `graphify-out/GRAPH_REPORT.md` solo para una revisión amplia de la arquitectura.
5. Después de cambios grandes, `graphify update .` (solo AST, sin costo de API) para que el grafo no quede desactualizado.

Límites de graphify: cada consulta trae ~2.000 tokens aunque la respuesta sea una línea, y puede dejar fuera la pieza principal (una consulta sobre el sugerido por niveles mostró 48 de 140 nodos y no incluyó `planSuggestion`).
