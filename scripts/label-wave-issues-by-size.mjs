#!/usr/bin/env node

import { spawnSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const apply = args.has("--apply");
const repo = process.env.GITHUB_REPOSITORY ?? "lumenmap/lumenmap";
const sizeLabels = new Set(["size:S", "size:M", "size:L"]);

function runGh(commandArgs, options = {}) {
  const result = spawnSync("gh", commandArgs, {
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
  });

  if (result.error || result.status !== 0) {
    const detail = result.stderr?.trim() || result.error?.message || "unknown gh error";
    throw new Error(`gh ${commandArgs.join(" ")} failed: ${detail}`);
  }

  return result.stdout ?? "";
}

export function suggestWaveSize(issue) {
  const text = `${issue.title}\n${issue.body ?? ""}`.toLowerCase();
  const length = text.length;
  const largeSignals = [
    "bigquery",
    "hubble query",
    "schema change",
    "data pipeline",
    "visual regression",
    "storybook",
    "build tooling",
  ];
  const mediumSignals = [
    "component",
    "new route",
    "panel",
    "accessibility",
    "a11y",
    "fixture",
    "unit test",
    "api route",
  ];

  if (length >= 1_800 || largeSignals.some((signal) => text.includes(signal))) {
    return {
      label: "size:L",
      reason: length >= 1_800 ? "long body (>=1800 characters)" : "large-scope keyword",
    };
  }

  if (length >= 800 || mediumSignals.some((signal) => text.includes(signal))) {
    return {
      label: "size:M",
      reason: length >= 800 ? "medium body (>=800 characters)" : "component/a11y/test keyword",
    };
  }

  return { label: "size:S", reason: "short, focused issue with no large-scope keyword" };
}

function existingSize(issue) {
  return issue.labels
    .map((label) => (typeof label === "string" ? label : label.name))
    .find((label) => sizeLabels.has(label));
}

function main() {
  // `gh auth status` returns non-zero when any stored secondary account is
  // invalid, even if the active account is healthy. Probe the authenticated
  // API instead so only the credentials used by this command decide success.
  runGh(["api", "user", "--jq", ".login"], { capture: true });

  const raw = runGh(
    [
      "issue",
      "list",
      "--repo",
      repo,
      "--state",
      "open",
      "--label",
      "Stellar Wave",
      "--limit",
      "100",
      "--json",
      "number,title,body,labels,url",
    ],
    { capture: true },
  );
  const issues = JSON.parse(raw);

  if (issues.length === 0) {
    console.log(`No open Stellar Wave issues found in ${repo}.`);
    return;
  }

  console.log(`${apply ? "Applying" : "Dry run:"} size suggestions for ${issues.length} open Wave issues in ${repo}`);

  for (const issue of issues) {
    const current = existingSize(issue);
    if (current) {
      console.log(`skip #${issue.number}: already has ${current}`);
      continue;
    }

    const suggestion = suggestWaveSize(issue);
    console.log(`${apply ? "apply" : "plan"} #${issue.number}: ${suggestion.label} (${suggestion.reason})`);

    if (apply) {
      runGh([
        "issue",
        "edit",
        String(issue.number),
        "--repo",
        repo,
        "--add-label",
        suggestion.label,
      ]);
    }
  }

  if (!apply) {
    console.log("No labels changed. Re-run with --apply after a maintainer reviews the suggestions.");
  }
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

