# ModuleLoader.gs (Module)

## 📋 Overview
**Feature Flag:** No single flag — this is the orchestrator that reads all feature flags.

`ModuleLoader.gs` is the central dispatcher for the UFLI Master System's optional feature modules. It reads `SITE_CONFIG.features` at runtime and conditionally injects menu items, resolves grade-to-sheet mappings, and initialises each feature module that is enabled. Schools activate or deactivate features by toggling flags in `SiteConfig_TEMPLATE.gs`; this file contains no school-specific logic itself.

Plain-English summary: *When the spreadsheet opens, `buildFeatureMenu()` is called from `onOpen()`. It inspects every feature flag and only adds the corresponding submenu if that flag is `true`. This keeps the menu lean for schools that don't need every feature. The loader also provides two grade-routing helpers used by the form and sync layers when `mixedGradeSupport` is enabled.*

---

## 📜 Business Rules
1. A feature menu item is **never** shown when its flag is `false` or absent — the menu is built dynamically, not filtered after the fact.
2. The Pre-K submenu appears only when `features.preKSystem === "hwt"` (the full Handwriting Without Tears track); the light-mode Pre-K variant has no dedicated submenu items.
3. `getGradeList()` returns a single-element array (`[gradeCode]`) when `mixedGradeSupport` is disabled, ensuring downstream callers need no conditional logic.
4. Mixed-grade combinations follow the format `"G6+G7+G8, G1+G2+G3+G4"` in `SITE_CONFIG.features.mixedGradeSupport.combinations`; a grade that appears in no combination falls back to the standard `"<grade> Groups"` sheet name.
5. `initializeFeatureModules()` logs warnings for misconfigured integrations (e.g., Monday.com `createMondayTask` enabled without a `mondayBoardId`) but does not throw — setup errors are non-fatal.
6. `getEnabledFeaturesDisplay()` returns an HTML fragment (not plain text) suitable for embedding directly in a GAS `HtmlService` dialog.

---

## 📥 Data Inputs
| Input | Source | Notes |
|---|---|---|
| `SITE_CONFIG.features` | `SiteConfig_TEMPLATE.gs` global | Read at call time — must be populated before `buildFeatureMenu()` |
| `features.mixedGradeSupport.combinations` | Feature config string | Comma-separated `+`-joined grade combos |
| `ui` parameter | `SpreadsheetApp.getUi()` | Passed in from `onOpen()` |
| `baseMenu` parameter | Caller-constructed `Menu` object | Items are appended in-place |

---

## 📤 Outputs
| Output | Description |
|---|---|
| Mutated `Menu` object | `buildFeatureMenu()` returns `baseMenu` with feature submenus appended |
| `Logger` entries | `initializeFeatureModules()` logs status of each enabled module |
| HTML string | `getEnabledFeaturesDisplay()` returns `<ul>` fragment for dialogs |
| Grade list array | `getGradeList()` returns `string[]` of grades for a code |
| Sheet name string | `getSheetNameForGradeCode()` returns the resolved sheet name |

---

## 🔗 Dependencies

### Feature Flag
None — this file *reads* all feature flags but is itself always loaded.

### Depends On (calls into)
| File / Symbol | Purpose |
|---|---|
| `SiteConfig_TEMPLATE.gs` → `SITE_CONFIG` | Feature flag source |
| `UnifiedConfig.gs` → `isFeatureEnabled()` | Feature flag gate helper |
| `UnifiedConfig.gs` → `getFeatureConfig()` | Reads per-feature config sub-object |
| `UnifiedConfig.gs` → `getFeatureMenuLabel()` | Returns `{icon, label}` for menu labels |
| `UnifiedConfig.gs` → `getEnabledFeatures()` | Returns array of active feature keys |
| `SpreadsheetApp` (GAS built-in) | `getActiveSpreadsheet()` in `initializeFeatureModules()` |

### Used By (called from)
| File | Context |
|---|---|
| `gold-standard-template/modules/onOpen_Example.gs` | `onOpen()` calls `buildFeatureMenu(ui, baseMenu)` |
| `SetupWizard.gs` | Same `onOpen()` pattern in all school implementations |

---

## ⚙️ Function Reference

### `buildFeatureMenu(ui, baseMenu)`
**Description:** Iterates over all known feature flags and appends the corresponding submenu to `baseMenu` for each enabled feature. Pre-K HWT, Coaching Dashboard, Tutoring System, Grant Reporting, Growth Highlighter, and Admin Import are all handled here. Returns the mutated menu object so the caller can chain `.addToUi()`.

**Parameters:**
- `ui` (Ui): The `SpreadsheetApp.getUi()` object — used to create submenus.
- `baseMenu` (Menu): The root menu being assembled in `onOpen()`.

**Returns:** (Menu) The same `baseMenu` reference with feature submenus appended.

---

### `getGradeList(gradeCode)`
**Description:** Returns the full list of grades that share a sheet with `gradeCode`. When `mixedGradeSupport` is disabled or the grade appears in no combination, returns `[gradeCode]`. Used by sheet-routing logic in the form and sync engines.

**Parameters:**
- `gradeCode` (string): A grade identifier such as `"KG"`, `"G1"`, or `"G6"`.

**Returns:** (Array\<string\>) One or more grade codes that belong to the same combined sheet.

---

### `getSheetNameForGradeCode(gradeCode)`
**Description:** Resolves a grade code to its physical sheet name. For single grades returns `"<grade> Groups"`. For mixed grades returns `"<first> to <last> Groups"` (e.g., `"G6 to G8 Groups"`).

**Parameters:**
- `gradeCode` (string): A grade identifier such as `"KG"` or `"G7"`.

**Returns:** (string) The sheet name where groups for this grade are stored.

---

### `initializeFeatureModules()`
**Description:** Called once during setup completion (or from the Setup Wizard) to log the state of every module and perform lightweight readiness checks (e.g., verifying a Coaching Dashboard sheet exists or that Monday.com is configured with a board ID). Does not create sheets or data — those are deferred to first use.

**Parameters:** None.

**Returns:** (void)

---

### `getEnabledFeaturesDisplay()`
**Description:** Builds an HTML `<ul>` list of all currently-enabled optional features for display in setup or settings dialogs. Uses human-readable names mapped from feature keys.

**Parameters:** None.

**Returns:** (string) An HTML fragment. Returns `<p>No optional features are currently enabled.</p>` when no flags are set.
