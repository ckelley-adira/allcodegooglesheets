# Gold Standard Template — Script Reference

This index covers every script and HTML template in the `gold-standard-template/` directory. Each entry links to its individual documentation page.

---

## 📂 Categories

- [Core Engine Scripts](#core-engine-scripts)
- [Site Configuration](#site-configuration)
- [Validation Tooling](#validation-tooling)
- [Feature Modules](#feature-modules)
- [UI Templates](#ui-templates)
- [Pre-K Subsystem Templates](#pre-k-subsystem-templates)

---

## Core Engine Scripts

These files live directly in `gold-standard-template/` and form the engine that every school site deploys.

| File | Size | Summary | Docs |
|------|------|---------|------|
| `SharedConstants.gs` | ~10 KB | Canonical constants shared across all modules: `LESSON_LABELS`, `SKILL_SECTIONS`, `REVIEW_LESSONS`, `GRADE_METRICS`, `PERFORMANCE_THRESHOLDS`, `STATUS_LABELS`. | [→ docs](scripts/SharedConstants.md) |
| `SharedEngine.gs` | ~26 KB | Low-level engine helpers: score calculation, benchmark logic, section-percentage calculation, performance-status lookup, and layout utilities. | [→ docs](scripts/SharedEngine.md) |
| `SharedEngine_Core.gs` | ~28 KB | Pure-logic split of `SharedEngine.gs`. Contains `computeStudentStats()` and all calculation helpers that reference no GAS APIs. Safe for unit testing with Node/Jest. | [→ docs](scripts/SharedEngine_Core.md) |
| `SharedEngine_IO.gs` | ~8 KB | I/O split of `SharedEngine.gs`. Contains `updateAllStats()`, `getOrCreateSheet()`, and logging helpers that do use GAS APIs. | [→ docs](scripts/SharedEngine_IO.md) |
| `UnifiedConfig.gs` | ~10 KB | Runtime config loader. Reads `SITE_CONFIG` and exposes `getUnifiedConfig()`, `getGradeRangeModels()`, and feature-flag helpers. | [→ docs](scripts/UnifiedConfig.md) |
| `Phase2_ProgressTracking.gs` | ~108 KB | Main UFLI engine. Generates and updates progress-tracking sheets, calculates benchmarks, produces the School Summary dashboard, pacing reports, and growth metrics. | [→ docs](scripts/Phase2_ProgressTracking.md) |
| `SetupWizard.gs` | ~113 KB | Onboarding wizard, dynamic menu builder, lesson-entry handler, and student/group CRUD. Central control point for all user-facing operations. | [→ docs](scripts/SetupWizard.md) |
| `AdminImport.gs` | ~39 KB | Bulk student and roster import from CSV or a source spreadsheet. Validates headers, resolves duplicates, and writes cleaned data to the Roster sheet. | [→ docs](scripts/AdminImport.md) |
| `MixedGradeSupport.gs` | ~56 KB | Mixed-grade group logic: creates combined lesson ranges, manages cross-grade grouping rules, and exposes `naturalSort`. | [→ docs](scripts/MixedGradeSupport.md) |
| `PreKMainCode.gs` | ~96 KB | Pre-K subsystem backend. Separate from K-5 UFLI — tracks early-literacy skills for pre-kindergarten students and serves all Pre-K HTML dialogs. | [→ docs](scripts/PreKMainCode.md) |

---

## Site Configuration

| File | Size | Summary | Docs |
|------|------|---------|------|
| `SiteConfig_TEMPLATE.gs` | ~29 KB | Master configuration template. Copy and rename per school. Defines the `SITE_CONFIG` object with school identity, feature flags, layout overrides, and grade-range model selection. | [→ docs](scripts/SiteConfig_TEMPLATE.md) |

---

## Validation Tooling

| File | Size | Summary | Docs |
|------|------|---------|------|
| `validate_shared_constants.js` | ~9 KB | Node.js offline validator. Checks `SharedConstants.gs`, `UnifiedConfig.gs`, `Phase2_ProgressTracking.gs`, and the Core/IO split files for required symbols. Run with `node gold-standard-template/validate_shared_constants.js`. | [→ docs](scripts/validate_shared_constants.md) |

---

## Feature Modules

These files live in `gold-standard-template/modules/`. Each module is gated by a feature flag in `SITE_CONFIG.features`. The `ModuleLoader.gs` file wires enabled modules into the spreadsheet menu at runtime.

| File | Size | Feature Flag | Summary | Docs |
|------|------|--------------|---------|------|
| `modules/ModuleLoader.gs` | ~9 KB | _(loader)_ | Reads `SITE_CONFIG.features` at `onOpen` time and dynamically adds enabled-module menu items. | [→ docs](scripts/modules/ModuleLoader.md) |
| `modules/CoachingDashboard.gs` | ~16 KB | `coachingDashboard` | Generates a per-coach view of student caseloads, progress summaries, and action items. | [→ docs](scripts/modules/CoachingDashboard.md) |
| `modules/TutoringSystem.gs` | ~32 KB | `tutoringSystem` | Tracks one-on-one tutoring sessions, session logs, attendance, and tutor assignments. | [→ docs](scripts/modules/TutoringSystem.md) |
| `modules/GrantReporting.gs` | ~47 KB | `grantReporting` | Generates grant-compliance reports: enrollment counts, attendance rates, lesson-completion metrics, and demographic breakdowns. | [→ docs](scripts/modules/GrantReporting.md) |
| `modules/GrowthHighlighter.gs` | ~8 KB | `growthHighlighter` | Sidebar that scans all students for significant lesson-count growth since the last snapshot and highlights them. | [→ docs](scripts/modules/GrowthHighlighter.md) |
| `modules/UnenrollmentAutomation.gs` | ~39 KB | `unenrollmentAutomation` | Automates student unenrollment: archives records, removes from active groups, and logs the exit event. | [→ docs](scripts/modules/UnenrollmentAutomation.md) |
| `modules/AdminImport.gs` | ~36 KB | `adminImport` | Module-level version of the bulk import utility, providing a menu-driven import dialog with field-mapping UI. | [→ docs](scripts/modules/AdminImport.md) |
| `modules/MixedGradeSupport.gs` | ~80 KB | `mixedGradeSupport` | Module-level mixed-grade logic: cross-grade group creation wizard, combined lesson-range resolution, and `naturalSort`. | [→ docs](scripts/modules/MixedGradeSupport.md) |
| `modules/onOpen_Example.gs` | ~13 KB | _(reference)_ | Reference implementation showing how to wire `onOpen` hooks and register feature-module menu items in a school-specific config file. | [→ docs](scripts/modules/onOpen_Example.md) |

---

## UI Templates

These HTML files live in `gold-standard-template/ui/` and are served as Google Sheets dialogs or sidebars via `HtmlService`.

| File | Size | Summary | Docs |
|------|------|---------|------|
| `ui/SetupWizardUI.html` | ~67 KB | Multi-step setup wizard dialog (9 steps): school identity, programs, grade levels, groups, students, staff, schedule, Pre-K options, and final review. | [→ docs](scripts/ui/SetupWizardUI.md) |
| `ui/LessonEntryForm.html` | ~36 KB | Four-step lesson data-entry form: select group → select student → enter lesson scores → confirm save. | [→ docs](scripts/ui/LessonEntryForm.md) |
| `ui/ManageGroupsUI.html` | ~11 KB | Dialog for editing group counts and names. Reads existing groups and writes updates back via the server. | [→ docs](scripts/ui/ManageGroupsUI.md) |
| `ui/ManageStudentsUI.html` | ~17 KB | Full student-management CRUD dialog: add, edit, and remove students from the Roster with inline modal forms. | [→ docs](scripts/ui/ManageStudentsUI.md) |
| `ui/GenerateReportsUI.html` | ~14 KB | Report-generation configuration dialog: select report type, date range, grade level, and output format before triggering server-side report generation. | [→ docs](scripts/ui/GenerateReportsUI.md) |
| `ui/GrowthHighlighterSidebar.html` | ~14 KB | Sidebar UI for the growth-highlighter scan: shows students with notable lesson growth and allows the coach to copy or export results. | [→ docs](scripts/ui/GrowthHighlighterSidebar.md) |

---

## Pre-K Subsystem Templates

These HTML files live in `gold-standard-template/prek/` and are served by `PreKMainCode.gs`.

| File | Size | Summary | Docs |
|------|------|---------|------|
| `prek/PreKDashboard.html` | ~22 KB | Program dashboard showing enrollment counts, session totals, and skill-progress summaries for the Pre-K site. | [→ docs](scripts/prek/PreKDashboard.md) |
| `prek/PreKIndex.html` | ~30 KB | Navigation index / home screen for the Pre-K module. Provides links to all Pre-K tools and displays at-a-glance site stats. | [→ docs](scripts/prek/PreKIndex.md) |
| `prek/PreKParentReport.html` | ~15 KB | Parent-facing progress report for a single Pre-K student. Displays skill scores and growth narrative in plain language. | [→ docs](scripts/prek/PreKParentReport.md) |
| `prek/PreKPortal.html` | ~10 KB | Staff portal landing page for day-to-day Pre-K data entry: quick links to session logging and attendance. | [→ docs](scripts/prek/PreKPortal.md) |
| `prek/PreKSetupWizard.html` | ~48 KB | Seven-step site-onboarding wizard for the Pre-K program: site info, programs, groups, students, staff, schedule, and review. | [→ docs](scripts/prek/PreKSetupWizard.md) |
| `prek/PreKTutorForm.html` | ~37 KB | Mobile-friendly tutor session tracker: select tutor → student → lesson → assess skills, with offline-tolerant save flow. | [→ docs](scripts/prek/PreKTutorForm.md) |

---

## Architecture Quick Reference

```
gold-standard-template/
├── SharedConstants.gs       ← single source of truth for all UFLI constants
├── SharedEngine.gs          ← original monolithic engine (kept for backward compat)
├── SharedEngine_Core.gs     ← pure-logic split (unit-testable)
├── SharedEngine_IO.gs       ← GAS I/O split
├── UnifiedConfig.gs         ← runtime config loader
├── SiteConfig_TEMPLATE.gs   ← per-school config (copy & rename)
├── Phase2_ProgressTracking.gs ← main UFLI sheet engine
├── SetupWizard.gs           ← menu, wizard, lesson entry, student/group CRUD
├── AdminImport.gs           ← bulk import (root version)
├── MixedGradeSupport.gs     ← mixed-grade logic (root version)
├── PreKMainCode.gs          ← Pre-K backend
├── validate_shared_constants.js ← Node.js offline validator
├── modules/                 ← optional feature modules (feature-flag gated)
│   ├── ModuleLoader.gs
│   ├── CoachingDashboard.gs
│   ├── TutoringSystem.gs
│   ├── GrantReporting.gs
│   ├── GrowthHighlighter.gs
│   ├── UnenrollmentAutomation.gs
│   ├── AdminImport.gs
│   ├── MixedGradeSupport.gs
│   └── onOpen_Example.gs
├── ui/                      ← HTML dialogs/sidebars
│   ├── SetupWizardUI.html
│   ├── LessonEntryForm.html
│   ├── ManageGroupsUI.html
│   ├── ManageStudentsUI.html
│   ├── GenerateReportsUI.html
│   └── GrowthHighlighterSidebar.html
└── prek/                    ← Pre-K HTML dialogs
    ├── PreKDashboard.html
    ├── PreKIndex.html
    ├── PreKParentReport.html
    ├── PreKPortal.html
    ├── PreKSetupWizard.html
    └── PreKTutorForm.html
```

See also: [`docs/ARCHITECTURE.md`](ARCHITECTURE.md) for system-level architecture, [`docs/BUSINESS_RULES.md`](BUSINESS_RULES.md) for UFLI domain rules, and [`gold-standard-template/README.md`](../gold-standard-template/README.md) for deployment guidance.
