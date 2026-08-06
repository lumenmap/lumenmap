/**
 * Retrieves the maximum bytes billed limit from the environment.
 *
 * Environment Variable: `BIGQUERY_MAX_BYTES_BILLED`
 * - Units: Bytes
 * - Default: 1,073,741,824 (1 GB)
 * - Safe Bounds: Minimum 1 byte, Maximum 109,951,162,776 bytes (100 GB)
 *
 * If the environment variable is missing, invalid (not a number, non-integer, or <= 0),
 * it falls back to the safe default of 1,073,741,824 bytes (1 GB).
 */
export function getMaxBytesBilledLimit(): number {
  const valueStr = process.env.BIGQUERY_MAX_BYTES_BILLED;

  if (valueStr === undefined || valueStr === "") {
    return 1073741824; // 1 GB safe default
  }

  const value = Number(valueStr);

  // Validate that the value is an integer and within the safe bounds
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > 109951162776
  ) {
    console.warn(
      `Invalid BIGQUERY_MAX_BYTES_BILLED value: "${valueStr}". ` +
        `Expected an integer between 1 and 109951162776. ` +
        `Falling back to safe default of 1073741824 (1 GB).`
    );
    return 1073741824;
  }

  return value;
}
