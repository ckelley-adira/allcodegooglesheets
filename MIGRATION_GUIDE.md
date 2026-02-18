# Phase 4 Migration Guide
## Feature Modules Extraction - School Deployment Instructions

This guide walks through migrating an existing school deployment to the Phase 4 modular architecture.

---

## Overview

**What's Changing:**
- Optional features are now in the `modules/` directory
- Features are enabled/disabled via feature flags in `SITE_CONFIG`
- Menu items appear/disappear automatically based on flags
- No more hardcoded feature menus in setup wizards

**What's NOT Changing:**
- Core UFLI tracking functionality
- Student/group management
- Progress tracking calculations
- Report generation (core reports)
- Lesson entry forms

---

## Pre-Migration Checklist

Before starting migration:

- [ ] **Backup:** Create a complete copy of the school's spreadsheet
- [ ] **Document:** List all currently active features (tutoring, coaching, admin import, etc.)
- [ ] **Test Environment:** Have a test copy ready for validation
- [ ] **User Communication:** Schedule maintenance window if needed

---

## Migration Steps

### Step 1: Add New Files to Apps Script Project

1. Open the school's Google Sheets
2. Go to **Extensions > Apps Script**
3. Add these new files:

**Core Files (Required for All Schools):**
```
- SiteConfig_TEMPLATE.gs
- modules/ModuleLoader.gs
```

**Feature Modules (Add Only If Used):**
```
- modules/MixedGradeSupport.gs      (if school uses mixed grades)
- modules/CoachingDashboard.gs      (if school has coaching dashboard)
- modules/TutoringSystem.gs         (if school tracks tutoring)
- modules/GrantReporting.gs         (if school generates grant reports)
- modules/GrowthHighlighter.gs      (if school uses growth highlighting)
- modules/AdminImport.gs            (if school imports historical data)
- modules/UnenrollmentAutomation.gs (if school uses Monday.com)
```

**Documentation (Optional but Recommended):**
```
- modules/README.md
- modules/onOpen_Example.gs
```

### Step 2: Configure Feature Flags

Edit `SiteConfig_TEMPLATE.gs` and set feature flags based on school's current usage:

```javascript
const SITE_CONFIG = {
  schoolName: "Your School Name",
  features: {
    mixedGradeSupport: false,        // ← Set to true if school uses mixed grades
    coachingDashboard: false,        // ← Set to true if school has coaching dashboard
    tutoringSystem: false,           // ← Set to true if school tracks tutoring
    grantReporting: false,           // ← Set to true if school generates grant reports
    growthHighlighter: false,        // ← Set to true if school uses growth highlighting
    adminImport: false,              // ← Set to true if school imports data
    unenrollmentAutomation: false    // ← Set to true if school uses Monday.com
  }
};
```

**Example for Adelante (has admin import and growth highlighter):**
```javascript
features: {
  mixedGradeSupport: true,
  coachingDashboard: false,
  tutoringSystem: false,
  grantReporting: false,
  growthHighlighter: true,
  adminImport: true,
  unenrollmentAutomation: true
}
```

**Example for GlobalPrep (has tutoring and grant reporting):**
```javascript
features: {
  mixedGradeSupport: false,
  coachingDashboard: false,
  tutoringSystem: true,
  grantReporting: true,
  growthHighlighter: false,
  adminImport: false,
  unenrollmentAutomation: false
}
```

### Step 3: Update onOpen() Function

Replace the school's `onOpen()` function in their SetUpWizard file.

**Find this section (example from Adelante):**
```javascript
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  
  // ... menu setup ...
  
  // === TUTORING (Optional Module) ===
  .addSubMenu(ui.createMenu('📚 Tutoring')
    .addItem('📋 View Tutoring Summary', 'goToTutoringSummary')
    // ... etc
```

**Replace with:**
```javascript
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const configSheet = ss.getSheetByName(SHEET_NAMES.CONFIG);
  
  // 1. Unconfigured State (Setup Wizard Only)
  if (!configSheet || !isSystemConfigured()) {
    ui.createMenu('Adira Reads Progress Report')
      .addItem('🚀 Start Setup Wizard', 'startSetupWizard')
      .addToUi();
    return;
  }
  
  // 2. Load feature flags from config
  loadSiteConfig();
  
  // 3. Build base menu (always present)
  const baseMenu = ui.createMenu('Adira Reads Progress Report')
    // === PRIMARY ACTIONS (Daily Use) ===
    .addItem('📊 View School Summary', 'goToSchoolSummary')
    .addItem('📈 Generate Reports', 'generateReports')
    .addSeparator()
    // ... etc (keep all core menu items) ...
  
  // 4. Add feature-specific menus (only if enabled)
  buildFeatureMenu(ui, baseMenu);
  
  // 5. Add core maintenance tools (always present)
  baseMenu.addSeparator()
    // ... etc (keep all core tools) ...
    .addToUi();
}
```

**Copy these helper functions** (from `modules/onOpen_Example.gs`):
```javascript
function loadSiteConfig() {
  // ... see onOpen_Example.gs for full implementation
}
```

### Step 4: Remove Old Feature Code (Optional)

You can now remove the old feature-specific files from the school's project:

**If feature is now in modules/, can remove:**
- `AdelanteMixedGradeSupport_Enhanced.gs` → Use `modules/MixedGradeSupport.gs`
- `AdelanteGrowthHighlighter.gs` → Use `modules/GrowthHighlighter.gs`
- `AdelanteAdminImport.gs` → Use `modules/AdminImport.gs`
- `AdelanteUnenrollmentAutomation.gs` → Use `modules/UnenrollmentAutomation.gs`
- `SankofaWeeklyCoachingDashboard.gs` → Use `modules/CoachingDashboard.gs`
- `GlobalPrepTutoringSystem.gs` → Use `modules/TutoringSystem.gs`
- `GlobalPrepMindTrustReport.gs` → Use `modules/GrantReporting.gs`

**⚠️ IMPORTANT:** Only remove files after confirming the module version works correctly!

### Step 5: Test in Copy First

1. Create a copy of the school's spreadsheet
2. Apply all changes to the copy
3. Reload the spreadsheet
4. Verify:
   - [ ] Menu appears correctly
   - [ ] Only enabled features show menu items
   - [ ] Feature functions work as expected
   - [ ] No console errors
   - [ ] Core functionality unchanged

### Step 6: Deploy to Production

Once testing is complete:

1. Apply changes to production spreadsheet
2. Notify users of any menu changes
3. Monitor for errors in the first 24 hours
4. Document which features are enabled for the school

---

## School-Specific Migration Notes

### Adelante
**Currently Active Features:**
- Mixed Grade Support ✓
- Growth Highlighter ✓
- Admin Import ✓
- Unenrollment Automation ✓

**Migration Steps:**
1. Set all 4 feature flags to `true`
2. Add all 4 modules to project
3. Update onOpen() as described above
4. Test mixed-grade sheet generation
5. Test growth highlighting on Grade Summary
6. Test admin import dialog
7. Verify Monday.com API key is in Script Properties

### Sankofa
**Currently Active Features:**
- Mixed Grade Support ✓
- Coaching Dashboard ✓

**Migration Steps:**
1. Set 2 feature flags to `true`
2. Add both modules to project
3. Update onOpen() as described above
4. Test mixed-grade sheet generation (Sankofa format)
5. Test Weekly Coaching Dashboard refresh

### GlobalPrep
**Currently Active Features:**
- Tutoring System ✓
- Grant Reporting ✓

**Migration Steps:**
1. Set 2 feature flags to `true`
2. Add both modules to project
3. Update onOpen() as described above
4. Test tutoring log and summary sheets
5. Test Mind Trust report generation
6. Verify tutoring menu appears

### CHAW
**Currently Active Features:**
- Mixed Grade Support ✓

**Migration Steps:**
1. Set 1 feature flag to `true`
2. Add MixedGradeSupport module
3. Update onOpen() as described above
4. Test mixed-grade sheet generation

### CCA / Allegiant
**Currently Active Features:**
- None (core only)

**Migration Steps:**
1. Keep all feature flags `false`
2. Still add SiteConfig_TEMPLATE.gs and ModuleLoader.gs
3. Update onOpen() as described above
4. Verify menu is clean (no feature items)

---

## Rollback Plan

If issues arise after migration:

### Quick Rollback (Restore Old Menu)
1. Open Apps Script
2. Revert `onOpen()` function to previous version
3. Save and reload spreadsheet

### Full Rollback (Restore Old Files)
1. Re-add old feature files (e.g., `AdelanteAdminImport.gs`)
2. Remove new module files
3. Revert `onOpen()` function
4. Remove `SiteConfig_TEMPLATE.gs` and `ModuleLoader.gs`
5. Save and reload spreadsheet

---

## Troubleshooting

### Issue: Menu items missing after migration

**Solution:**
1. Check `SITE_CONFIG.features` flags are set to `true`
2. Verify `loadSiteConfig()` is called in `onOpen()`
3. Confirm module files are in project
4. Check browser console for errors
5. Try reloading spreadsheet

### Issue: Feature function not found error

**Solution:**
1. Verify module file is added to project
2. Check function name matches call in menu
3. Ensure no typos in function names
4. Check execution logs for details

### Issue: Feature flag changes not taking effect

**Solution:**
1. Save `SiteConfig_TEMPLATE.gs` after changes
2. Reload spreadsheet (not just refresh)
3. Clear browser cache if needed
4. Check that `loadSiteConfig()` is implemented correctly

### Issue: Monday.com integration not working (Unenrollment)

**Solution:**
1. Verify `MONDAY_API_KEY` in Script Properties
2. Check `UNENROLLMENT_CONFIG.mondayBoardId` is set
3. Test API key with simple Monday.com call
4. Review execution logs for API errors

---

## Post-Migration Validation

After migration is complete, verify:

- [ ] All enabled features work correctly
- [ ] Menu items appear as expected
- [ ] Core functionality unchanged
- [ ] No console errors
- [ ] Users can access their regular workflows
- [ ] Documentation updated for the school

---

## Support

For migration assistance:
1. Review this guide and `modules/README.md`
2. Check `modules/onOpen_Example.gs` for implementation details
3. Test in a copy before production deployment
4. Contact @ckelley-adira for help

---

## Version History

- **v4.0** (February 2026) - Initial Phase 4 migration guide
