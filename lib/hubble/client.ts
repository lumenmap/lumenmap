import { BigQuery } from "@google-cloud/bigquery";

let client: BigQuery | null = null;

export function getBigQueryClient(): BigQuery | null {
  if (client) {
    return client;
  }

  try {
    const keyBase64 = process.env.GCP_SERVICE_ACCOUNT_KEY;
    if (keyBase64) {
      const credentials = JSON.parse(
        Buffer.from(keyBase64, "base64").toString("utf-8"),
      ) as { project_id: string };

      client = new BigQuery({
        projectId: credentials.project_id,
        credentials,
      });
      return client;
    }

    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      client = new BigQuery();
      return client;
    }

    return null;
  } catch {
    return null;
  }
}

export function hasBigQueryCredentials(): boolean {
  return Boolean(
    process.env.GCP_SERVICE_ACCOUNT_KEY ||
      process.env.GOOGLE_APPLICATION_CREDENTIALS,
  );
}

/**
 * Fixture mode serves deterministic local data instead of querying
 * BigQuery. Enabled with `LUMENMAP_DATA_SOURCE=fixture`; used by the
 * Playwright e2e suite and for local development without GCP credentials.
 */
export function isFixtureMode(): boolean {
  return process.env.LUMENMAP_DATA_SOURCE === "fixture";
}
