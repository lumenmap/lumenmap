#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const TEMPLATES_DIR = path.join(process.cwd(), ".github", "ISSUE_TEMPLATE");
const ALLOWED_LABELS = new Set(["bug", "enhancement", "documentation", "duplicate", "good first issue", "help wanted", "invalid", "question", "wontfix"]);

function logSuccess(msg) {
  console.log(`  ✓ ${msg}`);
}

function logError(msg) {
  console.error(`  ✕ ${msg}`);
}

function validateConfig() {
  const filePath = path.join(TEMPLATES_DIR, "config.yml");
  if (!fs.existsSync(filePath)) {
    throw new Error("config.yml missing in .github/ISSUE_TEMPLATE/");
  }

  const content = fs.readFileSync(filePath, "utf8");
  const parsed = YAML.parse(content);

  if (parsed.blank_issues_enabled !== false) {
    throw new Error("config.yml must set blank_issues_enabled: false");
  }

  if (!Array.isArray(parsed.contact_links) || parsed.contact_links.length === 0) {
    throw new Error("config.yml must define contact_links for Q&A / discussions");
  }

  for (const link of parsed.contact_links) {
    if (!link.name || !link.url || !link.about) {
      throw new Error("Contact link missing required fields (name, url, about)");
    }
  }

  logSuccess("config.yml validation passed (blank_issues_enabled: false)");
}

function validateBugReport() {
  const filePath = path.join(TEMPLATES_DIR, "bug_report.yml");
  if (!fs.existsSync(filePath)) {
    throw new Error("bug_report.yml missing in .github/ISSUE_TEMPLATE/");
  }

  const content = fs.readFileSync(filePath, "utf8");
  const parsed = YAML.parse(content);

  if (parsed.name !== "Bug Report") {
    throw new Error(`bug_report.yml name must be 'Bug Report', got '${parsed.name}'`);
  }

  if (!Array.isArray(parsed.labels) || !parsed.labels.includes("bug")) {
    throw new Error("bug_report.yml labels must include 'bug'");
  }

  for (const label of parsed.labels) {
    if (!ALLOWED_LABELS.has(label)) {
      throw new Error(`bug_report.yml uses non-existent label '${label}'`);
    }
  }

  const bodyIds = (parsed.body || []).map((item) => item.id).filter(Boolean);
  const requiredIds = ["problem", "reproduction", "expected", "environment"];

  for (const reqId of requiredIds) {
    if (!bodyIds.includes(reqId)) {
      throw new Error(`bug_report.yml missing required field '${reqId}'`);
    }
  }

  logSuccess("bug_report.yml validation passed (reproduction & environment required)");
}

function validateFeatureRequest() {
  const filePath = path.join(TEMPLATES_DIR, "feature_request.yml");
  if (!fs.existsSync(filePath)) {
    throw new Error("feature_request.yml missing in .github/ISSUE_TEMPLATE/");
  }

  const content = fs.readFileSync(filePath, "utf8");
  const parsed = YAML.parse(content);

  if (parsed.name !== "Feature Request") {
    throw new Error(`feature_request.yml name must be 'Feature Request', got '${parsed.name}'`);
  }

  if (!Array.isArray(parsed.labels) || !parsed.labels.includes("enhancement")) {
    throw new Error("feature_request.yml labels must include 'enhancement'");
  }

  for (const label of parsed.labels) {
    if (!ALLOWED_LABELS.has(label)) {
      throw new Error(`feature_request.yml uses non-existent label '${label}'`);
    }
  }

  const bodyIds = (parsed.body || []).map((item) => item.id).filter(Boolean);
  const requiredIds = ["problem", "solution_scope", "verifiable_outcome"];

  for (const reqId of requiredIds) {
    if (!bodyIds.includes(reqId)) {
      throw new Error(`feature_request.yml missing required field '${reqId}'`);
    }
  }

  logSuccess("feature_request.yml validation passed (verifiable outcome required)");
}

function validateEntityLabelProposal() {
  const filePath = path.join(TEMPLATES_DIR, "entity_label_proposal.yml");
  const parsed = YAML.parse(fs.readFileSync(filePath, "utf8"));
  if (parsed.name !== "Entity Label Proposal") {
    throw new Error("entity_label_proposal.yml must be named 'Entity Label Proposal'");
  }
  const requiredIds = ["address", "name", "category", "protocol", "tag", "proof_links", "change_reason"];
  for (const id of requiredIds) {
    const field = parsed.body?.find((item) => item.id === id);
    if (!field || field.validations?.required !== true) {
      throw new Error(`entity_label_proposal.yml requires '${id}'`);
    }
  }
  logSuccess("entity_label_proposal.yml validation passed (address, label, and proof required)");
}

function main() {
  console.log("\n📋 Validating GitHub Issue Templates...");
  let errors = 0;

  try {
    validateConfig();
  } catch (err) {
    logError(err.message);
    errors++;
  }

  try {
    validateBugReport();
  } catch (err) {
    logError(err.message);
    errors++;
  }

  try {
    validateFeatureRequest();
  } catch (err) {
    logError(err.message);
    errors++;
  }

  try {
    validateEntityLabelProposal();
  } catch (err) {
    logError(err.message);
    errors++;
  }

  if (errors > 0) {
    console.error(`\n✕ Template validation failed with ${errors} error(s).\n`);
    process.exit(1);
  }

  console.log("\n✓ All GitHub issue template validations passed successfully!\n");
}

main();
