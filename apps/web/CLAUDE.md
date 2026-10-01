# Web (apps/web)

- Componentes de Naive UI primero; Tailwind solo para lo que Naive no resuelve. Colores y radios en `src/theme/naiveOverrides.ts` y `src/styles.css`.
- Todos los textos en `src/i18n/es.ts` (una prueba prohíbe literales con tildes en los `.vue`). En la interfaz se dice «proveedor», no «vendedor».
- Dinero en COP con `formatMoney`; `n-input-number` usa `format`/`parse` (no `formatter`/`parser`) y los campos numéricos filtran con `presentation/numericInput.ts`.
- Tablas: `presentation/tables.ts` (paginación de 5 y total).
- Todas las stores de Pinia llevan `acceptHMRUpdate`.
- Sin diálogos de confirmación para acciones simples (el dueño los rechazó).
- Verificar: `npm run typecheck --workspace apps/web`, `npx eslint apps/web`, `npm test --workspace apps/web`.
