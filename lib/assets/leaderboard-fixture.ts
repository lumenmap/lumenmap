/** Eight ranked assets plus one row the parser must drop. */
export const ASSET_LEADERBOARD_FIXTURE = [
  { asset: { type: "native", code: "XLM" }, amount: "1000", opCount: 40 },
  { asset: { type: "issued", code: "USDC", issuer: "GUSDCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, amount: "800", opCount: 30 },
  { asset: { type: "issued", code: "USDC", issuer: "GUSDC2AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, amount: "50", opCount: 4 },
  { asset: { type: "issued", code: "EURC", issuer: "GEURCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, amount: "200", opCount: 12 },
  { asset: { type: "issued", code: "AQUA", issuer: "GAQUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, amount: "120", opCount: 9 },
  { asset: { type: "issued", code: "yXLM", issuer: "CYXLMAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, amount: "90", opCount: 7 },
  { asset: { type: "issued", code: "BTC", issuer: "GBTCAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, amount: "40", opCount: 3 },
  { asset: { type: "issued", code: "SRB", issuer: "CSRBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, amount: "15", opCount: 2 },
  { asset: { type: "issued", code: "BAD", issuer: "GBADAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" }, amount: "not-a-number", opCount: 1 },
];
