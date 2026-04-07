# onOpen_Example.gs (Module)

## 📋 Overview
**Feature Flag:** N/A — this is a **reference implementation**, not an active module.

`onOpen_Example.gs` is a fully-annotated example showing how to wire the feature-flag system into a school's `onOpen()` trigger and Setup Wizard. It is intended to be read and adapted by developers integrating the Gold Standard template into a new school deployment — it should **not** be deployed as-is, since it contains school-specific menu text (`"Adira Reads Progress Report"`) and a hardcoded unconfigured-state check.

Plain-English summary: *Copy the `onOpen()` pattern from this file into your school's `SetupWizard.gs`. The key change is replacing any hardcoded feature menu items with a single call to `buildFeatureMenu(ui, baseMenu)`. The file also shows how to load feature flags at runtime from the Feature Settings sheet, how to guard a function behind a feature flag check, and how to present the feature-configuration dialog as a wizard step.*

---

## 📜 Business Rules
1. **Unconfigured state guard:** If the *Site Configuration* sheet does not exist or `isSystemConfigured()` returns false, `onOpen()` builds a minimal menu with only *Start Setup Wizard* — no feature submenus are shown.
2. **Feature flags are loaded at runtime** from the *Feature Settings* sheet (not hard-coded). `loadSiteConfig()` reads rows 6+ from that sheet; column A = feature ID, column B = `TRUE`/`FALSE`. Flags are written back to `SITE_CONFIG.features`.
3. **`openFeatureSpecificTool()`** demonstrates the recommended guard pattern: check `isFeatureEnabled('adminImport')` before proceeding, and show an informative alert if the feature is disabled.
4. **`saveFeatureConfiguration()`** writes feature flag values from the dialog back to the Feature Settings sheet by matching column A feature IDs. Rows before index 5 (0-based) are treated as headers and skipped.
5. The feature configuration dialog is an inline HTML literal (not a separate `.html` file) and uses `google.script.run.saveFeatureConfiguration(features)` for the save call.
6. This file **does not guard its `onOpen()` function with a feature flag** — it is designed to replace the top-level `onOpen()` in a school's SetupWizard file.

---

## 📥 Data Inputs
| Input | Source | Notes |
|---|---|---|
| *Site Configuration* sheet | `SHEET_NAMES.CONFIG` | Existence check — determines unconfigured state |
| *Feature Settings* sheet | `SHEET_NAMES.FEATURES` | Rows 6+: feature ID (col A), enabled boolean (col B) |
| `features` object | Dialog client-side JavaScript | Seven boolean feature flags submitted by the user |
| `isSystemConfigured()` | `SetupWizard.gs` or `UnifiedConfig.gs` | Returns whether setup is complete |

---

## 📤 Outputs
| Output | Description |
|---|---|
| Top-level menu | `onOpen()` builds and adds the full application menu via `.addToUi()` |
| Updated `SITE_CONFIG.features` | `loadSiteConfig()` mutates the global config object |
| Updated Feature Settings sheet | `saveFeatureConfiguration()` writes TRUE/FALSE to column B |
| Feature configuration dialog | `showFeatureConfigurationStep()` shows a modal with checkboxes for all 7 features |
| Feature summary HTML | Not directly in this file — uses `getEnabledFeaturesDisplay()` from `ModuleLoader.gs` |

---

## 🔗 Dependencies

### Feature Flag
None — always available; intended as a reference/template file.

### Depends On (calls into)
| File / Symbol | Purpose |
|---|---|
| `ModuleLoader.gs` → `buildFeatureMenu()` | Appends feature submenus to the base menu |
| `UnifiedConfig.gs` → `isFeatureEnabled()` | Used in `openFeatureSpecificTool()` guard |
| `UnifiedConfig.gs` → `isSystemConfigured()` | Determines unconfigured-state menu path |
| `SharedConstants.gs` → `SITE_CONFIG`, `SHEET_NAMES` | Global config and sheet name constants |
| `AdminImport.gs` → `showImportDialog()` | Called when admin import feature is enabled |
| Various `SetupWizard.gs` functions | `startSetupWizard`, `goToSchoolSummary`, `generateReports`, etc. |
| `SpreadsheetApp` (GAS built-in) | Menu building, dialog display, sheet access |

### Used By (called from)
| File | Context |
|---|---|
| *Developer / integration guide* | Copied and adapted when onboarding a new school deployment |
| `SetupWizard.gs` (school-specific) | The `onOpen()`, `loadSiteConfig()`, and `saveFeatureConfiguration()` patterns are adopted here |

---

## ⚙️ Function Reference

### `onOpen()`
**Description:** GAS `onOpen` trigger entry point. Checks whether the system is configured; if not, builds a minimal *Start Setup Wizard* menu. If configured, calls `loadSiteConfig()`, builds the base menu with all core items (View School Summary, Generate Reports, Manage Students/Groups, Sync & Performance submenu), calls `buildFeatureMenu()` to append optional feature submenus, then adds the System Tools section and calls `.addToUi()`.

**Parameters:** None (GAS trigger — called automatically on spreadsheet open).

**Returns:** (void)

---

### `loadSiteConfig()`
**Description:** Reads feature flag values from the *Feature Settings* sheet at runtime and merges them into `SITE_CONFIG.features`. Row index 5 (0-based) is where feature data rows begin; earlier rows are headers. Each row: column A = feature ID string, column B = boolean or `"TRUE"` string. Logs the number of flags loaded.

**Parameters:** None.

**Returns:** (void)

---

### `openFeatureSpecificTool()`
**Description:** Example guard function demonstrating the recommended pattern for feature-gated menu handlers. Checks `isFeatureEnabled('adminImport')` and shows an informative alert if the feature is disabled; otherwise calls `showImportDialog()`.

**Parameters:** None.

**Returns:** (void)

---

### `showFeatureConfigurationStep()`
**Description:** Opens the feature configuration dialog as a 700 × 600 modal. Called as a step within the Setup Wizard flow to let the administrator choose which optional features to enable.

**Parameters:** None.

**Returns:** (void)

---

### `getFeatureConfigHtml()`
**Description:** Returns the full HTML string for the feature configuration dialog. The dialog presents a checkbox card for each of the seven optional features (Mixed Grade Support, Weekly Coaching Dashboard, Tutoring System, Grant Reporting, Growth Highlighter, Admin Import Tools, Unenrollment Automation) with a plain-English description. The client-side `saveFeatureConfig()` function collects checkbox states and calls `saveFeatureConfiguration()` via `google.script.run`.

**Parameters:** None.

**Returns:** (string) Full HTML document string.

---

### `saveFeatureConfiguration(features)`
**Description:** Server-side handler that writes submitted feature flag values to the *Feature Settings* sheet. Iterates rows from index 5, matches the feature ID in column A, and updates column B with the boolean value.

**Parameters:**
- `features` (Object): Map of `{ featureId: boolean }` for all seven optional features.

**Returns:** (boolean) `true` on success; throws on error.
