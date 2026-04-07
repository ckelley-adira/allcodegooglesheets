# validate_shared_constants.js

## 📋 Overview

`validate_shared_constants.js` is a **Node.js offline validation script** that verifies the structural integrity of the unified UFLI template before deployment to Google Apps Script. It is run from the `gold-standard-template/` directory and performs five checks covering `SharedConstants.gs`, `Phase2_ProgressTracking.gs`, `UnifiedConfig.gs`, the `SharedEngine_Core.gs`/`SharedEngine_IO.gs` split modules, and `SiteConfig_TEMPLATE.gs`.

The script uses only Node.js standard library (`fs`, `path`) — no npm packages required. It exits with code `0` on full success and `1` on any failure.

**Run it with:**
```bash
node gold-standard-template/validate_shared_constants.js
```

> **Important:** This script is the only automated offline check in the repository. Run it after every change to `SharedConstants.gs`, `SharedEngine_Core.gs`, `SharedEngine_IO.gs`, `UnifiedConfig.gs`, `SiteConfig_TEMPLATE.gs`, or `Phase2_ProgressTracking.gs`.

---

## 📜 Business Rules

The script enforces the following architectural contracts:

### Rule 1 — SharedConstants.gs defines all canonical constants
All six canonical constants must be declared (via `const` or `var`) in `SharedConstants.gs`:
- `LESSON_LABELS`
- `SKILL_SECTIONS`
- `REVIEW_LESSONS`
- `REVIEW_LESSONS_SET`
- `PERFORMANCE_THRESHOLDS`
- `STATUS_LABELS`

### Rule 2 — Phase2_ProgressTracking.gs does NOT redefine shared constants
`Phase2_ProgressTracking.gs` must reference the shared constants but must not declare its own top-level versions. A regex checks for `const <CONSTANT> =` or `var <CONSTANT> =` at the start of a line — any match is a failure.

### Rule 3 — Phase 7 unified template files exist and contain required functions
- `UnifiedConfig.gs` must exist and define: `getUnifiedConfig()`, `GRADE_RANGE_MODELS`, `getGradeRangeModels()`, `getDefaultGradesForModel()`, `validateUnifiedConfig()`
- `Phase2_ProgressTracking.gs` must exist and define: `generateSystemSheets()`

### Rule 4 — SharedEngine split files are structurally correct
- `SharedEngine_Core.gs` must exist and define all 8 core functions:  
  `getLessonColumnIndex()`, `getLessonStatus()`, `isReviewLesson()`, `calculateBenchmark()`, `calculateSectionPercentage()`, `computeStudentStats()`, `createMergedRow()`, `getColumnLetter()`
- **Purity check:** `SharedEngine_Core.gs` must contain **zero non-comment references** to GAS APIs: `SpreadsheetApp`, `Logger.log`, `HtmlService`, `UrlFetchApp`. Comment lines starting with `//`, `*`, or `/*` are excluded from this check.
- `SharedEngine_IO.gs` must exist and define: `getOrCreateSheet()`, `log()`, `updateAllStats()`

### Rule 5 — SiteConfig_TEMPLATE.gs contains Phase 7 layout settings
Must contain all five settings: `gradeRangeModel`, `gradesServed`, `layout:`, `headerRowCount`, `dataStartRow`.

---

## 📥 Data Inputs

| File Read | Purpose |
|---|---|
| `SharedConstants.gs` | Checked for constant declarations |
| `Phase2_ProgressTracking.gs` | Checked for local re-declarations and reference counts |
| `UnifiedConfig.gs` | Checked for required function/constant definitions |
| `SharedEngine_Core.gs` | Checked for required functions and absence of GAS APIs |
| `SharedEngine_IO.gs` | Checked for required I/O functions |
| `SiteConfig_TEMPLATE.gs` | Checked for Phase 7 layout settings |

All paths are resolved relative to `__dirname` (the `gold-standard-template/` directory).

---

## 📤 Outputs

| Output | Description |
|---|---|
| Console (stdout) | Structured validation report with ✅/❌ indicators per check |
| Exit code `0` | All validations passed |
| Exit code `1` | One or more validations failed |

**Sample successful output:**
```
═══════════════════════════════════════════════════════════════
VALIDATING SHAREDCONSTANTS INTEGRATION
═══════════════════════════════════════════════════════════════

1. Checking SharedConstants.gs...
   ✅ LESSON_LABELS defined
   ✅ SKILL_SECTIONS defined
   ...

✅ ALL VALIDATIONS PASSED
SharedConstants integration and Phase 7 unified template are correct.
```

---

## 🔗 Dependencies

### Depends On (calls into)
| Dependency | Type | Description |
|---|---|---|
| `fs` (Node.js built-in) | Module | File reading (`existsSync`, `readFileSync`) |
| `path` (Node.js built-in) | Module | Path resolution (`path.join`, `__dirname`) |

### Used By (called from)
| Context | Usage |
|---|---|
| Developer CLI | Run manually after modifying any of the six validated files |
| CI pipeline | Can be wired as a pre-deployment gate once a CI pipeline is configured for this repository |
| `package.json` (if configured) | Could be added as a `validate` script |

---

## ⚙️ Function Reference

This script has no exported functions. It is a top-level sequential script. The logic is organized into five numbered validation blocks:

---

### Block 1 — `SharedConstants.gs` constant declarations
**Description:** Reads `SharedConstants.gs` and checks that each of the six canonical constants has a `const <NAME> =` or `var <NAME> =` declaration.

**Regex pattern:** `/(const|var)\s+<CONSTANT>\s*=/m`

**Failure condition:** Any constant is not declared → `allValid = false`, error printed.

---

### Block 2 — `Phase2_ProgressTracking.gs` integration check
**Description:** Reads `Phase2_ProgressTracking.gs` and performs two checks:
1. Verifies that none of the six shared constants are **re-declared** locally (top-of-line `const`/`var` match).
2. If no re-declarations found, counts total references to shared constants as a sanity check.

**Regex for re-declaration:** `/^\s*(const|var)\s+<CONSTANT>\s*=/m`

**Failure condition:** Any shared constant is locally re-declared → `allValid = false`.

---

### Block 3 — Phase 7 unified template files
**Description:** Verifies that `UnifiedConfig.gs` and `Phase2_ProgressTracking.gs` exist and contain their required function/constant definitions using simple `String.includes()` checks.

**Checks for `UnifiedConfig.gs`:**
- `function getUnifiedConfig()`
- `GRADE_RANGE_MODELS`
- `function getGradeRangeModels()`
- `function getDefaultGradesForModel(`
- `function validateUnifiedConfig(`

**Checks for `Phase2_ProgressTracking.gs`:**
- `function generateSystemSheets(`

**Failure condition:** File missing or required symbol not found → `allValid = false`.

---

### Block 4 — SharedEngine split file validation
**Description:** Validates both `SharedEngine_Core.gs` and `SharedEngine_IO.gs`.

**For `SharedEngine_Core.gs`:**
- Checks existence and logs file size.
- Verifies 8 core function signatures are present.
- Performs a **purity check**: scans every non-comment line for GAS API references (`SpreadsheetApp`, `Logger.log`, `HtmlService`, `UrlFetchApp`). Comment detection skips lines starting with `//`, `*`, or `/*`.

**For `SharedEngine_IO.gs`:**
- Checks existence and logs file size.
- Verifies 3 I/O function signatures: `getOrCreateSheet(`, `log(`, `updateAllStats(`.

**Failure condition:** Missing file, missing function, or GAS API found in Core → `allValid = false`.

---

### Block 5 — `SiteConfig_TEMPLATE.gs` Phase 7 settings
**Description:** Reads `SiteConfig_TEMPLATE.gs` and checks for the presence of five Phase 7 required settings using `String.includes()`.

**Settings checked:** `gradeRangeModel`, `gradesServed`, `layout:`, `headerRowCount`, `dataStartRow`.

**Failure condition:** Any setting string not found in the file → `allValid = false`.

---

### Exit behavior
After all five blocks run, the script prints a summary line and calls `process.exit(0)` on full success or `process.exit(1)` on any failure. The `allValid` boolean accumulates failures from all blocks.
