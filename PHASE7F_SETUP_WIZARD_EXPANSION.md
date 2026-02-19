# Phase 7f — Setup Wizard & SiteConfig Expansion

## Overview

Phase 7f closes the configuration gap between the unified runtime modules
(`UnifiedConfig.gs`, `AdminImport_Unified.gs`, `MixedGradeSupport_Unified.gs`)
and the Setup Wizard UI. Previously, schools had to manually edit `.gs` files to
set values like `gradeRangeModel`, `dataStartRow`, `lessonColumnOffset`, and the
Phase 7b/7c feature flags. This phase exposes all those values through the
guided Setup Wizard so that no manual code editing is required.

---

## Architecture Summary

### Files Modified

| File | Changes |
|------|---------|
| `SiteConfig_TEMPLATE.gs` | Added `gradeRangeModel` to SITE_CONFIG basic settings; added `layout` block with `dataStartRow` and `lessonColumnOffset`; completed `MIXED_GRADE_CONFIG.coTeaching` shape with `partnerGroupColumn` |
| `SetupWizardUI.html` | Step 2: Grade Range Model dropdown with preset auto-selection; Step 6: 4 new system/security feature checkboxes; Step 8: `dataStartRow` + `lessonColumnOffset` inputs; `loadExistingData()` round-trip for all new fields |
| `SetupWizard.gs` | Added `GRADE_RANGE_MODEL_ROW`, `DATA_START_ROW_CONFIG_ROW`, `LESSON_COLUMN_OFFSET_ROW` constants to `CONFIG_LAYOUT`; persist/load `gradeRangeModel`, `dataStartRow`, `lessonColumnOffset` in `createConfigurationSheet()`, `getWizardData()`, `getExistingSheetLayout()` |

### New File

| File | Purpose |
|------|---------|
| `PHASE7F_SETUP_WIZARD_EXPANSION.md` | This document — architecture summary, migration notes, QA checklist |

### Config Sheet Row Layout (after Phase 7f)

| Row | Label | Source |
|-----|-------|--------|
| 1 | Header | — |
| 2 | School Name | Step 1 |
| 3 | Grade Range Model | Step 2 |
| 4 | Grades Served (header) | — |
| 5–14 | Grade checkboxes | Step 2 |
| 16 | Grade Mixing (header) | — |
| 17 | Allow Grade Mixing | Step 5 |
| 18 | Mixed Grade Combinations | Step 5 |
| 20 | System Version | Auto |
| 21 | Last Updated | Auto |
| 23 | Branding (header) | — |
| 24 | Primary Color | Step 7 |
| 25 | Secondary Color | Step 7 |
| 26 | Logo File ID | Step 7 |
| 28 | Layout (header) | — |
| 29 | Header Row Count | Step 8 |
| 30 | Group Format | Step 8 |
| 31 | Include SC Classroom | Step 8 |
| 32 | Data Start Row | Step 8 |
| 33 | Lesson Column Offset | Step 8 |

### Grade Range Model Presets

| Model Key | Grades Auto-Selected |
|-----------|---------------------|
| `prek_only` | PreK |
| `k5` | KG, G1–G5 |
| `k8` | KG, G1–G8 |
| `prek_8` | PreK, KG, G1–G8 |
| `custom` | Manual selection (no auto-check) |

### New Feature Checkboxes (Step 6)

| Feature Flag | Default | Description |
|-------------|---------|-------------|
| `enhancedSecurity` | ON | Input sanitization and formula injection prevention |
| `structuredLogging` | OFF | Detailed logging for troubleshooting and auditing |
| `scClassroomGroups` | OFF | SC (special needs) classroom support |
| `coTeachingSupport` | OFF | Partner group tracking for co-taught classes |

---

## Migration Notes for Existing Schools

Schools that have already completed setup via the wizard (pre-Phase 7f) will
see default values when they re-run the wizard:

| Field | Default | Action Required |
|-------|---------|----------------|
| `gradeRangeModel` | `"custom"` | None — existing grade selections are preserved |
| `dataStartRow` | `6` | Only change if your school uses a non-standard header layout |
| `lessonColumnOffset` | `5` | Only change if lesson data starts in a different column |
| `enhancedSecurity` | `true` | Recommended to leave ON |
| `structuredLogging` | `false` | Enable if audit trails are needed |
| `scClassroomGroups` | `false` | Enable for schools with SC programs |
| `coTeachingSupport` | `false` | Enable for co-teaching model schools |

**No data loss occurs.** The wizard reads existing values via `getWizardData()`
and pre-populates all fields. New fields use safe defaults that match the
pre-Phase 7f behavior.

---

## QA Checklist

### SiteConfig_TEMPLATE.gs
- [ ] `SITE_CONFIG.gradeRangeModel` exists and defaults to `"custom"`
- [ ] `SITE_CONFIG.layout` block contains `dataStartRow`, `lessonColumnOffset`, `headerRowCount`, `groupFormat`, `includeSCClassroom`
- [ ] `MIXED_GRADE_CONFIG.coTeaching.partnerGroupColumn` exists and defaults to `0`
- [ ] All existing feature flags remain unchanged

### SetupWizard.gs
- [ ] `CONFIG_LAYOUT.SITE_CONFIG.GRADE_RANGE_MODEL_ROW` equals `3`
- [ ] `CONFIG_LAYOUT.SITE_CONFIG.DATA_START_ROW_CONFIG_ROW` equals `32`
- [ ] `CONFIG_LAYOUT.SITE_CONFIG.LESSON_COLUMN_OFFSET_ROW` equals `33`
- [ ] `getWizardData()` returns `gradeRangeModel` in its response
- [ ] `getWizardData()` returns `sheetLayout.dataStartRow` and `sheetLayout.lessonColumnOffset`
- [ ] `createConfigurationSheet()` writes Grade Range Model to row 3
- [ ] `createConfigurationSheet()` writes Data Start Row to row 32
- [ ] `createConfigurationSheet()` writes Lesson Column Offset to row 33
- [ ] Font family range covers rows 2–33

### SetupWizardUI.html
- [ ] Step 2: Grade Range Model dropdown appears above grade checkboxes
- [ ] Step 2: Selecting a preset auto-checks matching grades
- [ ] Step 2: Manually toggling a checkbox switches dropdown to "Custom"
- [ ] Step 6: Four system/security checkboxes render below existing feature categories
- [ ] Step 6: Enhanced Security defaults to checked
- [ ] Step 8: Data Start Row input with default 6
- [ ] Step 8: Lesson Column Offset input with default 5
- [ ] Step 9 (Review): Grade Range Model displays in summary
- [ ] Step 9 (Review): Data Start Row and Lesson Column Offset display in summary
- [ ] `loadExistingData()` round-trips all new fields from server

### Backward Compatibility
- [ ] Existing schools with no row 3/32/33 data load without error (defaults applied)
- [ ] Re-running the wizard preserves all previously saved values
- [ ] No existing feature flags are renamed or removed
