export type HealthCheck = {
  status: "ok" | "degraded" | "unavailable";
  message?: string;
  dailyBytesBilled?: number;
  dailyBytesRemaining?: number;
  dailyBytesBudget?: number;
  dailyBurnPercent?: number;
  softWarnPercent?: number;
  dailyBurnLine?: string;
};

export type ReadinessHealth = {
  status: "healthy" | "degraded" | "unavailable";
  timestamp?: string;
  checks?: Record<string, HealthCheck>;
};

export async function fetchReadiness(): Promise<ReadinessHealth> {
  const response = await fetch("/api/health?type=readiness", {
    cache: "no-store",
    headers: { accept: "application/json" },
  });

  if (!response.ok && response.status !== 503) {
    throw new Error("HEALTH_REQUEST_FAILED");
  }

  const body = (await response.json()) as ReadinessHealth;
  if (!(["healthy", "degraded", "unavailable"] as const).includes(body.status)) {
    throw new Error("INVALID_HEALTH_RESPONSE");
  }
  return body;
}

export type IncidentKind = "credentials-missing" | "degraded" | "down";

export type IncidentState = {
  kind: IncidentKind;
  title: string;
  message: string;
};

const CREDENTIALS_MISSING = "credentials are not configured";

export function classifyIncident(
  health: ReadinessHealth | null | undefined,
  requestFailed = false,
): IncidentState | null {
  if (requestFailed) {
    return {
      kind: "down",
      title: "Status checks are temporarily unavailable",
      message:
        "LumenMap could not confirm upstream health. Live charts may be incomplete until the status check recovers.",
    };
  }

  if (!health || health.status === "healthy") return null;

  const credentialsMissing = Object.values(health.checks ?? {}).some((check) =>
    check.message?.toLowerCase().includes(CREDENTIALS_MISSING),
  );

  if (credentialsMissing) {
    return {
      kind: "credentials-missing",
      title: "Live data credentials are not configured",
      message:
        "This environment can use local fixtures, but live upstream charts are unavailable until credentials are configured.",
    };
  }

  if (health.status === "degraded") {
    return {
      kind: "degraded",
      title: "Live data is partially degraded",
      message:
        "One or more upstream checks are failing. Some charts may be stale or incomplete while the incident continues.",
    };
  }

  return {
    kind: "down",
    title: "Live data is temporarily unavailable",
    message:
      "A required upstream service is down. Avoid relying on live charts until the readiness check recovers.",
  };
}
