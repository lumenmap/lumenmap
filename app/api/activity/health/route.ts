import { NextResponse } from "next/server";
import { getBigQueryClient } from "@/lib/hubble/client";
import { resolveDataSource } from "@/lib/data-source";
import {
  getAccountQueryTypes,
  getDestinationQueryTypes,
  getUsdcPaymentVolumeParams,
  hourlyTimeseriesQuery,
  dailyTimeseriesQuery,
  queryRegistry,
} from "@/lib/hubble/queries";
import { classifyError } from "@/lib/log";

export const dynamic = "force-dynamic";

const PROBE_TIMEOUT_MS = 4_000;
type Probe = (sql: string, params: Record<string, unknown>) => Promise<void>;

type QueryCheck = {
  name: string;
  status: "ok" | "error";
  latencyMs: number;
  errorCode?: string;
};

const queries = [
  ...queryRegistry,
  {
    name: "hourlyTimeseriesQuery",
    sql: hourlyTimeseriesQuery,
    requiredParams: ["start", "end"],
  },
  {
    name: "dailyTimeseriesQuery",
    sql: dailyTimeseriesQuery,
    requiredParams: ["start", "end"],
  },
];

async function dryRun(
  sql: string,
  params: Record<string, unknown>,
): Promise<void> {
  const client = getBigQueryClient();
  if (!client) throw new Error("BigQuery client is not configured");
  await client.createQueryJob({ query: sql, params, dryRun: true, useLegacySql: false });
}

function paramsFor(
  name: string,
  requiredParams: string[],
): Record<string, unknown> {
  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const params: Record<string, unknown> = {};
  if (requiredParams.includes("start")) params.start = start.toISOString();
  if (requiredParams.includes("end")) params.end = end.toISOString();
  if (requiredParams.includes("types")) {
    params.types =
      name === "activeDestinationCountQuery"
        ? getDestinationQueryTypes()
        : getAccountQueryTypes();
  }
  if (requiredParams.includes("assets")) {
    params.assets = getUsdcPaymentVolumeParams();
  }
  if (requiredParams.includes("ids")) {
    params.ids = ["GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF"];
  }
  return params;
}

function errorCode(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "errors" in error &&
    Array.isArray(error.errors) &&
    error.errors.some(
      (item: unknown) =>
        item &&
        typeof item === "object" &&
        "reason" in item &&
        item.reason === "invalidQuery",
    )
  ) {
    return "QUERY_INVALID";
  }
  switch (classifyError(error)) {
    case "timeout":
      return "UPSTREAM_TIMEOUT";
    case "validation":
      return "UPSTREAM_CONFIGURATION_ERROR";
    case "cost_limit":
      return "UPSTREAM_LIMIT";
    default:
      return "UPSTREAM_ERROR";
  }
}

async function checkQuery(
  query: (typeof queries)[number],
  probe: Probe,
): Promise<QueryCheck> {
  const start = Date.now();
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      probe(query.sql, paramsFor(query.name, query.requiredParams)),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("PROBE_TIMEOUT")), PROBE_TIMEOUT_MS);
      }),
    ]);
    return { name: query.name, status: "ok", latencyMs: Date.now() - start };
  } catch (error) {
    return {
      name: query.name,
      status: "error",
      latencyMs: Date.now() - start,
      errorCode:
        error instanceof Error && error.message === "PROBE_TIMEOUT"
          ? "UPSTREAM_TIMEOUT"
          : errorCode(error),
    };
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function handleActivityHealthRequest(probe: Probe = dryRun) {
  try {
    const source = resolveDataSource();
    if (source === "fixture") {
      return NextResponse.json({ status: "healthy", source, queries: [] });
    }

    const checks = await Promise.all(queries.map((query) => checkQuery(query, probe)));
    const healthy = checks.every((check) => check.status === "ok");
    return NextResponse.json(
      { status: healthy ? "healthy" : "unavailable", source, queries: checks },
      { status: healthy ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      {
        status: "unavailable",
        source: "live",
        queries: [],
        errorCode: "UPSTREAM_CONFIGURATION_ERROR",
      },
      { status: 503 },
    );
  }
}

export async function GET() {
  return handleActivityHealthRequest();
}
