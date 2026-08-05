#!/usr/bin/env node

const DEFAULT_REQUIRED_CHECKS = ["quality"];

const owner = process.env.GITHUB_OWNER ?? "lumenmap";
const repo = process.env.GITHUB_REPO ?? "lumenmap";
const branch = process.env.PROTECTED_BRANCH ?? "main";
const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
const apiVersion = process.env.GITHUB_API_VERSION ?? "2026-03-10";
const requiredChecks = (process.env.REQUIRED_CHECKS ?? DEFAULT_REQUIRED_CHECKS.join(","))
  .split(",")
  .map((check) => check.trim())
  .filter(Boolean);
const dryRun = process.argv.includes("--dry-run");

if (!token && !dryRun) {
  console.error("Set GITHUB_TOKEN or GH_TOKEN with repository Administration:write permission.");
  process.exit(1);
}

if (requiredChecks.length === 0) {
  console.error("At least one required check is needed. Set REQUIRED_CHECKS as a comma-separated list.");
  process.exit(1);
}

const protection = {
  required_status_checks: {
    strict: true,
    contexts: requiredChecks,
  },
  enforce_admins: true,
  required_pull_request_reviews: {
    dismiss_stale_reviews: true,
    require_code_owner_reviews: false,
    required_approving_review_count: 1,
    require_last_push_approval: false,
  },
  restrictions: null,
  required_linear_history: false,
  allow_force_pushes: false,
  allow_deletions: false,
  block_creations: false,
  required_conversation_resolution: true,
  lock_branch: false,
  allow_fork_syncing: true,
};

if (dryRun) {
  console.log(JSON.stringify(protection, null, 2));
  process.exit(0);
}

const baseUrl = `https://api.github.com/repos/${owner}/${repo}`;

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-GitHub-Api-Version": apiVersion,
      ...options.headers,
    },
  });

  const text = await response.text();
  const body = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail = body?.message ? `: ${body.message}` : "";
    throw new Error(`${options.method ?? "GET"} ${path} failed with ${response.status}${detail}`);
  }

  return body;
};

await request(`/branches/${encodeURIComponent(branch)}/protection`, {
  method: "PUT",
  body: JSON.stringify(protection),
});

const activeProtection = await request(`/branches/${encodeURIComponent(branch)}/protection`);

console.log(
  JSON.stringify(
    {
      branch,
      requiredChecks,
      activeProtection,
    },
    null,
    2,
  ),
);
