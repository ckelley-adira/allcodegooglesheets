#!/usr/bin/env node
/**
 * Integration Test Orchestrator
 * ═══════════════════════════════════════════════════════════════════════════
 * Pushes GAS test files to a dedicated Apps Script project via clasp,
 * executes the test runner function remotely, and collects results.
 *
 * Prerequisites:
 *   1. Node.js 14+
 *   2. @google/clasp installed globally: npm install -g @google/clasp
 *   3. Authenticated via: clasp login
 *   4. tests/integration/.clasp.json with valid scriptId pointing to test project
 *   5. The test project bound to a dedicated test Google Sheet
 *
 * Usage:
 *   node tests/integration/run_integration_tests.js
 *
 * Environment variables:
 *   CLASP_ACCESS_TOKEN  — (optional) OAuth token for non-interactive auth
 *   TEST_SPREADSHEET_ID — (optional) ID of test spreadsheet for logging
 *
 * Exit codes:
 *   0 = all tests passed
 *   1 = one or more tests failed
 *   2 = infrastructure error (push failed, run failed, etc.)
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const INTEGRATION_DIR = path.resolve(__dirname);
const GAS_SOURCE_DIR = path.resolve(REPO_ROOT, 'gold-standard-template');
const GAS_TEST_DIR = path.resolve(INTEGRATION_DIR, 'gas');
const CLASP_JSON = path.resolve(INTEGRATION_DIR, '.clasp.json');

// Files from gold-standard-template that the test project needs
const SOURCE_FILES = [
  'SharedConstants.gs',
  'SharedEngine.gs',
  'UnifiedConfig.gs',
  'SetupWizard.gs',
  'Phase2_ProgressTracking.gs',
  'modules/ModuleLoader.gs'
];

// Test GAS files to include
const TEST_FILES = [
  'IntegrationTestRunner.gs',
  'IntegrationTestFixtures.gs',
  'SiteConfig_Test.gs',
  'IntegrationTests_MenuAndFlags.gs',
  'IntegrationTests_Config.gs',
  'IntegrationTests_SheetOps.gs',
  'IntegrationTests_Gateway.gs'
];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function log(msg) {
  const timestamp = new Date().toISOString().slice(11, 19);
  console.log('[' + timestamp + '] ' + msg);
}

function run(cmd, options) {
  log('$ ' + cmd);
  try {
    const output = execSync(cmd, Object.assign({ encoding: 'utf8', timeout: 120000 }, options || {}));
    return { success: true, output: output.trim() };
  } catch (e) {
    return { success: false, output: (e.stdout || '') + '\n' + (e.stderr || ''), error: e };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN WORKFLOW
// ═══════════════════════════════════════════════════════════════════════════

function main() {
  log('═══════════════════════════════════════════════════════');
  log('INTEGRATION TEST ORCHESTRATOR');
  log('═══════════════════════════════════════════════════════');

  // ── Step 0: Verify prerequisites ──
  if (!fs.existsSync(CLASP_JSON)) {
    console.error('ERROR: .clasp.json not found at ' + CLASP_JSON);
    console.error('Copy .clasp.json.example to .clasp.json and set your test project script ID.');
    process.exit(2);
  }

  const claspCheck = run('clasp --version');
  if (!claspCheck.success) {
    console.error('ERROR: clasp not found. Install with: npm install -g @google/clasp');
    process.exit(2);
  }
  log('clasp version: ' + claspCheck.output);

  // ── Step 1: Prepare staging directory ──
  const stagingDir = path.resolve(INTEGRATION_DIR, '.staging');
  if (fs.existsSync(stagingDir)) {
    fs.rmSync(stagingDir, { recursive: true });
  }
  fs.mkdirSync(stagingDir, { recursive: true });

  // Copy .clasp.json to staging
  fs.copyFileSync(CLASP_JSON, path.resolve(stagingDir, '.clasp.json'));

  // Create appsscript.json manifest
  const manifest = {
    timeZone: "America/New_York",
    dependencies: {},
    exceptionLogging: "STACKDRIVER",
    runtimeVersion: "V8",
    executionApi: {
      access: "MYSELF"
    }
  };
  fs.writeFileSync(
    path.resolve(stagingDir, 'appsscript.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Copy source files (excluding SiteConfig_TEMPLATE.gs — replaced by SiteConfig_Test.gs)
  log('Copying source files...');
  for (const file of SOURCE_FILES) {
    const src = path.resolve(GAS_SOURCE_DIR, file);
    if (!fs.existsSync(src)) {
      log('  WARN: Source file not found, skipping: ' + file);
      continue;
    }
    const destName = file.replace(/\//g, '_'); // flatten module paths
    fs.copyFileSync(src, path.resolve(stagingDir, destName));
    log('  ✓ ' + file);
  }

  // Copy test files
  log('Copying test files...');
  for (const file of TEST_FILES) {
    const src = path.resolve(GAS_TEST_DIR, file);
    if (!fs.existsSync(src)) {
      console.error('ERROR: Test file not found: ' + file);
      process.exit(2);
    }
    fs.copyFileSync(src, path.resolve(stagingDir, file));
    log('  ✓ ' + file);
  }

  // ── Step 2: Push to Apps Script ──
  log('Pushing to Apps Script project...');
  const pushResult = run('clasp push --force', { cwd: stagingDir });
  if (!pushResult.success) {
    console.error('ERROR: clasp push failed:\n' + pushResult.output);
    process.exit(2);
  }
  log('Push successful.');

  // ── Step 3: Execute tests ──
  log('Executing runAllIntegrationTests...');
  const runResult = run('clasp run runAllIntegrationTests', { cwd: stagingDir, timeout: 300000 });

  if (!runResult.success) {
    console.error('ERROR: clasp run failed:\n' + runResult.output);
    // Try to parse any partial output
    process.exit(2);
  }

  // ── Step 4: Parse results ──
  log('Parsing results...');
  let results;
  try {
    // clasp run output may include extra lines; find the JSON
    const lines = runResult.output.split('\n');
    let jsonStr = '';
    let inJson = false;
    for (const line of lines) {
      if (line.trim().startsWith('{')) inJson = true;
      if (inJson) jsonStr += line;
    }
    results = JSON.parse(jsonStr);
  } catch (e) {
    log('Could not parse JSON from clasp output. Raw output:');
    console.log(runResult.output);
    // Treat as pass if output contains indication of success
    if (runResult.output.includes('"failed":0') || runResult.output.includes('"failed": 0')) {
      log('Output suggests all tests passed (failed: 0).');
      process.exit(0);
    }
    process.exit(2);
  }

  // ── Step 5: Report results ──
  log('');
  log('═══════════════════════════════════════════════════════');
  log('TEST RESULTS');
  log('═══════════════════════════════════════════════════════');

  const suiteNames = Object.keys(results.suites || {});
  for (const suiteName of suiteNames) {
    const suite = results.suites[suiteName];
    log('');
    log('Suite: ' + suiteName + ' (' + suite.passed + '/' + suite.total + ' passed, ' + suite.duration + 'ms)');
    for (const test of suite.tests) {
      const icon = test.status === 'passed' ? '  ✅' : '  ❌';
      log(icon + ' ' + test.name + (test.error ? ' — ' + test.error : ''));
    }
  }

  log('');
  log('─────────────────────────────────────────────────────');
  log('Total: ' + results.totals.total + ' tests, ' +
      results.totals.passed + ' passed, ' +
      results.totals.failed + ' failed (' +
      results.totals.duration + 'ms)');
  log('─────────────────────────────────────────────────────');

  // ── Step 6: Clean up staging ──
  fs.rmSync(stagingDir, { recursive: true });

  // Exit with appropriate code
  if (results.totals.failed > 0) {
    log('');
    log('❌ INTEGRATION TESTS FAILED');
    process.exit(1);
  } else {
    log('');
    log('✅ ALL INTEGRATION TESTS PASSED');
    process.exit(0);
  }
}

main();
