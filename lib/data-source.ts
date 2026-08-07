export type DataSourceMode = "live" | "fixture";

const FIXTURE_ENV = "LUMENMAP_DATA_SOURCE";

/**
 * Resolves the activity data source.
 * Fixture mode is opt-in only and never allowed in production runtimes.
 */
export function resolveDataSource(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): DataSourceMode {
  const raw = (env[FIXTURE_ENV] ?? "live").trim().toLowerCase();

  if (raw === "fixture") {
    if (env.NODE_ENV === "production" || env.VERCEL_ENV === "production") {
      throw new Error(
        `${FIXTURE_ENV}=fixture is not allowed in production. Fixture data is for local development and tests only.`,
      );
    }
    return "fixture";
  }

  if (raw === "live" || raw === "" || raw === "hubble") {
    return "live";
  }

  throw new Error(
    `Unknown ${FIXTURE_ENV}="${env[FIXTURE_ENV]}". Use "live" (default) or "fixture".`,
  );
}

export function isFixtureMode(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env,
): boolean {
  return resolveDataSource(env) === "fixture";
}
