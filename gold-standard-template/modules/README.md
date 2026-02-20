# Feature Modules Directory

This directory contains optional feature modules for the UFLI Master System. Each module can be enabled or disabled via feature flags in `SiteConfig_TEMPLATE.gs`.

## Module Overview

### 1. MixedGradeSupport.gs
**Feature Flag:** `SITE_CONFIG.features.mixedGradeSupport`

**Purpose:** Enables grouping students across multiple grade levels by skill rather than by single grade.

**When to Enable:**
- Schools with cross-grade skill-based grouping (e.g., G6+G7+G8, G1+G2+G3+G4)
- Schools using multi-age classrooms

**Configuration Required:**
- Set `MIXED_GRADE_CONFIG.combinations` in SiteConfig_TEMPLATE.gs
- Example: `"G6+G7+G8, G1+G2+G3+G4"`

**Impact:**
- Changes sheet names from "G6 Groups" to "G6 to G8 Groups"
- Modifies student lookup logic to search across grade ranges
- Affects progress tracking and reporting

---

### 2. CoachingDashboard.gs
**Feature Flag:** `SITE_CONFIG.features.coachingDashboard`

**Purpose:** Weekly coaching metrics and week-over-week performance tracking.

**When to Enable:**
- Schools with coaching staff needing performance visibility
- Sites requiring weekly progress monitoring
- Teams using data-driven coaching conversations

**Adds:**
- "Weekly Coaching Dashboard" sheet
- "Coach Tools" menu with dashboard and refresh options
- Week-over-week pass rate tracking by group

**No Additional Configuration Required**

---

### 3. TutoringSystem.gs
**Feature Flag:** `SITE_CONFIG.features.tutoringSystem`

**Purpose:** Dual-track progress: Whole Group UFLI + Tutoring Interventions.

**When to Enable:**
- Schools running separate tutoring/intervention programs
- Sites tracking reteach, comprehension, and intervention sessions separately
- Programs needing to distinguish whole-group vs. small-group instruction

**Adds:**
- "Tutoring Progress Log" sheet
- "Tutoring Summary" sheet
- "Tutoring" menu with log, summary, and sync options

**Configuration Required:**
- Review `TUTORING_CONFIG` in SiteConfig_TEMPLATE.gs
- Customize lesson categories if needed

---

### 4. GrantReporting.gs
**Feature Flag:** `SITE_CONFIG.features.grantReporting`

**Purpose:** Automated grant report generation (e.g., Mind Trust Summary).

**When to Enable:**
- Schools reporting to grant funders
- Sites requiring periodic compliance reports
- Programs with attendance, growth, and gap reporting requirements

**Adds:**
- "Mind Trust Summary" sheet (or configured report name)
- "Grant Reports" menu with generation and scheduling options
- Automated 14-day lookback reporting

**Configuration Required:**
- Set `GRANT_CONFIG.reportSheet` name
- Configure `GRANT_CONFIG.lookbackDays` for reporting window
- Set `GRANT_CONFIG.autoSchedule = true` for automated reports

---

### 5. GrowthHighlighter.gs
**Feature Flag:** `SITE_CONFIG.features.growthHighlighter`

**Purpose:** Visual highlighting of students with growth in specific skill areas.

**When to Enable:**
- Quick visual identification of student progress needed
- Teams using color-coding for at-a-glance insights
- Sites tracking unenrolled or finished students with continued growth

**Adds:**
- "Growth Highlighter" sidebar utility
- Visual highlighting on Grade Summary sheet

**Configuration Required:**
- Customize `GROWTH_CONFIG.highlightColor` if desired
- Set `GROWTH_CONFIG.targetGroup` for specific group highlighting

---

### 6. AdminImport.gs
**Feature Flag:** `SITE_CONFIG.features.adminImport`

**Purpose:** Historical data import with validation and exception reporting.

**When to Enable:**
- Migrating from legacy systems
- Bulk data imports needed
- Historical data backfill required
- Data validation and exception tracking needed

**Adds:**
- "Admin Tools" menu
- Import dialog with validation
- "Import Staging" sheet
- "Import Exceptions" sheet for data quality issues

**Configuration Required:**
- Review `IMPORT_CONFIG` sheet names
- Prepare import data in required format

---

### 7. UnenrollmentAutomation.gs
**Feature Flag:** `SITE_CONFIG.features.unenrollmentAutomation`

**Purpose:** Automatic archival and Monday.com integration for unenrolled students.

**When to Enable:**
- Schools using Monday.com for workflow tracking
- Sites requiring automatic student data archival
- Programs needing unenrollment audit trails

**Adds:**
- "Student Archive" sheet
- Monday.com task creation on unenrollment
- Automatic data removal from active sheets

**Configuration Required:**
- **CRITICAL:** Set `UNENROLLMENT_CONFIG.mondayBoardId` in SiteConfig_TEMPLATE.gs
- Add `MONDAY_API_KEY` to Script Properties (Extensions > Apps Script > Project Settings > Script Properties)
- Configure which sheets to archive from (`archiveSheet` names)

---

## Implementation Guide

### Step 1: Enable Features

Edit `SiteConfig_TEMPLATE.gs` and set feature flags to `true`:

```javascript
const SITE_CONFIG = {
  features: {
    mixedGradeSupport: false,      // Set to true to enable
    coachingDashboard: false,      // Set to true to enable
    tutoringSystem: false,         // Set to true to enable
    grantReporting: false,         // Set to true to enable
    growthHighlighter: false,      // Set to true to enable
    adminImport: false,            // Set to true to enable
    unenrollmentAutomation: false  // Set to true to enable
  }
};
```

### Step 2: Configure Module Settings

For modules requiring configuration, update the corresponding config objects in `SiteConfig_TEMPLATE.gs`:

```javascript
// Example: Mixed Grade Support
const MIXED_GRADE_CONFIG = {
  enabled: true,
  combinations: "G6+G7+G8, G1+G2+G3+G4"
};

// Example: Grant Reporting
const GRANT_CONFIG = {
  reportSheet: "Mind Trust Summary",
  lookbackDays: 14,
  autoSchedule: true
};
```

### Step 3: Update onOpen()

Replace your school's onOpen() function with the feature flag-driven version:

See `modules/onOpen_Example.gs` for a complete implementation example.

Key changes:
1. Call `loadSiteConfig()` to load feature flags
2. Use `buildFeatureMenu()` to add conditional menu items
3. Remove hardcoded feature menus

### Step 4: Test

1. **With All Features Disabled:** Verify core system works (no feature menus appear)
2. **Enable One Feature at a Time:** Verify each module loads correctly
3. **Test Module Functions:** Ensure each enabled module's functions work as expected
4. **Toggle Features Off:** Verify no errors when features are disabled

---

## Module Dependencies

### All Modules Depend On:
- `SiteConfig_TEMPLATE.gs` - Feature flag configuration
- `ModuleLoader.gs` - Dynamic menu building

### Some Modules Depend On:
- **MixedGradeSupport:** Phase2_ProgressTracking.gs (for progress calculations)
- **CoachingDashboard:** Phase2_ProgressTracking.gs (for shared constants)
- **TutoringSystem:** Phase2_ProgressTracking.gs (for progress tracking)
- **GrantReporting:** Phase2_ProgressTracking.gs, TutoringSystem.gs (if tutoring enabled)
- **AdminImport:** Phase2_ProgressTracking.gs (for updateAllStats)

---

## QA Checklist

Before deploying to production:

- [ ] Core system works with all features disabled
- [ ] Each feature can be enabled independently
- [ ] Menu items appear/disappear based on feature flags
- [ ] Feature dialogs/sheets are created on first use
- [ ] No console errors when features are toggled
- [ ] Feature configurations persist across sessions
- [ ] Documentation is updated for enabled features
- [ ] Users are notified of new features available

---

## Troubleshooting

### Feature Menu Not Appearing
1. Check `SITE_CONFIG.features.featureName = true` in SiteConfig_TEMPLATE.gs
2. Verify `loadSiteConfig()` is called in onOpen()
3. Check browser console for JavaScript errors
4. Reload the spreadsheet

### Module Functions Not Working
1. Verify the module file is included in your Apps Script project
2. Check that dependencies (Phase2_ProgressTracking.gs, etc.) are present
3. Review execution logs (Extensions > Apps Script > Executions)
4. Ensure required configuration is complete

### Monday.com Integration Not Working
1. Verify `MONDAY_API_KEY` is set in Script Properties
2. Check `UNENROLLMENT_CONFIG.mondayBoardId` is configured
3. Test API key with a simple Monday.com API call
4. Review execution logs for API errors

---

## Migration Notes

### Backporting to Existing Schools

When enabling features in existing school deployments:

1. **Test in a Copy First:** Create a copy of the school's spreadsheet and test feature enablement
2. **Enable One at a Time:** Don't enable all features at once - test each individually
3. **Document Enabled Features:** Update school-specific documentation
4. **Train Users:** If new menus appear, brief users on their purpose
5. **Monitor Initial Usage:** Watch for errors or unexpected behavior in the first week

### Feature Drift Prevention

To prevent features from drifting between schools:

1. **Use modules/ versions as source of truth:** Don't modify school-specific copies
2. **Update modules/ first:** Make changes in modules/, then sync to schools
3. **Track versions:** Note module version in school deployment logs
4. **Regular syncs:** Sync module updates quarterly or when bugs are fixed

---

## Version History

- **v4.0** (February 2026) - Initial modular architecture
  - Extracted 7 feature modules from school-specific files
  - Created SiteConfig_TEMPLATE.gs for feature flags
  - Built ModuleLoader.gs for dynamic menu building

---

## Support

For questions or issues with feature modules:

1. Review this README and module-specific documentation
2. Check execution logs (Extensions > Apps Script > Executions)
3. Test in a copy of the spreadsheet before production changes
4. Contact @ckelley-adira for module-specific support
