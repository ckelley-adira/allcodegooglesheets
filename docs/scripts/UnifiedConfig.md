# UnifiedConfig.gs

## 📋 Overview

`UnifiedConfig.gs` is the **runtime configuration resolver** for the unified UFLI template (Version 7.0, Phase 7 Logic Layer Unification). Its central function, `getUnifiedConfig()`, reads the school-specific `SITE_CONFIG` object (defined in `SiteConfig_TEMPLATE.gs`, maintained by direct editing of the per-school copy of that file) and resolves it into the complete, structured configuration object consumed by all other modules.

Before this module existed, every school maintained its own copy of `Phase2_ProgressTracking.gs` containing hardcoded layout constants, sheet names, colors, and grade metrics. `UnifiedConfig.gs` eliminates all per-school constant definitions — a single call to `getUnifiedConfig()` produces the same structured config that any school-specific file previously defined manually.

It also defines `GRADE_RANGE_MODELS`, a set of preset school type configurations (Pre-K Only, K–5, K–8, Pre-K through 8, Custom), which the Setup Wizard UI presents as options to administrators.

---

## 📜 Business Rules

### Layout Defaults
- **Header rows:** Default `headerRowCount = 5` (rows 1–5 are headers).
- **Data start row:** Default `dataStartRow = headerRowCount + 1 = 6`.
- Both can be overridden via `SITE_CONFIG.layout` (set by the Setup Wizard).

### Column Positions (1-based, fixed)
| Column | Field |
|---|---|
| 1 | Student Name |
| 2 | Grade |
| 3 | Teacher |
| 4 | Group |
| 5 | Current Lesson |
| 6 | First Lesson (start of lesson data) |

### Sheet Names (standardized across all schools)
| Key | Sheet Name |
|---|---|
| `SMALL_GROUP_PROGRESS` | "Small Group Progress" |
| `UFLI_MAP` | "UFLI MAP" |
| `SKILLS` | "Skills Tracker" |
| `GRADE_SUMMARY` | "Grade Summary" |
| `INITIAL_ASSESSMENT` | "Initial Assessment" |
| `SCHOOL_SUMMARY` | "School Summary" |
| `PREK.DATA` | "Pre-K Data" |
| `PACING.DASHBOARD` | "Pacing Dashboard" |
| `PACING.LOG` | "Pacing Log" |

### Pre-K Configuration
- Derived from layout settings: `HEADER_ROW = headerRowCount`, `DATA_START_ROW = dataStartRow`.
- Fixed denominators: `FORM_DENOMINATOR = 26`, `NAME_SOUND_DENOMINATOR = 52`, `FULL_DENOMINATOR = 78`.

### Colors
- Default header background: `#4A90E2` (overridable via `SITE_CONFIG.branding.primaryColor`).
- Default title background: `#ADD8E6` (overridable via `SITE_CONFIG.branding.accentColor`).
- Y/N/A cell colors: `#d4edda` (green), `#f8d7da` (red), `#fff3cd` (yellow) — fixed.

### Grade Metrics
- `GRADE_METRICS` in the resolved config falls back to `SHARED_GRADE_METRICS` from `SharedEngine_Core.gs` (or `SharedEngine.gs`). Per-school overrides are no longer needed.

### Grade Range Models
| ID | Label | Default Grades |
|---|---|---|
| `prek_only` | Pre-K Only | `['PreK']` |
| `k5` | K–5 Elementary | `['KG','G1','G2','G3','G4','G5']` |
| `k8` | K–8 Full Range | `['KG','G1','…','G8']` |
| `prek_8` | Pre-K through 8 | `['PreK','KG','G1','…','G8']` |
| `custom` | Custom | `[]` (admin selects manually) |

### Validation Rules (`validateUnifiedConfig`)
Required top-level keys: `LAYOUT`, `SHEET_NAMES_V2`, `PREK_CONFIG`, `COLORS`.  
Required `LAYOUT` sub-keys: `DATA_START_ROW`, `HEADER_ROW_COUNT`, `LESSON_COLUMN_OFFSET`, `TOTAL_LESSONS`.

---

## 📥 Data Inputs

| Input | Source | Description |
|---|---|---|
| `SITE_CONFIG.layout` | `SiteConfig_TEMPLATE.gs` | Layout overrides (`headerRowCount`, `dataStartRow`, `lessonColumnOffset`, etc.) |
| `SITE_CONFIG.gradeRangeModel` | `SiteConfig_TEMPLATE.gs` | Model ID string (e.g., `'k5'`, `'k8'`, `'prek_8'`) |
| `SITE_CONFIG.gradesServed` | `SiteConfig_TEMPLATE.gs` | Explicit array of active grade codes (overrides model defaults) |
| `SITE_CONFIG.schoolName` | `SiteConfig_TEMPLATE.gs` | Display name for the school |
| `SITE_CONFIG.branding` | `SiteConfig_TEMPLATE.gs` | `primaryColor` and `accentColor` for UI theming |
| `SITE_CONFIG.features` | `SiteConfig_TEMPLATE.gs` | Feature flag map for optional modules |
| `SHARED_GRADE_METRICS` | `SharedEngine_Core.gs` / `SharedEngine.gs` | Fallback grade benchmark definitions |

All inputs are read from the GAS global scope at call time — `getUnifiedConfig()` performs safe `typeof` checks and uses sensible defaults when `SITE_CONFIG` is undefined or incomplete.

---

## 📤 Outputs

### `getUnifiedConfig()` return value

```js
{
  LAYOUT: {
    DATA_START_ROW,       // number — first data row (default: 6)
    HEADER_ROW_COUNT,     // number — header rows (default: 5)
    LESSON_COLUMN_OFFSET, // number — 0-based offset to lesson columns (default: 5)
    TOTAL_LESSONS,        // 128 (fixed)
    LESSONS_PER_GROUP_SHEET, // number (default: 12)
    GROUP_FORMAT,         // string (default: 'standard')
    INCLUDE_SC_CLASSROOM, // boolean
    COL_STUDENT_NAME,     // 1
    COL_GRADE,            // 2
    COL_TEACHER,          // 3
    COL_GROUP,            // 4
    COL_CURRENT_LESSON,   // 5
    COL_FIRST_LESSON      // 6
  },
  SHEET_NAMES_V2: { SMALL_GROUP_PROGRESS, UFLI_MAP, SKILLS, GRADE_SUMMARY,
                    INITIAL_ASSESSMENT, SCHOOL_SUMMARY },
  SHEET_NAMES_PREK: { DATA },
  SHEET_NAMES_PACING: { DASHBOARD, LOG },
  PREK_CONFIG: { TOTAL_LETTERS, HEADER_ROW, DATA_START_ROW,
                 FORM_DENOMINATOR, NAME_SOUND_DENOMINATOR, FULL_DENOMINATOR },
  COLORS: { Y, N, A, HEADER_BG, HEADER_FG, TITLE_BG, TITLE_FG,
            SUB_HEADER_BG, PLACEHOLDER_FG },
  GRADE_METRICS,      // SHARED_GRADE_METRICS or override
  features,           // SITE_CONFIG.features object
  gradeRangeModel,    // string — model ID
  gradesServed,       // Array<string> — active grade codes
  schoolName          // string
}
```

---

## 🔗 Dependencies

### Depends On (calls into)
| File | Items Used |
|---|---|
| `SiteConfig_TEMPLATE.gs` | `SITE_CONFIG` (global object — read via `typeof` guard) |
| `SharedEngine_Core.gs` / `SharedEngine.gs` | `SHARED_GRADE_METRICS` (global constant — used as fallback) |

### Used By (called from)
| File | Usage |
|---|---|
| `Phase2_ProgressTracking.gs` | Calls `getUnifiedConfig()` at the top of every entry-point function |
| `SetupWizard.gs` | Calls `getUnifiedConfig()`, `getGradeRangeModels()`, `validateUnifiedConfig()` |
| `modules/ModuleLoader.gs` | Calls `getUnifiedConfig()` to resolve feature flags |
| `validate_shared_constants.js` | Validates that `getUnifiedConfig()`, `GRADE_RANGE_MODELS`, `getGradeRangeModels()`, `getDefaultGradesForModel()`, and `validateUnifiedConfig()` are all defined |

---

## ⚙️ Function Reference

### `GRADE_RANGE_MODELS` (constant)
**Description:** Module-level `const` object defining the five preset school configurations. Each entry has `id`, `label`, `defaultGrades`, and `description`. Used by the Setup Wizard UI and `getDefaultGradesForModel()`.

---

### `getUnifiedConfig()`
**Description:** Resolves the complete school configuration from `SITE_CONFIG`. This is the **single function that replaces all per-school constant definitions**. Must be called after `SITE_CONFIG` is defined (i.e., after `SiteConfig_TEMPLATE.gs` is loaded by GAS).  
**Parameters:** None.

**Returns:** (Object) Full config object with `LAYOUT`, `SHEET_NAMES_V2`, `SHEET_NAMES_PREK`, `SHEET_NAMES_PACING`, `PREK_CONFIG`, `COLORS`, `GRADE_METRICS`, `features`, `gradeRangeModel`, `gradesServed`, `schoolName`.

**Safe defaults:** If `SITE_CONFIG` is undefined (e.g., during offline validation), all values fall back to sensible defaults so the system degrades gracefully.

---

### `getGradeRangeModels()`
**Description:** Returns the list of all available grade range model definitions, formatted for consumption by the Setup Wizard UI.  
**Parameters:** None.

**Returns:** (Array\<Object\>) Array of `{ id, label, description, defaultGrades }` objects for each model in `GRADE_RANGE_MODELS`.

---

### `getDefaultGradesForModel(modelId)`
**Description:** Returns the default grade code array for a specific grade range model.  
**Parameters:**
- `modelId` (string): A model ID string (e.g., `'k5'`, `'k8'`, `'prek_only'`, `'prek_8'`, `'custom'`).

**Returns:** (Array\<string\>) Array of grade codes (e.g., `['KG', 'G1', 'G2', 'G3', 'G4', 'G5']`), or `[]` if the model ID is not found.

---

### `validateUnifiedConfig(config)`
**Description:** Validates that a config object produced by `getUnifiedConfig()` contains all required keys. Returns a structured result with guidance messages identifying any missing keys and how to fix them.  
**Parameters:**
- `config` (Object): Configuration object to validate (typically the return value of `getUnifiedConfig()`).

**Returns:** (Object) `{ valid: boolean, missing: Array<string>, errors: Array<string> }`.
- `valid` — `true` only if all required keys and sub-keys are present.
- `missing` — list of missing key names (e.g., `['LAYOUT.DATA_START_ROW']`).
- `errors` — human-readable error messages with actionable guidance pointing to `SiteConfig_TEMPLATE.gs` or the Setup Wizard.
