import {
  activityResponseSchema,
  type ActivityResponse,
} from "./activity-response";

const PUBLIC_VALIDATION_ERROR = "Activity response failed validation";

export class ActivityResponseValidationError extends Error {
  readonly path: string;
  readonly diagnostic: string;

  constructor(path: string, message: string) {
    super(`Activity response validation failed at ${path}: ${message}`);
    this.name = "ActivityResponseValidationError";
    this.path = path;
    this.diagnostic = `schema path "${path || "(root)"}": ${message}`;
  }
}

function formatIssuePath(path: PropertyKey[]): string {
  return path
    .map((segment) => String(segment))
    .join(".")
    .replace(/\.(\d+)(?=\.|$)/g, "[$1]");
}

/**
 * Validate activity API output at the server boundary.
 * Throws ActivityResponseValidationError with a path-specific diagnostic.
 * Callers must map this to a safe public error (no payload / provider leak).
 */
export function validateActivityResponse(data: unknown): ActivityResponse {
  const result = activityResponseSchema.safeParse(data);

  if (result.success) {
    return result.data;
  }

  const issue = result.error.issues[0];
  const path = formatIssuePath(issue?.path ?? []);
  const message = issue?.message ?? "Unknown validation error";

  throw new ActivityResponseValidationError(path, message);
}

/** Safe JSON body for clients when validation fails. */
export function publicValidationErrorBody(): { error: string } {
  return { error: PUBLIC_VALIDATION_ERROR };
}

export { PUBLIC_VALIDATION_ERROR };
