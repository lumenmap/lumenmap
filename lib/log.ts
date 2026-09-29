export type LogLevel = "info" | "warn" | "error";
export type ErrorClass = "timeout" | "cost_limit" | "provider" | "validation";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  correlationId: string;
  durationMs?: number;
  period?: string;
  queryName?: string;
  rowCount?: number;
  bytesBilled?: number;
  cacheHit?: boolean;
  errorClass?: ErrorClass;
  errorMessage?: string;
  start?: string;
  end?: string;
  assetMode?: string;
  network?: string;
  edgeCount?: number;
}

export function createCorrelationId(): string {
  return crypto.randomUUID();
}

export function startTimer(): [number, number] {
  return process.hrtime();
}

export function endTimer(start: [number, number]): number {
  const [seconds, nanos] = process.hrtime(start);
  return Math.round(seconds * 1000 + nanos / 1_000_000);
}

function emit(entry: LogEntry): void {
  const line = JSON.stringify(entry);
  if (entry.level === "error") {
    console.error(line);
  } else {
    console.log(line);
  }
}

export function logInfo(fields: Omit<LogEntry, "timestamp" | "level">): void {
  emit({ timestamp: new Date().toISOString(), level: "info", ...fields });
}

export function logWarn(fields: Omit<LogEntry, "timestamp" | "level">): void {
  emit({ timestamp: new Date().toISOString(), level: "warn", ...fields });
}

export function logError(fields: Omit<LogEntry, "timestamp" | "level">): void {
  emit({ timestamp: new Date().toISOString(), level: "error", ...fields });
}

export function classifyError(error: unknown): ErrorClass {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("credentials are required") ||
    lower.includes("not configured") ||
    lower.includes("invalid grant") ||
    lower.includes("invalid authentication") ||
    lower.includes("invalid parameter") ||
    lower.includes("invalid value")
  ) {
    return "validation";
  }

  if (
    lower.includes("deadline exceeded") ||
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("deadline_exceeded")
  ) {
    return "timeout";
  }

  if (
    lower.includes("quota exceeded") ||
    lower.includes("rate exceeded") ||
    lower.includes("billing") ||
    lower.includes("cost exceeded") ||
    lower.includes("exceeded")
  ) {
    return "cost_limit";
  }

  return "provider";
}
