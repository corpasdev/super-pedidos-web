import { addDays } from "../formulas/dateTime.js"
import type { Supplier } from "../domain/entities/Supplier.js"
import type { AgentSituation } from "./agentTypes.js"

const toIsoDate = (date: Date): string => date.toISOString()

/** Etapa «Situación»: si el proveedor no tiene calendario, el agente le pregunta al dueño (HU9) en lugar de improvisar. */
export const buildAgentSituation = (supplier: Supplier, today: Date): AgentSituation => {
  if (!supplier.hasSchedule) {
    return {
      stage: "situation",
      visitingToday: false,
      nextOrderDate: null,
      suggestedReportRange: null,
      outcome: "needs_schedule",
    }
  }
  const nextOrderDate = supplier.nextOrderDate(today)
  const visitingToday = supplier.isVisitingOn(today)
  return {
    stage: "situation",
    visitingToday,
    nextOrderDate: toIsoDate(nextOrderDate),
    suggestedReportRange: {
      start: toIsoDate(supplier.lastDeliveryDate(nextOrderDate)),
      end: toIsoDate(addDays(-1)(nextOrderDate)),
    },
    outcome: visitingToday ? "visiting_today" : "scheduled",
  }
}