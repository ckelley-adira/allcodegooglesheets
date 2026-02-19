# Phase 7g QA Checklist
## Final Integration & End-to-End Testing

Use this checklist to validate the Phase 7 unified integration before general availability across all partner sites.  
Supersedes the Phase 4 QA checklist and covers all 7b–7f consolidated modules.

---

## Pre-Testing Setup

### Environment Preparation
- [ ] Create a test copy of the school's spreadsheet
- [ ] Note current functionality (what features are active)
- [ ] Document current menu structure (screenshot recommended)
- [ ] Verify all data is preserved in the copy

### Unified File Installation (Phase 7)
- [ ] Add `SiteConfig_TEMPLATE.gs` (or site-specific SiteConfig) to Apps Script project
- [ ] Add `SetupWizard.gs` v4.0 (unified canonical wizard)
- [ ] Add `UnifiedConfig.gs` (Phase 7 logic layer unification)
- [ ] Add `SharedConstants.gs` and `SharedEngine.gs` (shared utilities)
- [ ] Add `Phase2_ProgressTracking_Unified.gs` or `UnifiedPhase2_ProgressTracking.gs`
- [ ] Add `MixedGradeSupport_Unified.gs` (if applicable)
- [ ] Add `modules/ModuleLoader.gs` to Apps Script project
- [ ] Add relevant feature modules from `modules/` based on school's needs
- [ ] Verify deprecated school-specific SetupWizard files are NOT loaded alongside unified version
- [ ] Save all files in Apps Script editor

### Module Load Verification
- [ ] Confirm `SetupWizard.gs` `onOpen()` fires without errors on spreadsheet load
- [ ] Confirm `buildFeatureMenu()` is called exactly once (no duplicate menus)
- [ ] Confirm `initializeFeatureModules()` completes without errors
- [ ] Confirm `getUnifiedConfig()` returns valid configuration for the site
- [ ] Confirm `validateUnifiedConfig()` passes with no missing keys

---

## Core System Testing (All Features Disabled)

Test that the core system works when all optional features are disabled.

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
  unenrollmentAutomation: false,
  syncQueueProcessing: false,
  nightlySyncAutomation: false,
  syncStatusMonitoring: false
}
```

### Menu Validation
- [ ] Reload spreadsheet
- [ ] Verify main menu appears ("Adira Reads Progress Report")
- [ ] Verify NO feature-specific submenus appear (no Coach Tools, Tutoring, Grant Reports, etc.)
- [ ] Core menu items present:
  - [ ] 📊 View School Summary
  - [ ] 📈 Generate Reports
  - [ ] 👥 Manage Students
  - [ ] 👨‍🏫 Manage Groups
  - [ ] 🔄 Sync & Performance submenu (with only Recalculate — no queue/nightly/status items)
  - [ ] 🔧 System Tools submenu (Archive, Repairs)
  - [ ] ⚙️ System Settings
  - [ ] 🔄 Re-run Setup Wizard
- [ ] Verify System Tools submenu contains:
  - [ ] 📦 Manual Archive Student
  - [ ] 📄 View Archive
  - [ ] 🔧 Repair All Formulas
  - [ ] ⚠️ Fix Missing Teachers
  - [ ] 🎨 Repair Formatting

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

### Grade Range Model Validation

Test all five grade range models to verify correct runtime parameterization.

#### PreK Only (`gradeRangeModel: "prek_only"`)
```javascript
gradeRangeModel: "prek_only",
features: { preKOnlyMode: true }
```
- [ ] Only PreK-specific sheets generated
- [ ] PreK data sheet uses correct layout (PREK_CONFIG)
- [ ] No K–8 grade sheets created
- [ ] School Summary reflects PreK-only data
- [ ] Reports generate correctly for PreK curriculum

#### K–5 (`gradeRangeModel: "k5"`)
```javascript
gradeRangeModel: "k5",
grades: ["KG", "G1", "G2", "G3", "G4", "G5"]
```
- [ ] Grade sheets for KG through G5 created
- [ ] No PreK or G6–G8 sheets created
- [ ] UFLI MAP includes all K–5 grades
- [ ] School Summary includes all K–5 grades
- [ ] Reports generate correctly

#### K–8 (`gradeRangeModel: "k8"`)
```javascript
gradeRangeModel: "k8",
grades: ["KG", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"]
```
- [ ] Grade sheets for KG through G8 created
- [ ] UFLI MAP includes all K–8 grades
- [ ] School Summary includes all K–8 grades
- [ ] Reports generate correctly

#### PreK–8 (`gradeRangeModel: "prek_8"`)
```javascript
gradeRangeModel: "prek_8",
grades: ["PreK", "KG", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"]
```
- [ ] PreK data sheet AND K–8 grade sheets created
- [ ] PreK layout uses PREK_CONFIG, K–8 uses standard LAYOUT
- [ ] School Summary includes both PreK and K–8
- [ ] Reports include both tracks correctly

#### Custom (`gradeRangeModel: "custom"`)
```javascript
gradeRangeModel: "custom",
grades: ["G3", "G4", "G5"]
```
- [ ] Only selected grades have sheets created
- [ ] No unexpected grade sheets present
- [ ] School Summary limited to selected grades

**Result:** All grade range models work ✅ / ❌

---

### Test Configuration 1: Partner Site A (Mixed Grades + Growth + Import + Unenrollment)
```javascript
features: {
  mixedGradeSupport: true,
  growthHighlighter: true,
  adminImport: true,
  unenrollmentAutomation: true,
  syncQueueProcessing: true,
  nightlySyncAutomation: true
}
```

- [ ] All 4 feature menus appear
- [ ] Sync & Performance submenu includes queue and nightly sync items
- [ ] No conflicts between features
- [ ] All feature functions work correctly
- [ ] No JavaScript errors
- [ ] Core functionality unchanged

**Result:** Partner Site A configuration works ✅ / ❌

---

### Test Configuration 2: Partner Site B (Tutoring + Grants)
```javascript
features: {
  tutoringSystem: true,
  grantReporting: true,
  nightlySyncAutomation: true
}
```

- [ ] Both feature menus appear
- [ ] Tutoring navigation functions work (goToTutoringSummary, goToTutoringLog)
- [ ] Grant report includes tutoring data
- [ ] Tutoring log entries feed into grant metrics
- [ ] Attendance calculation includes tutoring sessions
- [ ] No conflicts between modules

**Result:** Partner Site B configuration works ✅ / ❌

---

### Test Configuration 3: Partner Site C (Mixed + Coaching)
```javascript
features: {
  mixedGradeSupport: true,
  coachingDashboard: true,
  syncStatusMonitoring: true
}
```

- [ ] Both feature menus appear
- [ ] Coaching dashboard shows mixed-grade groups correctly
- [ ] Dashboard aggregates across grade ranges
- [ ] Mixed-grade sheet format respected
- [ ] Sync Status check available via menu

**Result:** Partner Site C configuration works ✅ / ❌

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

## SetupWizard End-User Flow (Phase 7g)

Validate the complete first-run wizard experience through general availability configuration.

### First-Run (Unconfigured State)
- [ ] Open spreadsheet with no Configuration sheet
- [ ] Only "🚀 Start Setup Wizard" menu item appears
- [ ] Click "Start Setup Wizard" — modal dialog opens
- [ ] Wizard Step 1: School name entry works
- [ ] Wizard Step 2: Grade Range Model dropdown populates presets
  - [ ] Selecting "PreK Only" auto-checks PreK checkbox only
  - [ ] Selecting "K–5" auto-checks KG through G5
  - [ ] Selecting "K–8" auto-checks KG through G8
  - [ ] Selecting "PreK–8" auto-checks all grades
  - [ ] Manually toggling a checkbox switches dropdown to "Custom"
- [ ] Wizard Step 3: Feature flag selection works
  - [ ] All 14 FEATURE_OPTIONS items displayed
  - [ ] Checking/unchecking persists across wizard steps
- [ ] Wizard completion: Configuration sheet created
- [ ] Wizard completion: Feature Settings sheet created with selected flags
- [ ] Wizard completion: Menu rebuilds with full configured state

### Re-Run Wizard (Configured State)
- [ ] Click "🔄 Re-run Setup Wizard" from Settings menu
- [ ] Existing configuration pre-populated in wizard fields
- [ ] Existing feature selections loaded via getExistingFeatures()
- [ ] Changes saved correctly without data loss
- [ ] Menu reflects updated configuration after save

**Result:** SetupWizard flow works ✅ / ❌

---

## Sync Automation Testing (Phase 7g)

### Feature-Flag Gated Sync Menu
- [ ] With `syncQueueProcessing: false` — no queue items in Sync & Performance
- [ ] With `syncQueueProcessing: true` — queue items appear
  - [ ] ▶️ Process UFLI MAP Queue Now
  - [ ] ✅ Enable Hourly UFLI Sync
  - [ ] ❌ Disable Hourly UFLI Sync
- [ ] With `nightlySyncAutomation: false` — no nightly items
- [ ] With `nightlySyncAutomation: true` — nightly items appear
  - [ ] ✅ Enable Nightly Full Sync
  - [ ] ❌ Disable Nightly Full Sync
- [ ] With `syncStatusMonitoring: false` — no status item
- [ ] With `syncStatusMonitoring: true` — status item appears
  - [ ] ℹ️ Check Sync Status

### Sync Functions
- [ ] Recalculate All Stats Now — runs without errors
- [ ] Process UFLI MAP Queue — processes pending items (when enabled)
- [ ] Enable/Disable Hourly Sync — trigger created/removed
- [ ] Enable/Disable Nightly Sync — trigger created/removed
- [ ] Check Sync Status — dialog shows trigger status

**Result:** Sync automation works ✅ / ❌

---

## Regression Testing (Phase 7g)

Ensure legacy configuration paths continue to work with the new unified codebase.

### Legacy Config Compatibility
- [ ] Existing school spreadsheets open without errors
- [ ] Existing Configuration sheets recognized by `isSystemConfigured()`
- [ ] Existing Feature Settings sheets read correctly by `getExistingFeatures()`
- [ ] No data loss on first load with unified modules

### Backward-Compatible Function Signatures
- [ ] `getExistingLessonData()` works with 2-arg calling convention (groupName, lessonName)
- [ ] `getExistingLessonData()` works with 3-arg calling convention (gradeSheet, groupName, lessonName)
- [ ] `goToSchoolSummary()` navigates correctly in unified Phase2

### Cross-Module Dependencies
- [ ] All functions referenced in `onOpen()` menus are defined and callable
- [ ] All functions referenced in `buildFeatureMenu()` are defined in their respective modules
- [ ] `getFeatureMenuLabel()` returns correct labels for all feature keys
- [ ] `isFeatureEnabled()` correctly reads feature flags from SITE_CONFIG
- [ ] `getFeatureConfig()` returns module-specific config objects

### Data Integrity
- [ ] Student records preserved across module load
- [ ] Lesson data unchanged after system initialization
- [ ] Progress tracking formulas intact
- [ ] Grade Summary values accurate

**Result:** Regression tests pass ✅ / ❌

---

### Pre-Deployment Checklist
- [ ] All core system tests passed
- [ ] All feature module tests passed (7 modules)
- [ ] All grade range model tests passed (5 models)
- [ ] SetupWizard end-user flow validated
- [ ] Sync automation feature-flag gating verified
- [ ] Toggle functionality works
- [ ] Error handling is robust
- [ ] Performance is acceptable
- [ ] Regression tests pass (legacy compatibility)
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
| 1 | SetupWizard Menu | Duplicate `buildFeatureMenu()` call in `onOpen()` caused feature menus to appear twice | High | Fixed |
| 2 | SetupWizard Menu | System Tools submenu chain broken — items added to base menu instead of submenu | High | Fixed |
| 3 | TutoringSystem | `goToTutoringSummary()` and `goToTutoringLog()` referenced in menu but not defined | High | Fixed |
| 4 | Sync Menu | Queue/nightly/status menu items shown unconditionally regardless of feature flags | Medium | Fixed |

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
**Phase 7g Version:** February 2026
