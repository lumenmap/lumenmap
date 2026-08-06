export class BigQueryLimitExceededError extends Error {
  public readonly limit: number;
  public readonly query: string;
  public readonly params: Record<string, unknown>;
  public readonly cause?: Error;

  constructor(
    message: string,
    limit: number,
    query: string,
    params: Record<string, unknown>,
    cause?: Error,
  ) {
    super(message);
    this.name = "BigQueryLimitExceededError";
    this.limit = limit;
    this.query = query;
    this.params = params;
    this.cause = cause;

    // Ensure the prototype chain is correct in ES5/ES6 environments
    Object.setPrototypeOf(this, BigQueryLimitExceededError.prototype);
  }
}

export function isBytesBilledLimitExceededError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const err = error as { message?: string; errors?: Array<{ reason?: string }> };

  if (err.message && err.message.includes("Query exceeded limit for bytes billed")) {
    return true;
  }

  if (Array.isArray(err.errors)) {
    return err.errors.some((e) => e && e.reason === "bytesBilledLimitExceeded");
  }

  return false;
}
