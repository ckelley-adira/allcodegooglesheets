# Phase 7: Unified School Site Template

## Overview

Phase 7 introduces a **unified school site template** that eliminates the need for per-school copies of logic files. A single codebase, configured through the SetUp Wizard and `SiteConfig_TEMPLATE.gs`, supports all school configurations — from Pre-K-only sites to full K–8 implementations with mixed grades, tutoring, coaching, and grant reporting.

## What's New

### 1. `UnifiedConfig.gs` — Configuration Resolver

A centralized module that resolves **all** school-specific constants at runtime from `SITE_CONFIG`:

| Constant | Previously Defined In | Now Resolved By |
|----------|----------------------|-----------------|
| `LAYOUT` (DATA_START_ROW, HEADER_ROW_COUNT, etc.) | Each school's Phase2 file | `getUnifiedConfig()` |
| `SHEET_NAMES_V2` (UFLI MAP, Skills Tracker, etc.) | Each school's Phase2 file | `getUnifiedConfig()` |
| `PREK_CONFIG` (denominators, header row) | Each school's Phase2 file | `getUnifiedConfig()` |
| `COLORS` (header, pass/fail colors) | Each school's Phase2 file | `getUnifiedConfig()` |
| `GRADE_METRICS` | `SHARED_GRADE_METRICS` in SharedEngine | `getUnifiedConfig()` |

**Key functions:**
- `getUnifiedConfig()` — Returns the complete configuration object for the current school
- `getGradeRangeModels()` — Returns available grade range model presets for the wizard
- `getDefaultGradesForModel(modelId)` — Returns default grades for a model preset
- `validateUnifiedConfig(config)` — Validates a config object has all required properties

### 2. `UnifiedPhase2_ProgressTracking.gs` — Parameterized Phase 2

Replaces **all 6** per-school Phase2 files with a single parameterized implementation:

- `generateSystemSheets(ss, wizardData)` — Creates all required Google Sheets tabs based on configuration
- `recalculateAllStatsNow()` — Recalculates all statistics using unified configuration
- Sheet generators for: UFLI MAP, Grade Groups, Skills Tracker, Grade Summary, Initial Assessment, School Summary, Pre-K Data, Pacing

### 3. Grade Range Model Presets

The SetUp Wizard now offers **preset grade range models** for quick configuration:

| Model | Grades | Description |
|-------|--------|-------------|
| Pre-K Only | PreK | Handwriting Without Tears curriculum only |
| K–5 Elementary | KG–G5 | Standard elementary school |
| K–8 Full Range | KG–G8 | Full K-8 school |
| Pre-K through 8 | PreK–G8 | Dual-curriculum support (HWT + UFLI) |
| Custom | (user-selected) | Manual grade selection |

### 4. Expanded `SiteConfig_TEMPLATE.gs`

New configuration sections added:

```javascript
const SITE_CONFIG = {
  // Grade Range Model (Phase 7)
  gradeRangeModel: "k8",        // "prek_only", "k5", "k8", "prek_8", "custom"
  gradesServed: [],              // Explicit grade list for "custom" model

  // Sheet Layout (Phase 7)
  layout: {
    headerRowCount: 5,           // Number of header rows (3-10)
    dataStartRow: 6,             // First data row
    lessonColumnOffset: 5,       // Offset to first lesson column
    lessonsPerGroupSheet: 12,    // Lessons per group sheet
    groupFormat: "standard",     // "standard", "condensed", "expanded", "sankofa"
    includeSCClassroom: false    // SC Classroom column
  },

  // ... existing branding and features sections ...
};
```

### 5. Dynamic Feature Menus

The `onOpen()` menu now uses `buildFeatureMenu()` from `ModuleLoader.gs` instead of hardcoded feature submenus:

**Before (hardcoded):**
```javascript
.addSubMenu(ui.createMenu('📚 Tutoring')
  .addItem('📋 View Tutoring Summary', ...))
.addSubMenu(ui.createMenu('🔐 Admin Tools')
  .addItem('📂 Open Import Dialog...', ...))
```

**After (dynamic, Phase 7):**
```javascript
// Feature modules added dynamically based on SITE_CONFIG.features
if (typeof buildFeatureMenu === 'function') {
  buildFeatureMenu(ui, baseMenu);
}
```

Only enabled features appear in the menu. Toggle features on/off by changing `SITE_CONFIG.features` flags.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ SetUp Wizard (UI)                                            │
│ ┌─────┐ ┌──────┐ ┌────────┐ ┌──────┐ ┌────────┐ ┌───────┐ │
│ │Name │→│Grades│→│Students│→│Groups│→│Features│→│Review │ │
│ │     │ │Model │ │Teachers│ │Mix   │ │Branding│ │Deploy │ │
│ └─────┘ └──────┘ └────────┘ └──────┘ └────────┘ └───────┘ │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ SiteConfig_TEMPLATE.gs                                       │
│ ┌──────────┐ ┌────────┐ ┌──────────┐ ┌────────┐            │
│ │schoolName│ │grades  │ │layout    │ │features│            │
│ │gradeModel│ │Served  │ │branding  │ │flags   │            │
│ └──────────┘ └────────┘ └──────────┘ └────────┘            │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ UnifiedConfig.gs                                             │
│ getUnifiedConfig() resolves → LAYOUT, SHEET_NAMES_V2,        │
│   PREK_CONFIG, COLORS, GRADE_METRICS                         │
└─────────────────────────────────────────────────────────────┘
                         │
              ┌──────────┼──────────┐
              ▼          ▼          ▼
┌──────────────┐ ┌────────────┐ ┌───────────────┐
│UnifiedPhase2 │ │SharedEngine│ │ModuleLoader   │
│ProgressTrack │ │calculateBm │ │buildFeatureMenu│
│generateSheets│ │updateStats │ │initModules    │
└──────────────┘ └────────────┘ └───────────────┘
```

## Migration Guide

### For New Schools (Greenfield)

1. Copy the template package to a new Google Sheet project
2. Open the spreadsheet — the SetUp Wizard launches automatically
3. Complete all wizard steps (school name, grade model, students, groups, features, branding, layout)
4. Click "Complete Setup" — all sheets are generated dynamically

**Required files for a new deployment:**
- `SiteConfig_TEMPLATE.gs`
- `UnifiedConfig.gs`
- `UnifiedPhase2_ProgressTracking.gs`
- `SharedConstants.gs`
- `SharedEngine.gs`
- `SetupWizard.gs`
- `SetupWizardUI.html`
- `modules/ModuleLoader.gs`
- `modules/` (any feature modules to enable)

### For Existing Schools (Migration)

1. Add `UnifiedConfig.gs` and `UnifiedPhase2_ProgressTracking.gs` to the project
2. Update `SiteConfig_TEMPLATE.gs` with the new `layout` and `gradeRangeModel` sections
3. Configure `SITE_CONFIG.layout` to match the school's current values:
   - Check the old Phase2 file for `DATA_START_ROW` and `HEADER_ROW_COUNT`
   - Set `SITE_CONFIG.layout.headerRowCount` and `SITE_CONFIG.layout.dataStartRow`
4. Verify the setup by re-running the wizard
5. Once verified, the old `[School]Phase2_ProgressTracking.gs` can be removed

**Example: Migrating Adelante (DATA_START_ROW=6, HEADER_ROW_COUNT=5)**
```javascript
layout: {
  headerRowCount: 5,
  dataStartRow: 6,
  lessonColumnOffset: 5,
  lessonsPerGroupSheet: 12,
  groupFormat: "standard",
  includeSCClassroom: false
}
```

**Example: Migrating CCA (DATA_START_ROW=5, HEADER_ROW_COUNT=4)**
```javascript
layout: {
  headerRowCount: 4,
  dataStartRow: 5,
  lessonColumnOffset: 5,
  lessonsPerGroupSheet: 12,
  groupFormat: "standard",
  includeSCClassroom: false
}
```

## School Configuration Matrix (Updated)

| School | Grade Model | Mixed Grade | Coaching | Tutoring | Grant | Growth | Admin | Unenroll |
|--------|-------------|-------------|----------|----------|-------|--------|-------|----------|
| **Adelante** | k8 | ✅ | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| **Sankofa** | k5 | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **GlobalPrep** | custom | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| **CHAW** | k8 | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **CCA** | custom | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Allegiant** | custom | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

## Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `UnifiedConfig.gs` | **NEW** | Configuration resolver — eliminates per-school constants |
| `UnifiedPhase2_ProgressTracking.gs` | **NEW** | Parameterized Phase2 — replaces 6 school copies |
| `SiteConfig_TEMPLATE.gs` | Already in `main` (Phase 7f / PR#30) | `gradeRangeModel`, expanded `layout` block, feature flags |
| `SetupWizard.gs` | Already in `main` (Phase 7f / PR#30) | `CONFIG_LAYOUT` constants, `getWizardData()` round-trip |
| `SetupWizardUI.html` | Already in `main` (Phase 7f / PR#30) | Grade range model dropdown, Step 6/8 form fields |
| `validate_shared_constants.js` | UPDATED | Phase 7 file and config validation |
| `PHASE7_UNIFIED_TEMPLATE.md` | **NEW** | This documentation |

## Testing Checklist

- [ ] New deployment: Wizard launches on first open
- [ ] Grade range model presets auto-select correct grades
- [ ] Custom grade model allows individual selection
- [ ] All system sheets generated with correct headers and formatting
- [ ] Pre-K Data sheet only created when PreK is in grades served
- [ ] Feature flags control menu items (no hardcoded feature menus)
- [ ] `recalculateAllStatsNow()` uses unified config correctly
- [ ] Layout settings (header rows, data start row) applied consistently
- [ ] Branding colors applied to sheet headers
- [ ] Existing schools can migrate without data loss
- [ ] `node validate_shared_constants.js` passes all checks

## Success Metrics

- **Code reduction:** 6 per-school Phase2 files → 1 unified file
- **Configuration:** All school differences expressed as data, not code
- **Deployment time:** New school setup requires only wizard completion
- **Upgrade path:** Bug fixes and features apply to all schools simultaneously
