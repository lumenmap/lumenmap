import { FIXTURE_PERIOD_MULTIPLIERS } from "@/lib/fixtures/raw-data";
import { resolvePeriod } from "@/lib/periods";
import { packageProtocolHealth, type ProtocolHealthResponse } from "@/lib/protocol-health/assemble";
import type { ProtocolHealthRawInput } from "@/lib/protocol-health/score";
import type { Period } from "@/lib/types";

/**
 * Static scorecard sample. Five protocols, including missing TVL and volume.
 * Magnitudes are a one-day illustration scaled by the same period multipliers
 * as the activity fixture. No Hubble or venue calls.
 */
export const PROTOCOL_HEALTH_FIXTURE_INPUTS: ProtocolHealthRawInput[] = [
  {
    protocol: "Soroswap",
    ops: 300_000,
    wallets: 3,
    volumeXlm: 125_000,
    tvlUsd: 15_000_000,
    timeseries: [80, 120, 90, 160, 140],
    entityId: "CA4HEQTL2WPEUYKYKCDOHCDNIV4QHNJ7EL4J4NQ6VADP7SYHVRYZ7AW2",
  },
  {
    protocol: "Kraken",
    ops: 120_000,
    wallets: 1,
    volumeXlm: 40_000,
    tvlUsd: 100_000_000,
    timeseries: [40, 55, 48, 70],
    entityId: "GA5XIGA5C7QTPTWXQHY6MCJRMTRZDOSHR6EFIBNDQTCQHG262N4GGKTM",
  },
  {
    protocol: "LOBSTR",
    ops: 90_000,
    wallets: 1,
    volumeXlm: 22_000,
    tvlUsd: 50_000_000,
    entityId: "GDKJ3ZXB5RA2MV5T2Y3Z5D3D3VKR5F7EFRB2A3BMBC3IHGBOK5GDI2LQ",
  },
  {
    protocol: "MintX",
    ops: 30_000,
    wallets: 2,
    volumeXlm: 4_000,
    tvlUsd: null,
    timeseries: [5, 12, 9, 15],
    entityId: "GBZVELEQD3WBN3R3VAG64HVBDOZ76ZL6QPLSFGKWPFED33Q3234NSLVR",
  },
  {
    protocol: "Orbit",
    ops: 18_000,
    wallets: 4,
    volumeXlm: null,
    tvlUsd: null,
  },
];

function scaleInput(
  input: ProtocolHealthRawInput,
  multiplier: number,
): ProtocolHealthRawInput {
  return {
    ...input,
    ops: input.ops == null ? null : input.ops * multiplier,
    volumeXlm: input.volumeXlm == null ? null : input.volumeXlm * multiplier,
    timeseries: input.timeseries?.map((value) => value * multiplier),
  };
}

export function getFixtureProtocolHealth(period: Period): ProtocolHealthResponse {
  const range = resolvePeriod(period);
  const multiplier = FIXTURE_PERIOD_MULTIPLIERS[period];

  return packageProtocolHealth(
    {
      period,
      start: range.start.toISOString(),
      end: range.end.toISOString(),
      source: "fixture",
      sourceTimestamp: range.end.toISOString(),
      isPeriodComplete: true,
      fixture: true,
    },
    PROTOCOL_HEALTH_FIXTURE_INPUTS.map((input) => scaleInput(input, multiplier)),
  );
}
