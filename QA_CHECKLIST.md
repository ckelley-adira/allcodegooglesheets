# Phase 4 QA Checklist
## Feature Modules Testing & Validation

Use this checklist to validate the Phase 4 implementation before deploying to production.

---

## Pre-Testing Setup

### Environment Preparation
- [ ] Create a test copy of the school's spreadsheet
- [ ] Note current functionality (what features are active)
- [ ] Document current menu structure (screenshot recommended)
- [ ] Verify all data is preserved in the copy

### File Installation
- [ ] Add `SiteConfig_TEMPLATE.gs` to Apps Script project
- [ ] Add `modules/ModuleLoader.gs` to Apps Script project
- [ ] Add relevant feature modules based on school's needs
- [ ] Save all files in Apps Script editor

---

## Core System Testing (All Features Disabled)

Test that the core system works when all features are disabled.

### Configuration
- [ ] Set all feature flags to `false` in `SiteConfig_TEMPLATE.gs`:
```javascript
features: {
  mixedGradeSupport: false,
  coachingDashboard: false,
  tutoringSystem: false,
  grantReporting: false,
  growthHighlighter: false,
  adminImport: false,
  unenrollmentAutomation: false
}
```

### Menu Validation
- [ ] Reload spreadsheet
- [ ] Verify main menu appears
- [ ] Verify NO feature-specific submenus appear
- [ ] Core menu items present:
  - [ ] View School Summary
  - [ ] Generate Reports
  - [ ] Manage Students
  - [ ] Manage Groups
  - [ ] Sync & Performance submenu
  - [ ] System Settings

### Core Functionality
- [ ] View School Summary sheet - opens correctly
- [ ] Generate Reports - produces reports
- [ ] Manage Students - dialog opens
- [ ] Manage Groups - dialog opens
- [ ] Recalculate All Stats - runs without errors
- [ ] Re-run Setup Wizard - accessible

### Error Check
- [ ] No JavaScript errors in browser console (F12)
- [ ] No execution errors in Apps Script logs
- [ ] All sheets accessible
- [ ] Data intact and correct

**Result:** Core system works independently ✅ / ❌

---

## Feature Testing (Individual Features)

Test each feature module independently by enabling one at a time.

### 1. Mixed Grade Support Module

**Enable:**
```javascript
features: {
  mixedGradeSupport: true,
  // ... all others false
}
```

**Configure:**
```javascript
MIXED_GRADE_CONFIG = {
  enabled: true,
  combinations: "G6+G7+G8, G1+G2+G3+G4"
}
```

**Tests:**
- [ ] Reload spreadsheet
- [ ] Menu appears normally (no mixed-grade-specific menu items)
- [ ] Sheet names reflect mixed grades (e.g., "G6 to G8 Groups")
- [ ] Student lookup works across grade ranges
- [ ] Progress tracking works for mixed-grade groups
- [ ] Reports include mixed-grade students correctly

**Errors:** Note any issues: ________________

**Result:** Mixed Grade Support works ✅ / ❌

---

### 2. Coaching Dashboard Module

**Enable:**
```javascript
features: {
  coachingDashboard: true,
  // ... all others false
}
```

**Tests:**
- [ ] Reload spreadsheet
- [ ] "Coach Tools" submenu appears in main menu
- [ ] Menu items present:
  - [ ] Weekly Coaching Dashboard
  - [ ] Refresh Dashboard
- [ ] Click "Weekly Coaching Dashboard" - creates/opens sheet
- [ ] Click "Refresh Dashboard" - updates data
- [ ] Dashboard shows weekly metrics by group
- [ ] Week-over-week changes calculated correctly
- [ ] No errors when data is sparse

**Errors:** Note any issues: ________________

**Result:** Coaching Dashboard works ✅ / ❌

---

### 3. Tutoring System Module

**Enable:**
```javascript
features: {
  tutoringSystem: true,
  // ... all others false
}
```

**Tests:**
- [ ] Reload spreadsheet
- [ ] "Tutoring" submenu appears in main menu
- [ ] Menu items present:
  - [ ] View Tutoring Summary
  - [ ] View Tutoring Log
  - [ ] Sync Tutoring Data
- [ ] Click "View Tutoring Summary" - creates/opens sheet
- [ ] Click "View Tutoring Log" - creates/opens sheet
- [ ] Log entries categorize correctly (UFLI Reteach, Comprehension, Other)
- [ ] Summary aggregates data correctly
- [ ] Pass rates calculate correctly
- [ ] Click "Sync Tutoring Data" - runs without errors

**Errors:** Note any issues: ________________

**Result:** Tutoring System works ✅ / ❌

---

### 4. Grant Reporting Module

**Enable:**
```javascript
features: {
  grantReporting: true,
  // ... all others false
}
```

**Configure:**
```javascript
GRANT_CONFIG = {
  reportSheet: "Mind Trust Summary",
  lookbackDays: 14
}
```

**Tests:**
- [ ] Reload spreadsheet
- [ ] "Grant Reports" submenu appears in main menu
- [ ] Menu items present:
  - [ ] Generate Mind Trust Summary
  - [ ] Schedule Mind Trust Report
  - [ ] Remove Scheduled Report
- [ ] Click "Generate Mind Trust Summary" - creates/opens sheet
- [ ] Report includes 5 metrics sections
- [ ] Attendance rates calculated correctly
- [ ] Baseline vs. Current data populated
- [ ] Growth percentages shown
- [ ] Skill gaps identified
- [ ] Instructional adjustments suggested
- [ ] Lookback window respected (14 days)

**Errors:** Note any issues: ________________

**Result:** Grant Reporting works ✅ / ❌

---

### 5. Growth Highlighter Module

**Enable:**
```javascript
features: {
  growthHighlighter: true,
  // ... all others false
}
```

**Tests:**
- [ ] Reload spreadsheet
- [ ] "Growth Highlighter" submenu appears in main menu
- [ ] Click "Open Utility" - sidebar opens
- [ ] Sidebar shows sheet info
- [ ] Target group count displays
- [ ] Click "Highlight Growth" - applies highlighting
- [ ] Students with growth are highlighted
- [ ] Color matches configuration
- [ ] Clear highlights works
- [ ] No errors with empty data

**Errors:** Note any issues: ________________

**Result:** Growth Highlighter works ✅ / ❌

---

### 6. Admin Import Module

**Enable:**
```javascript
features: {
  adminImport: true,
  // ... all others false
}
```

**Tests:**
- [ ] Reload spreadsheet
- [ ] "Admin Tools" submenu appears in main menu
- [ ] Menu items present:
  - [ ] Open Import Dialog
  - [ ] Validate Import Data
  - [ ] Process Import
  - [ ] Clear Import Staging
  - [ ] View Import Exceptions
  - [ ] Refresh Grade Summary Values
- [ ] Click "Open Import Dialog" - dialog opens
- [ ] Dialog shows import instructions
- [ ] Dialog has file upload/paste area
- [ ] "Import Staging" sheet created when data added
- [ ] Click "Validate Import Data" - validation runs
- [ ] Exceptions reported if data issues exist
- [ ] Click "Process Import" - data imported to UFLI MAP
- [ ] Historical archive created
- [ ] Click "Clear Import Staging" - staging cleared

**Errors:** Note any issues: ________________

**Result:** Admin Import works ✅ / ❌

---

### 7. Unenrollment Automation Module

**Enable:**
```javascript
features: {
  unenrollmentAutomation: true,
  // ... all others false
}
```

**Configure:**
```javascript
UNENROLLMENT_CONFIG = {
  createMondayTask: true,
  mondayBoardId: "YOUR_BOARD_ID"
}
```

**Prerequisites:**
- [ ] `MONDAY_API_KEY` added to Script Properties

**Tests:**
- [ ] Reload spreadsheet
- [ ] Menu includes unenrollment items (may be in Admin Tools or separate)
- [ ] "Student Archive" sheet exists or is created
- [ ] Mark a test student as "U" (unenrolled) in group sheet
- [ ] Student data archived to "Student Archive" sheet
- [ ] Student removed from active sheets
- [ ] Monday.com task created (if configured)
- [ ] Audit log entry created (if enabled)
- [ ] Click "View Archive" - opens archive sheet

**Errors:** Note any issues: ________________

**Result:** Unenrollment Automation works ✅ / ❌

---

## Multiple Features Testing

Test combinations of features that are commonly used together.

### Test Configuration 1: Adelante (Typical)
```javascript
features: {
  mixedGradeSupport: true,
  growthHighlighter: true,
  adminImport: true,
  unenrollmentAutomation: true
}
```

- [ ] All 4 feature menus appear
- [ ] No conflicts between features
- [ ] All feature functions work correctly
- [ ] No JavaScript errors
- [ ] Core functionality unchanged

**Result:** Adelante configuration works ✅ / ❌

---

### Test Configuration 2: GlobalPrep (Tutoring + Grants)
```javascript
features: {
  tutoringSystem: true,
  grantReporting: true
}
```

- [ ] Both feature menus appear
- [ ] Grant report includes tutoring data
- [ ] Tutoring log entries feed into grant metrics
- [ ] Attendance calculation includes tutoring sessions
- [ ] No conflicts between modules

**Result:** GlobalPrep configuration works ✅ / ❌

---

### Test Configuration 3: Sankofa (Mixed + Coaching)
```javascript
features: {
  mixedGradeSupport: true,
  coachingDashboard: true
}
```

- [ ] Both feature menus appear
- [ ] Coaching dashboard shows mixed-grade groups correctly
- [ ] Dashboard aggregates across grade ranges
- [ ] Mixed-grade sheet format respected

**Result:** Sankofa configuration works ✅ / ❌

---

## Toggle Testing

Test that features can be enabled and disabled without breaking the system.

### Enable/Disable Cycle
- [ ] Start with all features disabled
- [ ] Enable one feature - works ✅
- [ ] Disable that feature - removed cleanly ✅
- [ ] Enable multiple features - all work ✅
- [ ] Disable all features - core system works ✅

### Menu Persistence
- [ ] Changes to feature flags persist across reloads
- [ ] Menu updates reflect flag changes immediately
- [ ] No stale menu items after disabling features

**Result:** Toggle functionality works ✅ / ❌

---

## Error Handling Testing

### Invalid Configurations
- [ ] Invalid feature flag value (non-boolean) - handles gracefully
- [ ] Missing configuration object - uses defaults
- [ ] Empty configuration - no errors
- [ ] Invalid module configuration - reports error clearly

### Missing Dependencies
- [ ] Module enabled but file missing - error message clear
- [ ] Function called but module disabled - appropriate feedback
- [ ] Module requires Monday.com API key but missing - clear error

### Data Edge Cases
- [ ] Empty sheets - modules handle gracefully
- [ ] Missing students - no errors
- [ ] No historical data - appropriate messages
- [ ] Large datasets - performance acceptable

**Result:** Error handling is robust ✅ / ❌

---

## Performance Testing

### Menu Load Time
- [ ] Menu appears within 2 seconds with all features enabled
- [ ] No noticeable lag when features disabled

### Module Initialization
- [ ] Features initialize within 5 seconds on sheet open
- [ ] No timeout errors

### Large Dataset Performance
- [ ] Coaching dashboard refreshes in < 30 seconds
- [ ] Grant report generation completes in < 60 seconds
- [ ] Import validation completes in < 30 seconds

**Result:** Performance is acceptable ✅ / ❌

---

## Documentation Validation

### README Accuracy
- [ ] `modules/README.md` accurately describes all modules
- [ ] Configuration instructions are correct
- [ ] Examples work as described

### Migration Guide Accuracy
- [ ] `MIGRATION_GUIDE.md` steps are accurate
- [ ] School-specific notes are correct
- [ ] Troubleshooting section is helpful

### Code Comments
- [ ] Module headers clearly state feature flags
- [ ] Configuration objects are well-documented
- [ ] Helper functions have clear docstrings

**Result:** Documentation is accurate ✅ / ❌

---

## Final Validation

### Pre-Deployment Checklist
- [ ] All core system tests passed
- [ ] All feature module tests passed
- [ ] Toggle functionality works
- [ ] Error handling is robust
- [ ] Performance is acceptable
- [ ] Documentation is accurate
- [ ] No JavaScript errors in console
- [ ] No execution errors in Apps Script logs
- [ ] All sheets are accessible
- [ ] Data integrity maintained

### Sign-Off
- [ ] QA Tester: _________________ Date: _______
- [ ] Reviewed By: _________________ Date: _______
- [ ] Approved for Deployment: Yes / No

---

## Issues Log

Document any issues found during testing:

| Issue # | Feature | Description | Severity | Status |
|---------|---------|-------------|----------|--------|
| 1 | | | High/Med/Low | Open/Fixed |
| 2 | | | High/Med/Low | Open/Fixed |
| 3 | | | High/Med/Low | Open/Fixed |

---

## Deployment Recommendation

Based on QA results:

**[ ] APPROVE** - Ready for production deployment  
**[ ] CONDITIONAL** - Ready with noted caveats: _______________  
**[ ] REJECT** - Not ready, issues must be resolved

**Notes:** _______________________________________________

---

## Post-Deployment Monitoring

After deploying to production:

### Week 1 Checklist
- [ ] Monitor execution logs daily
- [ ] Check for user-reported issues
- [ ] Verify no performance degradation
- [ ] Confirm features work as expected

### Week 2-4 Checklist
- [ ] Review user feedback
- [ ] Document any edge cases
- [ ] Update documentation if needed
- [ ] Plan for wider rollout if successful

---

**QA Complete:** _______ (Date)

---

## Phase 7 Integration QA

### 7.1 UnifiedConfig Validation
- [ ] `getUnifiedConfig()` returns correct LAYOUT for each grade range model (`prek_only`, `k5`, `k8`, `prek_8`, `custom`)
- [ ] `getUnifiedConfig()` includes `GROUP_FORMAT` and `INCLUDE_SC_CLASSROOM` in the LAYOUT object
- [ ] `validateUnifiedConfig()` surfaces actionable error messages for missing required keys
- [ ] Fallback defaults applied when config sheet rows 32–33 are absent (legacy schools)
- [ ] `getDefaultGradesForModel()` returns correct grade arrays for all 5 presets

### 7.2 SetupWizard End-to-End Flow
- [ ] Step 1: School name + branding fields save correctly
- [ ] Step 2: Grade Range Model dropdown auto-selects correct grade checkboxes for each preset
- [ ] Step 2: Manually toggling a grade checkbox switches model to "custom"
- [ ] Step 6: `enhancedSecurity` checkbox is ON by default; all 4 Phase 7 system flags present (`enhancedSecurity`, `structuredLogging`, `scClassroomGroups`, `coTeachingSupport`)
- [ ] Step 8: `dataStartRow` and `lessonColumnOffset` number inputs present and persist correctly
- [ ] Confirmation screen (Step 9) reflects all new Phase 7 fields
- [ ] `saveConfiguration()` writes `gradeRangeModel` + layout fields to config sheet (rows 3, 32, 33)
- [ ] Re-opening wizard loads all saved values via `loadExistingData()` (no duplicate field load)

### 7.3 Feature Flag Matrix
For each school configuration, verify correct flags activate correct menus and modules:
- [ ] Adelante: `mixedGradeSupport=true`, `dynamicBranding=true`, `ufliMapQueue=true`, `adminImport=true`, `unenrollmentAutomation=true`
- [ ] Sankofa: `mixedGradeSupport=true`, `coachingDashboard=true`, `coTeachingSupport=true`
- [ ] GlobalPrep: `tutoringSystem=true`, `grantReporting=true`
- [ ] CCA: `skillAveragesAnalytics=true`, `formulaRepairTools=true`
- [ ] CHAW: `mixedGradeSupport=true`, `dynamicBranding=true`, `ufliMapQueue=true`
- [ ] Allegiant: `adminImport=true`, `diagnosticTools=true`, `structuredLogging=true`

### 7.4 Unified Module Integration
- [ ] `Phase2_ProgressTracking_Unified.gs` sheet generation works for each grade model
- [ ] `MixedGradeSupport_Unified.gs` respects `MIXED_GRADE_CONFIG.combinations`
- [ ] `AdminImport_Unified.gs` rejects formula injection attempts (test with `=CMD("calc")`)
- [ ] `AdminImport_Unified.gs` structured logging active only when `structuredLogging=true`
- [ ] `SYNC_CONFIG` and `BRANDING_CONFIG` objects accessible via `getFeatureConfig()`
- [ ] `PROGRESS_TRACKING_CONFIG` accessible via `getFeatureConfig('progressTracking')`

### 7.5 Regression Tests
- [ ] Legacy schools with existing config sheets (no rows 32–33) initialize without errors
- [ ] Core menu items (View School Summary, Generate Reports, Manage Students, Manage Groups) always present regardless of feature flags
- [ ] No duplicate function definition errors when unified modules load alongside legacy school files
- [ ] `onOpen()` calls `buildFeatureMenu()` exactly once (no duplicate feature submenus)

### 7.6 Dynamic Menu
- [ ] All features disabled → no optional submenus appear
- [ ] `tutoringSystem=true` → "Tutoring" submenu appears
- [ ] `adminImport=true` → "Admin Tools" submenu appears
- [ ] `coachingDashboard=true` → "Coach Tools" submenu appears
- [ ] `ufliMapQueue=true` → "Sync & Performance" submenu appears
- [ ] `formulaRepairTools=true` → "Repair Tools" submenu appears
