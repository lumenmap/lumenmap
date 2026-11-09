#!/usr/bin/env node
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const STORIES = [
  {
    id: "dashboard-kpicards--loaded",
    component: "KpiCards",
    title: "Dashboard/KpiCards/Loaded",
    state: "loaded",
    fixtureOnly: true,
    description: "Renders KPI strip with deterministic fixture totals and sparkline buckets.",
  },
  {
    id: "dashboard-kpicards--loading",
    component: "KpiCards",
    title: "Dashboard/KpiCards/Loading",
    state: "loading",
    fixtureOnly: true,
    description: "Renders KPI skeleton placeholders while fixture query loads.",
  },
  {
    id: "dashboard-kpicards--empty-unavailable",
    component: "KpiCards",
    title: "Dashboard/KpiCards/EmptyUnavailable",
    state: "empty",
    fixtureOnly: true,
    description: "Renders Unavailable badges when optional KPI values are null or omitted.",
  },
  {
    id: "dashboard-treemapmetricselector--default",
    component: "TreemapMetricSelector",
    title: "Dashboard/TreemapMetricSelector/Default",
    state: "loaded",
    fixtureOnly: true,
    description: "Accessible toggle group for Operation Count, XLM Volume, USDC Volume, and Protocol TVL.",
  },
  {
    id: "dashboard-periodselector--default",
    component: "PeriodSelector",
    title: "Dashboard/PeriodSelector/Default",
    state: "loaded",
    fixtureOnly: true,
    description: "Keyboard-roving radio group for 1d, 7d, 30d, and month periods with comparison selector.",
  },
  {
    id: "dashboard-detailpanel--selected-account",
    component: "DetailPanel",
    title: "Dashboard/DetailPanel/SelectedAccount",
    state: "loaded",
    fixtureOnly: true,
    description: "Displays selected Stellar account metadata, fixture first-seen timestamp, and Explorer link.",
  },
  {
    id: "dashboard-detailpanel--empty",
    component: "DetailPanel",
    title: "Dashboard/DetailPanel/Empty",
    state: "empty",
    fixtureOnly: true,
    description: "Empty prompt when no treemap tile or flow entity is currently selected.",
  },
  {
    id: "dashboard-flowview--loaded",
    component: "FlowView",
    title: "Dashboard/FlowView/Loaded",
    state: "loaded",
    fixtureOnly: true,
    description: "Payment Flow canvas and data table populated from deterministic fixture edges.",
  },
  {
    id: "dashboard-flowview--empty",
    component: "FlowView",
    title: "Dashboard/FlowView/Empty",
    state: "empty",
    fixtureOnly: true,
    description: "Empty FlowView state with zero edges and disabled CSV export button.",
  },
  {
    id: "dashboard-flowview--loading",
    component: "FlowView",
    title: "Dashboard/FlowView/Loading",
    state: "loading",
    fixtureOnly: true,
    description: "Loading skeleton state for FlowView before fixture graph edges resolve.",
  },
  {
    id: "dashboard-flowview--error",
    component: "FlowView",
    title: "Dashboard/FlowView/Error",
    state: "error",
    fixtureOnly: true,
    description: "Error state when payment flow query fails and surfaces fixture fallback guidance.",
  },
];

function renderIndexHtml() {
  const rows = STORIES.map(
    (s) =>
      `<tr><td><code>${s.component}</code></td><td>${s.title}</td><td><span class="badge ${s.state}">${s.state}</span></td><td>${s.description}</td></tr>`,
  ).join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>LumenMap Dashboard Storybook (Fixture Mode)</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #09090b; color: #f4f4f5; margin: 2rem; }
    table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
    th, td { text-align: left; padding: 0.75rem; border-bottom: 1px solid #27272a; }
    .badge { padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; text-transform: uppercase; background: #27272a; }
  </style>
</head>
<body>
  <h1>LumenMap Component Workbench (Fixture-Only Storybook)</h1>
  <p>${STORIES.length} isolated stories covering KpiCards, TreemapMetricSelector, PeriodSelector, DetailPanel, and FlowView.</p>
  <table>
    <thead>
      <tr><th>Component</th><th>Story</th><th>State</th><th>Description</th></tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
</body>
</html>`;
}

const mode = process.argv[2] ?? "dev";
const outDir = path.resolve(process.cwd(), "storybook-static");

if (mode === "build") {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "stories.json"),
    JSON.stringify({ v: 4, stories: STORIES }, null, 2),
  );
  fs.writeFileSync(path.join(outDir, "index.html"), renderIndexHtml());
  console.log(`Built ${STORIES.length} fixture stories to ${outDir}`);
  process.exit(0);
}

const port = Number(process.env.STORYBOOK_PORT ?? 6006);
const server = http.createServer((req, res) => {
  if (req.url === "/stories.json") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ v: 4, stories: STORIES }, null, 2));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(renderIndexHtml());
});

server.listen(port, "127.0.0.1", () => {
  console.log(`LumenMap Storybook listening on http://127.0.0.1:${port}`);
});
