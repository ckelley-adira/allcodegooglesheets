# SiteConfig_TEMPLATE.gs

## 📋 Overview

`SiteConfig_TEMPLATE.gs` is the **school-specific configuration file** for the UFLI Master System. It defines the global `SITE_CONFIG` object and all per-feature configuration constants, plus a set of helper functions that the rest of the system uses to query feature state and branding.

**Role in the system:** Every school deployment gets its own copy of this file (renamed and customised). The Setup Wizard (or direct editing) populates `SITE_CONFIG` with the school's identity, grade range, layout options, feature flags, and branding. All other modules read from `SITE_CONFIG` rather than maintaining their own settings. This is the **single source of truth** for what capabilities are active in a given deployment.

**Version:** 7.0 — Unified School Site Template (Phase 7)

**Key design principles:**
- All optional features default to `false`; opt-in by setting the flag to `true`
- The Setup Wizard writes these values automatically; direct editing is also supported
- Feature-specific configuration objects (`COACHING_CONFIG`, `TUTORING_CONFIG`, etc.) live alongside `SITE_CONFIG` in this file and are read by their respective modules
- `BRANDING_CONFIG` is a computed constant that mirrors `SITE_CONFIG.branding` for modules that read it directly

---

## 📜 Business Rules

- **`isFeatureEnabled(featureName)`** is the canonical way to check a feature flag anywhere in the system; it returns `true` only if the flag value is strictly `=== true`.
- **`preKSystem`** is a tri-state: `false` (disabled), `"light"` (basic Pre-K tracking), `"hwt"` (full HWT system). It is not treated as a boolean feature flag — use `isPreKEnabled()`, `isPreKHWT()`, or `getPreKMode()` instead of `isFeatureEnabled('preKSystem')`.
- **`gradeRangeModel`** presets populate `gradesServed` via the wizard. Valid presets: `"prek_only"`, `"k5"`, `"k8"`, `"prek_8"`, `"custom"`. Custom allows manual population of `gradesServed`.
- **`layout.dataStartRow`** must always equal `layout.headerRowCount + 1`. Mismatches will cause off-by-one read errors throughout the system.
- **`layout.groupFormat`** controls how group sheets are structured: `"standard"` | `"condensed"` | `"expanded"` | `"sankofa"` | `"prek"`.
- **`getMenuName()`** priority: `menuCustomization.menuName` → `branding.shortName` → `"UFLI Tools"`.
- **`getFeatureConfig(featureName)`** maps a feature name to its configuration object. Features not in the map return `{}`.
- **Sync flags:** `ufliMapQueue`, `syncQueueProcessing`, and `nightlySyncAutomation` all map to `SYNC_CONFIG`. They default to `true` (on by default for all schools).
- **`enhancedSecurity`** defaults to `true`. This activates `sanitizeCellValue()` for all user-written data.
- **`lessonArrayTracking`** defaults to `true`. Enables batch lesson-array operations for better performance.
- **Legacy upgrades:** `isLegacyUpgrade()` returns `true` if `versionTracking.legacyConfigFormat` is non-empty. Used to gate backward-compatible shims.
- **Grant reporting thresholds:** `GRANT_CONFIG.gapThreshold` = 50% (skills below this are "gaps"), `GRANT_CONFIG.criticalThreshold` = 25% (skills below this are "critical gaps").
- **Nightly sync:** `SYNC_CONFIG.nightlySyncHour` = 2 (2 AM in spreadsheet timezone), `SYNC_CONFIG.batchSize` = 200 entries per run.
- **Coaching lookback:** `COACHING_CONFIG.lookbackWeeks` = 4.
- **Growth Highlighter:** highlight color is `'#FFF59D'` (light yellow); target group is `'Unenrolled or Finished Sequence'`.
- **Unenrollment automation:** Creates Monday.com tasks when `UNENROLLMENT_CONFIG.createMondayTask = true`; requires `mondayBoardId` to be set.

---

## 📥 Data Inputs

This file does not read from any sheet. It is a **static configuration** file that is:
- Populated by the Setup Wizard writing back to it (or via direct editing)
- Read by every other `.gs` file at script load time as globally scoped constants

Helper functions accept no parameters (they read from the module-level `SITE_CONFIG` constant directly).

---

## 📤 Outputs

All outputs are **return values from helper functions** — no sheet writes occur in this file.

| Function | Returns |
|----------|---------|
| `isFeatureEnabled()` | `boolean` |
| `getBranding()` | Branding configuration object |
| `getFeatureConfig()` | Feature-specific configuration object |
| `getEnabledFeatures()` | `Array<string>` of enabled feature names |
| `getMenuName()` | `string` menu title |
| `getFeatureMenuLabel()` | `{ label: string, icon: string }` |
| `getPreKMode()` | `false \| "light" \| "hwt"` |
| `isPreKHWT()` | `boolean` |
| `isPreKEnabled()` | `boolean` |
| `isPreKOnlySite()` | `boolean` |
| `isLegacyUpgrade()` | `boolean` |
| `getVersionTracking()` | Version tracking metadata object |

---

## 🔗 Dependencies

### Depends On (calls into)

None. This file has no external dependencies — it only declares constants and pure-function helpers.

### Used By (called from)

| File | What it reads |
|------|---------------|
| `UnifiedConfig.gs` | `SITE_CONFIG` object — builds `LAYOUT`, `COLORS`, `SHEET_NAMES` from it |
| `modules/ModuleLoader.gs` | `isFeatureEnabled()`, `getMenuName()`, `getFeatureMenuLabel()`, `getPreKMode()` |
| `modules/MixedGradeSupport.gs` | `isFeatureEnabled('mixedGradeSupport')` via `ENABLE_MIXED_GRADES` |
| `modules/AdminImport.gs` | `IMPORT_CONFIG` |
| `modules/CoachingDashboard.gs` | `isFeatureEnabled('coachingDashboard')`, `COACHING_CONFIG` |
| `modules/TutoringSystem.gs` | `isFeatureEnabled('tutoringSystem')`, `TUTORING_CONFIG` |
| `modules/GrantReporting.gs` | `isFeatureEnabled('grantReporting')`, `GRANT_CONFIG` |
| `modules/GrowthHighlighter.gs` | `isFeatureEnabled('growthHighlighter')`, `GROWTH_CONFIG` |
| `modules/UnenrollmentAutomation.gs` | `isFeatureEnabled('unenrollmentAutomation')`, `UNENROLLMENT_CONFIG` |
| `Phase2_ProgressTracking.gs` | `SITE_CONFIG`, `PROGRESS_TRACKING_CONFIG`, `SYNC_CONFIG` |
| `SetupWizard.gs` | `SITE_CONFIG`, `getBranding()`, `isFeatureEnabled()` |
| All HTML files | `getBranding()` for `<?= … ?>` template tokens |

---

## ⚙️ SITE_CONFIG Object Structure

### Basic Settings

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `schoolName` | string | `"Your School Name"` | Display name for the school |
| `systemVersion` | string | `"7.0"` | Current system version |

### Grade Range Model

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `gradeRangeModel` | string | `"custom"` | Preset: `"prek_only"`, `"k5"`, `"k8"`, `"prek_8"`, or `"custom"` |
| `gradesServed` | Array\<string\> | `[]` | Active grade codes: `"PreK"`, `"KG"`, `"G1"`–`"G8"` |

### Layout

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `layout.headerRowCount` | number | `5` | Number of header rows (3–10) |
| `layout.dataStartRow` | number | `6` | First data row = headerRowCount + 1 |
| `layout.lessonColumnOffset` | number | `5` | 0-based column index of first lesson column (col F = 5) |
| `layout.lessonsPerGroupSheet` | number | `12` | Lesson columns shown on each group sheet |
| `layout.groupFormat` | string | `"standard"` | `"standard"`, `"condensed"`, `"expanded"`, `"sankofa"`, or `"prek"` |
| `layout.includeSCClassroom` | boolean | `false` | Add a Self-Contained Classroom column |

### Branding

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `branding.schoolName` | string | `"Your School Name"` | School display name |
| `branding.shortName` | string | `""` | Short name used in menu titles |
| `branding.tagline` | string | `"Innovate. Educate. Empower."` | Tagline for wizard/reports |
| `branding.logoUrl` | string | `""` | Google Drive file ID or public URL for logo |
| `branding.primaryColor` | string | `"#B8E6DC"` | Main accent colour for UI |
| `branding.headerGradientStart` | string | `"#4A90E2"` | Wizard header gradient start |
| `branding.headerGradientEnd` | string | `"#357ABD"` | Wizard header gradient end |
| `branding.accentColor` | string | `"#4A90A4"` | Secondary accent for sidebars |

### Version Tracking

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `versionTracking.previousVersions` | Array\<string\> | `[]` | Prior system version values |
| `versionTracking.upgradeDate` | string | `""` | ISO date of last upgrade (e.g., `"2026-02-19"`) |
| `versionTracking.legacyConfigFormat` | string | `""` | Legacy format name if migrated (e.g., `"v3.2"`) |

### Menu Customization

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `menuCustomization.menuName` | string | `""` | Override top-level menu name |
| `menuCustomization.featureLabels` | Object | `{}` | Map of `featureName → { label, icon }` overrides |

### Feature Flags (`features`)

| Flag | Type | Default | Module | Description |
|------|------|---------|--------|-------------|
| `preKSystem` | `false\|"light"\|"hwt"` | `false` | `PreKMainCode.gs` | Pre-K tracking mode |
| `mixedGradeSupport` | boolean | `false` | `MixedGradeSupport.gs` | Cross-grade skill-based grouping |
| `coachingDashboard` | boolean | `false` | `CoachingDashboard.gs` | Weekly coaching metrics dashboard |
| `tutoringSystem` | boolean | `false` | `TutoringSystem.gs` | Dual-track tutoring/intervention |
| `grantReporting` | boolean | `false` | `GrantReporting.gs` | Automated grant report generation |
| `growthHighlighter` | boolean | `false` | `GrowthHighlighter.gs` | Visual student growth highlighting |
| `adminImport` | boolean | `false` | `AdminImport.gs` | Bulk CSV data import |
| `enhancedSecurity` | boolean | `true` | `AdminImport.gs` | Formula injection prevention |
| `structuredLogging` | boolean | `false` | `AdminImport.gs` | Structured diagnostic logging |
| `unenrollmentAutomation` | boolean | `false` | `UnenrollmentAutomation.gs` | Auto-archival + Monday.com integration |
| `scClassroomGroups` | boolean | `false` | `MixedGradeSupport.gs` | SC Classroom sheet support |
| `coTeachingSupport` | boolean | `false` | `MixedGradeSupport.gs` | Partner group co-teaching pairs |
| `dynamicBranding` | boolean | `false` | Branding extensions | Logo insertion + custom colour schemes |
| `skillAveragesAnalytics` | boolean | `false` | `Phase2_ProgressTracking.gs` | Skill mastery averages on dashboard |
| `diagnosticTools` | boolean | `false` | Various | Testing and validation utilities |
| `lessonArrayTracking` | boolean | `true` | `Phase2_ProgressTracking.gs` | Batch lesson-array operations |
| `studentNormalization` | boolean | `false` | Name normalisation extension | Auto-capitalize/clean student names |
| `dynamicStudentRoster` | boolean | `false` | `Phase2_ProgressTracking.gs` | Mid-year student additions |
| `ufliMapQueue` | boolean | `true` | `Phase2_ProgressTracking.gs` | Deferred UFLI MAP updates via sync queue |
| `syncQueueProcessing` | boolean | `true` | `Phase2_ProgressTracking.gs` | Hourly sync trigger |
| `nightlySyncAutomation` | boolean | `true` | `Phase2_ProgressTracking.gs` | Full nightly data reconciliation |
| `syncStatusMonitoring` | boolean | `false` | `Phase2_ProgressTracking.gs` | Sync queue status dashboard |
| `formulaRepairTools` | boolean | `false` | `AdminImport.gs` | Grade Summary formula refresh utilities |
| `studentEditCapability` | boolean | `false` | Student management | In-sheet student record editing |
| `preKOnlyMode` | boolean | `false` | Legacy | Deprecated; use `preKSystem` instead |

---

## ⚙️ Feature Module Configuration Objects

### `MIXED_GRADE_CONFIG`
Used when `features.mixedGradeSupport = true`.

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `enabled` | boolean | `false` | Enable mixed grade grouping |
| `sheetFormat` | string | `"STANDARD"` | `"STANDARD"` or `"SANKOFA"` |
| `combinations` | Object | `{}` | `{ "Sheet Name": ["G6","G7","G8"] }` mappings |
| `namingPattern` | string | `"NUMBERED_TEACHER"` | `"NUMBERED_TEACHER"`, `"NUMBERED"`, or `"ALPHA"` |
| `scClassroom.gradeRange` | Array\<string\> | `[]` | Grades included in SC Classroom |
| `scClassroom.hasSubGroups` | boolean | `true` | Whether SC Classroom has sub-groups |
| `scClassroom.sheetName` | string | `"SC Classroom"` | Sheet name for SC Classroom |
| `coTeaching.partnerGroupColumn` | number | `0` | 1-based column for partner group (0 = disabled) |

### `COACHING_CONFIG`
Used when `features.coachingDashboard = true`.

| Property | Default | Description |
|----------|---------|-------------|
| `dashboardSheet` | `"Weekly Coaching Dashboard"` | Sheet name |
| `autoRefresh` | `true` | Auto-refresh schedule |
| `lookbackWeeks` | `4` | Metrics lookback period |

### `TUTORING_CONFIG`
Used when `features.tutoringSystem = true`.

| Property | Default | Description |
|----------|---------|-------------|
| `progressLog` | `"Tutoring Progress Log"` | Log sheet name |
| `summary` | `"Tutoring Summary"` | Summary sheet name |
| `categories.ufliReteach` | `"UFLI Reteach"` | Category label |
| `categories.comprehension` | `"Comprehension"` | Category label |
| `categories.other` | `"Other"` | Category label |

### `GRANT_CONFIG`
Used when `features.grantReporting = true`.

| Property | Default | Description |
|----------|---------|-------------|
| `reportSheet` | `"Mind Trust Summary"` | Report sheet name |
| `lookbackDays` | `14` | Reporting window |
| `gapThreshold` | `50` | Skills below this % = gap |
| `criticalThreshold` | `25` | Skills below this % = critical gap |
| `autoSchedule` | `false` | Auto-schedule reports |
| `scheduleFrequency` | `14` | Days between reports |

### `GROWTH_CONFIG`
Used when `features.growthHighlighter = true`.

| Property | Default | Description |
|----------|---------|-------------|
| `highlightColor` | `'#FFF59D'` | Highlight colour (light yellow) |
| `targetGroup` | `'Unenrolled or Finished Sequence'` | Group to highlight |

### `IMPORT_CONFIG`
Used when `features.adminImport = true`.

| Property | Default | Description |
|----------|---------|-------------|
| `stagingSheet` | `"Import Staging"` | Staging sheet name |
| `exceptionsSheet` | `"Import Exceptions"` | Exceptions sheet name |
| `historicalSheet` | `"Small Group Historical"` | Historical archive sheet |

### `UNENROLLMENT_CONFIG`
Used when `features.unenrollmentAutomation = true`.

| Property | Default | Description |
|----------|---------|-------------|
| `archiveSheet` | `"Student Archive"` | Archive sheet name |
| `autoDeleteFromGroups` | `true` | Remove from groups on unenrollment |
| `createMondayTask` | `true` | Create Monday.com task |
| `mondayBoardId` | `""` | Monday.com board ID (must be set) |
| `enableAuditLog` | `true` | Enable audit logging |

### `PROGRESS_TRACKING_CONFIG`
Settings for `Phase2_ProgressTracking.gs`.

| Property | Default | Description |
|----------|---------|-------------|
| `schoolSummary` | `"School Summary"` | Sheet name |
| `smallGroupProgress` | `"Small Group Progress"` | Sheet name |
| `ufliMap` | `"UFLI MAP"` | Sheet name |
| `skillsTracker` | `"Skills Tracker"` | Sheet name |
| `gradeSummary` | `"Grade Summary"` | Sheet name |
| `pacingReport` | `"Pacing Report"` | Sheet name |
| `groupConfig` | `"Group Config"` | Sheet name |
| `dashboardMetrics.showGrowthMetrics` | `true` | Show growth metrics |
| `dashboardMetrics.showDistributionBands` | `true` | Show distribution bands |
| `dashboardMetrics.showSkillAverages` | `false` | Controlled by `skillAveragesAnalytics` |
| `dashboardMetrics.showPacingAnalysis` | `true` | Show pacing analysis |
| `autoRepairFormulas` | `false` | Auto-repair formulas on update |
| `trackHistory` | `true` | Track progress history |
| `historyLookbackDays` | `90` | History lookback window |

### `SYNC_CONFIG`
Used when `features.ufliMapQueue`, `syncQueueProcessing`, or `nightlySyncAutomation = true`.

| Property | Default | Description |
|----------|---------|-------------|
| `syncQueueSheet` | `"UFLI Sync Queue"` | Queue sheet name |
| `syncIntervalMinutes` | `60` | Hourly trigger interval |
| `nightlySyncHour` | `2` | Hour for nightly sync (0–23, spreadsheet timezone) |
| `batchSize` | `200` | Max entries per sync run |
| `statusSheet` | `"Sync Status"` | Status monitoring sheet |

### `BRANDING_CONFIG`
A computed constant (IIFE) that mirrors `SITE_CONFIG.branding` with fallback defaults. Used by modules that access branding directly without going through `SITE_CONFIG`. Only active when `features.dynamicBranding = true`.

---

## ⚙️ Function Reference

### `isFeatureEnabled(featureName)`
**Description:** Returns `true` if the named feature flag in `SITE_CONFIG.features` is strictly `=== true`. Does not handle tri-state flags (use `getPreKMode()` for `preKSystem`).
**Parameters:**
- `featureName` (string): Feature flag name (e.g., `'mixedGradeSupport'`)

**Returns:** `(boolean)` `true` if enabled

---

### `getBranding()`
**Description:** Returns `SITE_CONFIG.branding` with built-in fallback defaults for each property. Used by HTML templates via `<?= getBranding().property ?>` syntax.
**Parameters:** None
**Returns:** `(Object)` `{ schoolName, shortName, tagline, logoUrl, primaryColor, headerGradientStart, headerGradientEnd, accentColor }`

---

### `getFeatureConfig(featureName)`
**Description:** Returns the module-level configuration object for the given feature name. Known mappings: `mixedGradeSupport → MIXED_GRADE_CONFIG`, `coachingDashboard → COACHING_CONFIG`, `tutoringSystem → TUTORING_CONFIG`, `grantReporting → GRANT_CONFIG`, `growthHighlighter → GROWTH_CONFIG`, `adminImport → IMPORT_CONFIG`, `unenrollmentAutomation → UNENROLLMENT_CONFIG`, `progressTracking → PROGRESS_TRACKING_CONFIG`, `ufliMapQueue/syncQueueProcessing/nightlySyncAutomation/syncStatusMonitoring → SYNC_CONFIG`, `dynamicBranding → BRANDING_CONFIG`. Returns `{}` for unknown features.
**Parameters:**
- `featureName` (string): Feature flag name

**Returns:** `(Object)` Configuration object for the feature

---

### `getEnabledFeatures()`
**Description:** Returns all feature names whose flag value is strictly `true`. Excludes tri-state flags like `preKSystem` unless it happens to be set to `true` (which it should not be).
**Parameters:** None
**Returns:** `(Array<string>)` Enabled feature names

---

### `getMenuName()`
**Description:** Returns the effective top-level menu name. Checks (in order): `menuCustomization.menuName` → `branding.shortName` → `"UFLI Tools"`.
**Parameters:** None
**Returns:** `(string)` Menu title string

---

### `getFeatureMenuLabel(featureName, defaultLabel, defaultIcon)`
**Description:** Returns the display label and icon for a feature's menu item. Checks `menuCustomization.featureLabels[featureName]` first; falls back to the provided defaults.
**Parameters:**
- `featureName` (string): Feature flag name
- `defaultLabel` (string): Default menu item text
- `defaultIcon` (string): Default emoji icon

**Returns:** `(Object)` `{ label: string, icon: string }`

---

### `getPreKMode()`
**Description:** Returns the active Pre-K mode: `false` (disabled), `"light"` (basic tracking), or `"hwt"` (full HWT system). Ignores any other value.
**Parameters:** None
**Returns:** `(false|"light"|"hwt")` Pre-K mode

---

### `isPreKHWT()`
**Description:** Returns `true` when the full HWT Pre-K system is active (`preKSystem === "hwt"`).
**Parameters:** None
**Returns:** `(boolean)`

---

### `isPreKEnabled()`
**Description:** Returns `true` when any Pre-K support is active — either `"light"` or `"hwt"` mode.
**Parameters:** None
**Returns:** `(boolean)`

---

### `isPreKOnlySite()`
**Description:** Legacy check for the deprecated `preKOnlyMode` flag. Returns `true` if that flag is set to `true`. New deployments should use `getPreKMode()` instead.
**Parameters:** None
**Returns:** `(boolean)`

---

### `isLegacyUpgrade()`
**Description:** Returns `true` if `versionTracking.legacyConfigFormat` is a non-empty string, indicating this site was migrated from a legacy configuration.
**Parameters:** None
**Returns:** `(boolean)`

---

### `getVersionTracking()`
**Description:** Returns the version tracking metadata object, with safe defaults if `versionTracking` is not set.
**Parameters:** None
**Returns:** `(Object)` `{ previousVersions: Array<string>, upgradeDate: string, legacyConfigFormat: string }`
