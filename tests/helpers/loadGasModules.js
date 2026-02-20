/**
 * loadGasModules.js — Evaluates .gs files in a shared sandbox for Node.js testing.
 *
 * Google Apps Script has a flat global scope: every .gs file shares the same
 * namespace. This loader replicates that by evaluating file contents inside a
 * single VM context so that constants and functions from one file are visible
 * to the next.
 *
 * Usage:
 *   const { ctx } = require('./loadGasModules');
 *   ctx.getColumnLetter(1); // => 'A'
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

const GOLD = path.resolve(__dirname, '..', '..', 'gold-standard-template');

// Ordered list of .gs files to load (order matters — dependencies first)
const GAS_FILES = [
  path.join(GOLD, 'SharedConstants.gs'),
  path.join(GOLD, 'SharedEngine.gs'),
  path.join(GOLD, 'modules', 'TutoringSystem.gs'),
];

/**
 * Builds a sandbox context that mimics the GAS global environment just enough
 * for pure-logic functions to execute. GAS-specific APIs (SpreadsheetApp,
 * Logger, etc.) are stubbed so that files can be loaded without errors even
 * if they contain references to those APIs at the top level.
 */
function buildSandbox() {
  const sandbox = {
    // Stubs for GAS globals referenced at file scope
    Logger: { log: () => {} },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: () => null,
      }),
      getUi: () => ({
        createMenu: () => ({ addItem: () => ({}), addToUi: () => {} }),
        alert: () => {},
      }),
    },
    HtmlService: {
      createHtmlOutputFromFile: () => ({ setTitle: () => ({}) }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: () => null,
        setProperty: () => {},
      }),
    },
    Session: {
      getActiveUser: () => ({ getEmail: () => 'test@example.com' }),
    },
    // Standard JS globals needed inside the VM
    console,
    Math,
    Object,
    Array,
    Set,
    Map,
    String,
    Number,
    JSON,
    parseInt,
    parseFloat,
    isNaN,
    RegExp,
    Error,
    TypeError,
    RangeError,
    Date,
  };

  return sandbox;
}

// Constants declared with `const` in .gs files are lexically scoped inside
// the VM context — they are accessible to later scripts evaluated in the same
// context, but NOT as properties of the sandbox object.  After loading all
// files we run a small bridge script that copies them to `var` declarations
// (which *do* become sandbox properties) so tests can access them via ctx.X.
const CONST_NAMES = [
  'LESSON_LABELS', 'SKILL_SECTIONS', 'REVIEW_LESSONS', 'REVIEW_LESSONS_SET',
  'PERFORMANCE_THRESHOLDS', 'STATUS_LABELS',
  'FOUNDATIONAL_LESSONS', 'G1_MINIMUM_LESSONS', 'G1_CURRENT_YEAR_LESSONS',
  'G2_MINIMUM_LESSONS', 'G2_CURRENT_YEAR_LESSONS', 'G4_MINIMUM_LESSONS',
  'ALL_NON_REVIEW_LESSONS', 'SHARED_GRADE_METRICS',
  'GRADE_RANGE_MODELS',
];
// `this` inside the VM points to the sandbox (globalThis), which lets us
// expose lexical `const` values as enumerable sandbox properties.
// We guard each assignment with `typeof` so that the bridge works even
// when only a subset of .gs files has been loaded.
const EXPORT_BRIDGE = CONST_NAMES
  .map(n => `if (typeof ${n} !== 'undefined') this.${n} = ${n};`)
  .join('\n');

/**
 * Loads the specified .gs files (or the default set) into a VM context and
 * returns the context object with all globals available.
 *
 * @param {string[]} [files] – Override the default file list
 * @returns {{ ctx: Object }}
 */
function loadGasModules(files) {
  const filesToLoad = files || GAS_FILES;
  const sandbox = buildSandbox();
  const ctx = vm.createContext(sandbox);

  for (const filePath of filesToLoad) {
    const code = fs.readFileSync(filePath, 'utf8');
    const script = new vm.Script(code, { filename: path.basename(filePath) });
    script.runInContext(ctx);
  }

  // Expose const declarations as sandbox properties for test access
  new vm.Script(EXPORT_BRIDGE, { filename: 'export-bridge.js' }).runInContext(ctx);

  return { ctx };
}

module.exports = { loadGasModules, GAS_FILES, GOLD };
