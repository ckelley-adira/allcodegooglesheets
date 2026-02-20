# Gold Standard Template

This directory contains the **production-ready, multi-site UFLI tracking system**. Approximately 90% of the codebase lives here as shared Core logic; the remaining ~10% is school-specific configuration handled by `SiteConfig_TEMPLATE.gs`.

## File-by-file purpose

### Core engine

| File | Purpose |
|---|---|
| `Phase2_ProgressTracking.gs` | Main engine — all UFLI lesson scoring, progress tracking, group management, and report generation |
| `SharedConstants.gs` | Canonical constants shared across every module (column indices, sheet names, skill lists) |
| `SharedEngine.gs` | Low-level engine helpers used by Phase2 and modules (score calculation, layout helpers) |
| `UnifiedConfig.gs` | Runtime config loader — reads persisted settings from the Configuration sheet |
| `SetupWizard.gs` | Onboarding wizard, menu builder (`onOpen`), lesson entry, and feature-settings persistence |
| `AdminImport.gs` | Bulk student/roster import utilities (unified, replaces school-specific AdminImport files) |
| `MixedGradeSupport.gs` | Mixed-grade group logic (unified, replaces school-specific Enhanced variants) |
| `PreKMainCode.gs` | Pre-K subsystem backend (dashboard, parent reports, tutor forms) |
| `validate_shared_constants.js` | Node.js validation script — verifies SharedConstants integrity offline |

### Site configuration

| File | Purpose |
|---|---|
| `SiteConfig_TEMPLATE.gs` | **Copy and rename this file for each new school deployment.** Defines `SITE_CONFIG` with school identity, grade range, layout, and all feature flags |

### Feature modules (`modules/`)

Modules are optional, independently togglable features loaded by `ModuleLoader.gs` at runtime based on feature flags defined in `SiteConfig_TEMPLATE.gs`.

| Module | Feature flag | Purpose |
|---|---|---|
| `ModuleLoader.gs` | *(always loaded)* | Inspects feature flags and dynamically builds the menu / loads active modules |
| `CoachingDashboard.gs` | `coachingDashboard` | Weekly coaching summary view for instructional coaches |
| `TutoringSystem.gs` | `tutoringSystem` | Tutoring session logging and summary reporting |
| `GrantReporting.gs` | `grantReporting` | Grant-compliance attendance and outcome reports |
| `GrowthHighlighter.gs` | `growthHighlighter` | Sidebar that highlights student growth between assessment windows |
| `UnenrollmentAutomation.gs` | `unenrollmentAutomation` | Automated student archive / unenrollment workflows |
| `AdminImport.gs` | `adminImport` | Module-level admin import menu items |
| `MixedGradeSupport.gs` | `mixedGradeGroups` | Module-level mixed-grade support menu items |
| `onOpen_Example.gs` | *(reference)* | Example showing how to add custom `onOpen` hooks |

### UI templates (`ui/`)

Canonical (non-school-prefixed) HTML dialogs and sidebars used by the core engine:

| File | Purpose |
|---|---|
| `SetupWizardUI.html` | Multi-step setup wizard dialog |
| `LessonEntryForm.html` | Lesson data entry form |
| `ManageGroupsUI.html` | Group management dialog |
| `ManageStudentsUI.html` | Student management dialog |
| `GenerateReportsUI.html` | Report generation dialog |
| `GrowthHighlighterSidebar.html` | Growth highlighter sidebar |

### Pre-K subsystem (`prek/`)

| File | Purpose |
|---|---|
| `PreKDashboard.html` | Pre-K program dashboard |
| `PreKIndex.html` | Pre-K navigation index |
| `PreKParentReport.html` | Pre-K parent-facing report |
| `PreKPortal.html` | Pre-K staff portal |
| `PreKSetupWizard.html` | Pre-K setup wizard dialog |
| `PreKTutorForm.html` | Pre-K tutor session form |

---

## Provisioning a new school

1. **Copy** `SiteConfig_TEMPLATE.gs` into your new Apps Script project and rename it (e.g., `SiteConfig_MySchool.gs`).
2. Edit the `SITE_CONFIG` object at the top of the file:
   - Set `siteName`, `siteCode`, `primaryColor`, `logoUrl`
   - Choose a `gradeRangeModel` (`"k5"`, `"k8"`, `"prek_8"`, `"prek_only"`, or `"custom"`)
   - Adjust the `layout` block (`dataStartRow`, `lessonColumnOffset`, etc.) if your sheet differs from the default
3. **Copy all remaining files** from this directory into your Apps Script project unchanged.
4. Run **Setup Wizard → Run Setup Wizard** from the Google Sheets menu to initialise the Configuration and Feature Settings sheets.

---

## Enabling / disabling feature modules

Feature flags live in the `features` block of `SITE_CONFIG` in `SiteConfig_TEMPLATE.gs`. Set any flag to `true` or `false`:

```javascript
features: {
  coachingDashboard:       true,   // adds "Coaching Dashboard" menu
  tutoringSystem:          false,  // hides tutoring menu items
  grantReporting:          false,
  growthHighlighter:       true,
  unenrollmentAutomation:  true,
  adminImport:             true,
  mixedGradeGroups:        false,
  // ... (see SiteConfig_TEMPLATE.gs for the full list)
}
```

`ModuleLoader.gs` reads these flags at `onOpen` and constructs the menu accordingly. No other files need to change.

---

## Architecture overview

```
SiteConfig_TEMPLATE.gs   ← school identity + feature flags (the only file you edit per-site)
        │
        ▼
SetupWizard.gs (onOpen)
        │
        ├──► SharedConstants.gs + SharedEngine.gs   ← pure utility, no side effects
        │
        ├──► UnifiedConfig.gs                       ← reads persisted config from sheet
        │
        ├──► Phase2_ProgressTracking.gs             ← core UFLI engine
        │
        ├──► AdminImport.gs / MixedGradeSupport.gs  ← always-on helpers
        │
        └──► ModuleLoader.gs
                  │
                  ├──► CoachingDashboard.gs   (if flag on)
                  ├──► TutoringSystem.gs      (if flag on)
                  ├──► GrantReporting.gs      (if flag on)
                  ├──► GrowthHighlighter.gs   (if flag on)
                  └──► UnenrollmentAutomation.gs (if flag on)
```

For phase-by-phase implementation history, see [`docs/`](../docs/).
