export interface ProtocolSeries {
  protocol: string;
  values: number[];
}

/**
 * Attaches recent metric buckets without dropping leaderboard rows. Invalid or
 * missing samples deliberately become an empty series so the UI can soft-fail.
 */
export function attachProtocolSeries<T extends { protocol: string }>(
  rows: T[],
  series: ProtocolSeries[],
): Array<T & { timeseries: number[] }> {
  const byProtocol = new Map(
    series.map((entry) => [
      entry.protocol.trim().toLowerCase(),
      entry.values.filter(Number.isFinite),
    ]),
  );

  return rows.map((row) => ({
    ...row,
    timeseries: byProtocol.get(row.protocol.trim().toLowerCase()) ?? [],
  }));
}

