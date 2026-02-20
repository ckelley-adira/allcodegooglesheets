# Tier 2: Integration Tests

Automated integration tests for the UFLI Progress Tracking system that run against a real Google Spreadsheet via Google Apps Script (GAS) runtime.

## Architecture

```
tests/integration/
├── README.md                           # This file
├── .clasp.json.example                 # Template — copy to .clasp.json with your script ID
├── run_integration_tests.js            # Node.js orchestrator (push → run → collect)
└── gas/                                # GAS files pushed to test project
    ├── IntegrationTestRunner.gs        # Test harness (Assert helpers, suite runner)
    ├── IntegrationTestFixtures.gs      # Fixture data & setup/teardown
    ├── SiteConfig_Test.gs              # Test-only SITE_CONFIG (replaces SiteConfig_TEMPLATE.gs)
    ├── IntegrationTests_MenuAndFlags.gs # Menu generation & feature flag tests
    ├── IntegrationTests_Config.gs      # UnifiedConfig & grade model tests
    ├── IntegrationTests_SheetOps.gs    # Sheet creation & data round-trip tests
    └── IntegrationTests_Gateway.gs     # Gateway lesson & progress calculation tests
```

## Test Suites

| Suite | Tests | Covers |
|-------|-------|--------|
| **MenuAndFeatureFlags** | 14 | SITE_CONFIG shape, feature flag toggling, sync flag gating, onOpen/buildFeatureMenu |
| **ConfigResolution** | 15 | GRADE_RANGE_MODELS, getUnifiedConfig, getDefaultGradesForModel, layout defaults, SharedConstants |
| **SheetOperations** | 10 | Fixture sheet creation, student data read/write, lesson scores, teardown cleanup |
| **GatewayAndProgress** | 12 | REVIEW_LESSONS, PERFORMANCE_THRESHOLDS, getPerformanceStatus, score averages, skill sections |

**Total: 51 integration tests** across 4 suites.

## Prerequisites

1. **Node.js 14+** — for the orchestrator script
2. **@google/clasp** — Google Apps Script CLI
   ```bash
   npm install -g @google/clasp
   ```
3. **A dedicated test Google Sheet** — with an Apps Script project attached
4. **clasp authentication** — run `clasp login` interactively, or provide credentials via secrets

## One-Time Setup

### 1. Create the test spreadsheet

1. Create a new Google Sheet (name it "UFLI Integration Tests")
2. Open **Extensions → Apps Script**
3. Note the **Script ID** from the Apps Script editor URL:
   `https://script.google.com/home/projects/YOUR_SCRIPT_ID/edit`

### 2. Enable the Apps Script API

1. Go to [Apps Script Settings](https://script.google.com/home/usersettings)
2. Enable **Google Apps Script API**

### 3. Enable Execution API

1. In the Apps Script editor, go to **Project Settings**
2. Under **Google Cloud Platform (GCP) Project**, link to a GCP project
3. Enable the **Apps Script API** in the GCP console
4. Under **Script Properties**, ensure the project is set to execute as the deploying user

### 4. Configure clasp locally

```bash
# Authenticate (opens browser)
clasp login

# Copy the example config
cp tests/integration/.clasp.json.example tests/integration/.clasp.json

# Edit .clasp.json and replace YOUR_TEST_APPS_SCRIPT_PROJECT_ID with the script ID from step 1
```

### 5. Run tests locally

```bash
node tests/integration/run_integration_tests.js
```

## CI Setup (GitHub Actions)

The workflow at `.github/workflows/integration-tests.yml` runs automatically on pushes and PRs that touch `gold-standard-template/` or `tests/integration/`.

### Required Secrets

Set these in **Settings → Secrets and variables → Actions**:

| Secret | Description | How to obtain |
|--------|-------------|---------------|
| `CLASPRC_JSON` | clasp auth credentials | Contents of `~/.clasprc.json` after running `clasp login` |
| `CLASP_SCRIPT_ID` | Test project Script ID | From the Apps Script editor URL |

> **Note:** If secrets are not configured, the workflow will run the Tier 1 validation only and skip integration tests with a notice.

## How It Works

1. **Orchestrator** (`run_integration_tests.js`) stages source + test files in a temp directory
2. **clasp push** deploys them to the test Apps Script project (replacing previous code)
3. **clasp run** executes `runAllIntegrationTests()` in the GAS runtime
4. The test runner creates/modifies sheets in the test spreadsheet, collects results
5. Results are written to a **"Test Results"** sheet and returned as JSON
6. Orchestrator parses results and exits with code 0 (pass) or 1 (fail)

## Test Fixtures

Fixture data is defined in `IntegrationTestFixtures.gs`:

- **8 test students** across 5 groups (Group A–E), covering grades PreK through G6
- **Lesson scores** for review lessons (L5, L10, L19, L35, L38, L41, L49, L53)
- **5 school scenarios**: `coreOnly`, `mixedGrade`, `tutoringOnly`, `preKOnly`, `fullFeatures`
- All test sheets are prefixed with `_TEST_` and cleaned up via `teardownTestSheets()`

## Writing New Tests

1. Create a new `.gs` file in `tests/integration/gas/`
2. Define a registration function:
   ```javascript
   function registerMyTests() {
     registerTestSuite('MySuite', [
       { name: 'test description', fn: myTestFunction }
     ]);
   }
   ```
3. Add the registration call in `IntegrationTestRunner.gs` → `runAllIntegrationTests()`
4. Add the file to the `TEST_FILES` array in `run_integration_tests.js`

### Available Assertions

```javascript
Assert.isTrue(value, message)
Assert.isFalse(value, message)
Assert.equals(actual, expected, message)
Assert.deepEquals(actual, expected, message)
Assert.isNotNull(value, message)
Assert.isNull(value, message)
Assert.contains(haystack, needle, message)
Assert.typeOf(value, expectedType, message)
Assert.greaterThan(actual, threshold, message)
Assert.throws(fn, message)
Assert.includes(array, value, message)
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| `clasp push` fails with auth error | Re-run `clasp login` or refresh `CLASPRC_JSON` secret |
| `clasp run` times out | Increase timeout in orchestrator; check GAS execution logs |
| Tests fail with "Sheet not found" | Ensure test spreadsheet exists and has at least one sheet |
| "Script API not enabled" | Enable Apps Script API at https://script.google.com/home/usersettings |
| Duplicate function names | Ensure `SiteConfig_TEMPLATE.gs` is NOT included alongside `SiteConfig_Test.gs` |
