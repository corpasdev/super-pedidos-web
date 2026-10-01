/** Día de la semana en notación ISO 8601: 1 = lunes … 7 = domingo. */
export enum Weekday {
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
  Sunday = 7,
}

/** "Cada 8 días" en la jerga del negocio equivale a semanal (7 días); "cada 15 días" a quincenal. */
export enum VisitFrequency {
  Weekly = "weekly",
  Biweekly = "biweekly",
}

export enum ReplenishmentMode {
  ReplenishSold = "replenish_sold",
  FillToTarget = "fill_to_target",
  /** Regla anterior del dueño: se pide lo que falta para cubrir la base (base − stock). */
  FillToBase = "fill_to_base",
  /** Modelo actual: niveles B < PD < T y CM; la plata decide si se llega a la base, al tope o hasta donde alcance. */
  Levels = "levels",
}

export enum CostSource {
  Owner = "owner",
  SalesReport = "sales_report",
  Estimated = "estimated",
}

export enum OrderStatus {
  /** Se pide el máximo. */
  Complete = "complete",
  /** Se pide lo que alcanza. */
  WithinBudget = "within_budget",
  AdjustedByOwner = "adjusted_by_owner",
  /** Solo tras ajustes del dueño. */
  OverBudget = "over_budget",
  /** Solo si minimumOrderAmount > 0. */
  BelowMinimum = "below_minimum",
  /** No alcanza ni un empaque, o no llega al mínimo exigido. */
  Postponed = "postponed",
  NothingToOrder = "nothing_to_order",
}