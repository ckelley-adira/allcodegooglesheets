// ═══════════════════════════════════════════════════════════════════════════
// INTEGRATION TEST RUNNER - GAS Test Harness
// ═══════════════════════════════════════════════════════════════════════════
// Version: 1.0 - Tier 2 Integration Testing
// Last Updated: February 2026
//
// PURPOSE:
// Lightweight test framework that executes inside the Google Apps Script
// runtime against a dedicated test spreadsheet with fixture data.
// Results are written to a "Test Results" sheet and returned as JSON
// so the CI orchestrator can parse pass/fail status.
//
// USAGE (from Apps Script):
//   runAllIntegrationTests()   — runs every registered suite
//   runTestSuite("MenuTests")  — runs a single suite by name
//
// USAGE (from CI / clasp):
//   clasp run runAllIntegrationTests
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Global test registry. Each suite registers itself here.
 * Structure: { suiteName: [{ name, fn }] }
 */
const TEST_REGISTRY = {};

/**
 * Register a test suite with its test cases.
 * @param {string} suiteName - Name of the test suite
 * @param {Array<{name: string, fn: function}>} tests - Array of test objects
 */
function registerTestSuite(suiteName, tests) {
  TEST_REGISTRY[suiteName] = tests;
}

/**
 * Assertion helpers used by individual test files.
 */
const Assert = {
  /**
   * Assert that a value is truthy.
   * @param {*} value - Value to check
   * @param {string} message - Failure message
   */
  isTrue: function(value, message) {
    if (!value) {
      throw new Error('Assert.isTrue failed: ' + (message || 'Expected truthy value'));
    }
  },

  /**
   * Assert that a value is falsy.
   * @param {*} value - Value to check
   * @param {string} message - Failure message
   */
  isFalse: function(value, message) {
    if (value) {
      throw new Error('Assert.isFalse failed: ' + (message || 'Expected falsy value'));
    }
  },

  /**
   * Assert strict equality.
   * @param {*} actual - Actual value
   * @param {*} expected - Expected value
   * @param {string} message - Failure message
   */
  equals: function(actual, expected, message) {
    if (actual !== expected) {
      throw new Error('Assert.equals failed: ' + (message || '') +
        ' (expected: ' + JSON.stringify(expected) +
        ', actual: ' + JSON.stringify(actual) + ')');
    }
  },

  /**
   * Assert deep equality for objects/arrays.
   * @param {*} actual - Actual value
   * @param {*} expected - Expected value
   * @param {string} message - Failure message
   */
  deepEquals: function(actual, expected, message) {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error('Assert.deepEquals failed: ' + (message || '') +
        ' (expected: ' + JSON.stringify(expected) +
        ', actual: ' + JSON.stringify(actual) + ')');
    }
  },

  /**
   * Assert that a value is not null/undefined.
   * @param {*} value - Value to check
   * @param {string} message - Failure message
   */
  isNotNull: function(value, message) {
    if (value === null || value === undefined) {
      throw new Error('Assert.isNotNull failed: ' + (message || 'Expected non-null value'));
    }
  },

  /**
   * Assert that a value is null or undefined.
   * @param {*} value - Value to check
   * @param {string} message - Failure message
   */
  isNull: function(value, message) {
    if (value !== null && value !== undefined) {
      throw new Error('Assert.isNull failed: ' + (message || 'Expected null/undefined'));
    }
  },

  /**
   * Assert that a string contains a substring.
   * @param {string} haystack - String to search in
   * @param {string} needle - Substring to find
   * @param {string} message - Failure message
   */
  contains: function(haystack, needle, message) {
    if (typeof haystack !== 'string' || haystack.indexOf(needle) === -1) {
      throw new Error('Assert.contains failed: ' + (message || '') +
        ' (expected "' + needle + '" in "' + haystack + '")');
    }
  },

  /**
   * Assert that a value is of the expected type.
   * @param {*} value - Value to check
   * @param {string} expectedType - Expected typeof result
   * @param {string} message - Failure message
   */
  typeOf: function(value, expectedType, message) {
    if (typeof value !== expectedType) {
      throw new Error('Assert.typeOf failed: ' + (message || '') +
        ' (expected type: ' + expectedType + ', actual: ' + typeof value + ')');
    }
  },

  /**
   * Assert that a value is greater than a threshold.
   * @param {number} actual - Actual value
   * @param {number} threshold - Threshold value
   * @param {string} message - Failure message
   */
  greaterThan: function(actual, threshold, message) {
    if (actual <= threshold) {
      throw new Error('Assert.greaterThan failed: ' + (message || '') +
        ' (expected > ' + threshold + ', actual: ' + actual + ')');
    }
  },

  /**
   * Assert that a function throws an error.
   * @param {function} fn - Function expected to throw
   * @param {string} message - Failure message
   */
  throws: function(fn, message) {
    let threw = false;
    try {
      fn();
    } catch (e) {
      threw = true;
    }
    if (!threw) {
      throw new Error('Assert.throws failed: ' + (message || 'Expected function to throw'));
    }
  },

  /**
   * Assert that an array includes a value.
   * @param {Array} arr - Array to search
   * @param {*} value - Value to find
   * @param {string} message - Failure message
   */
  includes: function(arr, value, message) {
    if (!Array.isArray(arr) || arr.indexOf(value) === -1) {
      throw new Error('Assert.includes failed: ' + (message || '') +
        ' (expected ' + JSON.stringify(value) + ' in ' + JSON.stringify(arr) + ')');
    }
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// TEST EXECUTION ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run all registered integration test suites.
 * @returns {Object} Test results summary as JSON
 */
function runAllIntegrationTests() {
  // Ensure all test suites are registered
  if (typeof registerMenuTests === 'function') registerMenuTests();
  if (typeof registerConfigTests === 'function') registerConfigTests();
  if (typeof registerSheetOpsTests === 'function') registerSheetOpsTests();
  if (typeof registerGatewayTests === 'function') registerGatewayTests();

  const suiteNames = Object.keys(TEST_REGISTRY);
  const allResults = {
    timestamp: new Date().toISOString(),
    suites: {},
    totals: { passed: 0, failed: 0, skipped: 0, total: 0, duration: 0 }
  };

  const overallStart = Date.now();

  for (let i = 0; i < suiteNames.length; i++) {
    const suiteName = suiteNames[i];
    const suiteResult = executeSuite_(suiteName, TEST_REGISTRY[suiteName]);
    allResults.suites[suiteName] = suiteResult;
    allResults.totals.passed += suiteResult.passed;
    allResults.totals.failed += suiteResult.failed;
    allResults.totals.skipped += suiteResult.skipped;
    allResults.totals.total += suiteResult.total;
  }

  allResults.totals.duration = Date.now() - overallStart;

  // Write results to sheet
  writeResultsToSheet_(allResults);

  Logger.log(JSON.stringify(allResults, null, 2));
  return allResults;
}

/**
 * Run a single test suite by name.
 * @param {string} suiteName - Name of the suite to run
 * @returns {Object} Suite results
 */
function runTestSuite(suiteName) {
  // Re-register suites to ensure they're loaded
  if (typeof registerMenuTests === 'function') registerMenuTests();
  if (typeof registerConfigTests === 'function') registerConfigTests();
  if (typeof registerSheetOpsTests === 'function') registerSheetOpsTests();
  if (typeof registerGatewayTests === 'function') registerGatewayTests();

  const tests = TEST_REGISTRY[suiteName];
  if (!tests) {
    throw new Error('Test suite "' + suiteName + '" not found. Available: ' +
      Object.keys(TEST_REGISTRY).join(', '));
  }
  const result = executeSuite_(suiteName, tests);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}

/**
 * Execute a single suite of tests.
 * @param {string} suiteName - Suite name
 * @param {Array} tests - Array of { name, fn } objects
 * @returns {Object} Suite results
 * @private
 */
function executeSuite_(suiteName, tests) {
  const suiteResult = {
    name: suiteName,
    passed: 0,
    failed: 0,
    skipped: 0,
    total: tests.length,
    duration: 0,
    tests: []
  };

  const suiteStart = Date.now();

  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];
    const testResult = { name: test.name, status: 'passed', error: null, duration: 0 };
    const testStart = Date.now();

    try {
      test.fn();
      suiteResult.passed++;
    } catch (e) {
      testResult.status = 'failed';
      testResult.error = e.message || String(e);
      suiteResult.failed++;
    }

    testResult.duration = Date.now() - testStart;
    suiteResult.tests.push(testResult);
  }

  suiteResult.duration = Date.now() - suiteStart;
  return suiteResult;
}

/**
 * Write test results to a "Test Results" sheet for visibility.
 * Creates or clears the sheet as needed.
 * @param {Object} results - Full results object
 * @private
 */
function writeResultsToSheet_(results) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Test Results');

  if (!sheet) {
    sheet = ss.insertSheet('Test Results');
  } else {
    sheet.clear();
  }

  // Header row
  const headers = ['Suite', 'Test', 'Status', 'Error', 'Duration (ms)'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');

  const rows = [];
  const suiteNames = Object.keys(results.suites);
  for (let s = 0; s < suiteNames.length; s++) {
    const suite = results.suites[suiteNames[s]];
    for (let t = 0; t < suite.tests.length; t++) {
      const test = suite.tests[t];
      rows.push([suite.name, test.name, test.status, test.error || '', test.duration]);
    }
  }

  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }

  // Summary row
  const summaryRow = rows.length + 3;
  sheet.getRange(summaryRow, 1, 1, 5).setValues([[
    'TOTALS',
    results.totals.total + ' tests',
    results.totals.passed + ' passed / ' + results.totals.failed + ' failed',
    results.timestamp,
    results.totals.duration + ' ms'
  ]]).setFontWeight('bold');

  // Color code status column
  for (let r = 0; r < rows.length; r++) {
    const cell = sheet.getRange(r + 2, 3);
    if (rows[r][2] === 'passed') {
      cell.setBackground('#d4edda');
    } else if (rows[r][2] === 'failed') {
      cell.setBackground('#f8d7da');
    }
  }
}
