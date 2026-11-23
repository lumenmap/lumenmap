import { FIXTURE_ACCOUNTS } from "@/lib/fixtures/raw-data";
import type { FlowEdge } from "./graph";

/** The last edge is deliberately outside Kraken's 1-hop neighborhood. */
export const FIXTURE_FLOW_EDGES: FlowEdge[] = [
  {
    id: "kraken-lobstr-xlm",
    source: FIXTURE_ACCOUNTS.kraken,
    destination: FIXTURE_ACCOUNTS.lobstr,
    assetKey: "native:XLM",
    asset: { code: "XLM" },
    amount: "250000000",
    operationCount: 5,
  },
  {
    id: "moneygram-kraken-xlm",
    source: FIXTURE_ACCOUNTS.moneygram,
    destination: FIXTURE_ACCOUNTS.kraken,
    assetKey: "native:XLM",
    asset: { code: "XLM" },
    amount: "80000000",
    operationCount: 2,
  },
  {
    id: "lobstr-unknown-usdc",
    source: FIXTURE_ACCOUNTS.lobstr,
    destination: FIXTURE_ACCOUNTS.unknownA,
    assetKey: "USDC:GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
    asset: { code: "USDC" },
    amount: "400000000",
    operationCount: 2,
  },
  {
    id: "lobstr-unknown-xlm",
    source: FIXTURE_ACCOUNTS.lobstr,
    destination: FIXTURE_ACCOUNTS.unknownA,
    assetKey: "native:XLM",
    asset: { code: "XLM" },
    amount: "10000000",
    operationCount: 1,
  },
];
