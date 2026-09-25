/**
 * Conventional Commits: <tipo>(<alcance opcional>): <descripción>
 *   feat(web): tabla de proveedores con paginación
 *   fix(api): la ruta de pagos devuelve 404 si el pedido no existe
 * Lo valida husky en cada commit (.husky/commit-msg).
 */
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    // Alcances del monorepo. Solo advierte: se puede usar otro si hace falta.
    "scope-enum": [
      1,
      "always",
      ["web", "api", "agent", "db", "types", "deps", "config", "docs", "release"],
    ],
    // Las descripciones van en español y pueden llevar nombres propios (Supabase, Naive UI…).
    "subject-case": [0],
    "body-max-line-length": [1, "always", 120],
  },
}
