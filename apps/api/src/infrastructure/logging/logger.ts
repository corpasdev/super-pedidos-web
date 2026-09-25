import pino from "pino"

const rawLevel = process.env.LOG_LEVEL
const level = rawLevel === "fatal" || rawLevel === "error" || rawLevel === "warn" || rawLevel === "debug" || rawLevel === "trace" || rawLevel === "silent" ? rawLevel : "info"

export const logger = pino({ level })
