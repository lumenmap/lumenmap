#!/usr/bin/env node
/**
 * Smoke check for deployed LumenMap environments.
 * Usage: node scripts/smoke-check.mjs <deployment-url>
 * Exits 0 on success, 1 on failure.
 * Timeouts: 10s per request.
 * No sensitive data in diagnostics.
 */

const TIMEOUT_MS = 10000;

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timeout);
    return res;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${TIMEOUT_MS}ms`);
    }
    throw err;
  }
}

async function checkHomepage(baseUrl) {
  const url = baseUrl.replace(/\/$/, '');
  const res = await fetchWithTimeout(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Homepage: HTTP ${res.status}`);
  }
  const html = await res.text();
  if (!html.includes('<html') && !html.includes('<!DOCTYPE')) {
    throw new Error('Homepage: Invalid HTML response');
  }
  return 'Homepage OK';
}

async function checkHealth(baseUrl) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/health`;
  const res = await fetchWithTimeout(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Health: HTTP ${res.status}`);
  }
  const json = await res.json();
  if (typeof json.status !== 'string' || json.status !== 'ok') {
    throw new Error('Health: Invalid schema (expected {status:"ok"})');
  }
  return 'Health OK';
}

async function checkActivity(baseUrl) {
  // Updated to use the versioned endpoint per requirements
  const url = `${baseUrl.replace(/\/$/, '')}/api/v1/activity?period=1d`;
  const res = await fetchWithTimeout(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Activity: HTTP ${res.status}`);
  }
  const json = await res.json();
  
  // Validate schema including minimal treemap payload structure (treemaps.events.children)
  if (
    !json.period ||
    json.period !== '1d' ||
    !json.kpis ||
    typeof json.kpis.totalOps !== 'number' ||
    !json.treemaps ||
    !json.treemaps.events ||
    !Array.isArray(json.treemaps.events.children)
  ) {
    throw new Error('Activity: Invalid schema or missing treemap children payload');
  }
  return 'Activity OK';
}

async function runSmoke(deploymentUrl) {
  if (!deploymentUrl || !deploymentUrl.startsWith('http')) {
    console.error('Usage: node scripts/smoke-check.mjs <https://deployment-url>');
    process.exit(1);
  }

  console.log(`Running smoke check on: ${deploymentUrl}`);

  let isHealthGreen = false;
  let healthError = null;
  let activityOk = false;
  let activityError = null;

  const failures = [];

  // 1. Check Homepage
  try {
    const res = await checkHomepage(deploymentUrl);
    console.log(`✓ ${res}`);
  } catch (err) {
    const msg = `homepage: ${err.message}`;
    console.error(`✗ ${msg}`);
    failures.push(msg);
  }

  // 2. Check Health
  try {
    const res = await checkHealth(deploymentUrl);
    console.log(`✓ ${res}`);
    isHealthGreen = true;
  } catch (err) {
    healthError = err.message;
    const msg = `health: ${healthError}`;
    console.error(`✗ ${msg}`);
    failures.push(msg);
  }

  // 3. Check Activity
  try {
    const res = await checkActivity(deploymentUrl);
    console.log(`✓ ${res}`);
    activityOk = true;
  } catch (err) {
    activityError = err.message;
    const msg = `activity: ${activityError}`;
    console.error(`✗ ${msg}`);
    failures.push(msg);
  }

  // Split-brain check: Health is green (200) while activity failed
  if (isHealthGreen && !activityOk) {
    const splitBrainMsg = `Split-brain state detected: /api/health is green, but activity check failed (${activityError})`;
    console.error(`\n🚨 ${splitBrainMsg}`);
    failures.push(splitBrainMsg);
  }

  if (failures.length > 0) {
    console.error('\nSmoke check failed with errors:');
    failures.forEach(f => console.error(`  - ${f}`));
    process.exit(1);
  }

  console.log('\nAll checks passed successfully.');
  process.exit(0);
}

const url = process.argv[2];
runSmoke(url).catch(err => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});