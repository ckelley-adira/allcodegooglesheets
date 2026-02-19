# Business Rules Document (BRD / FRD)
## UFLI School Progress Tracking System — Living Document

**Document Type:** Functional Requirements Document (FRD) / Business Rules Catalog  
**Repository:** ckelley-adira/allcodegooglesheets  
**Maintained By:** ckelley-adira + GitHub Copilot Agent  
**Last Updated:** 2026-02-19 01:33:33  
**Status:** 🟢 Active — Living Document  

> **How to use this document:** This is the authoritative reference for all business rules, calculation logic, feature behavior, and configuration contracts governing the UFLI School Progress Tracking system. Update this file whenever a rule changes, a new feature is added, or a phase introduces new behavior. Every section includes the source file(s) where the rule is implemented.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Schools & Deployments](#2-schools--deployments)
3. [UFLI Lesson Catalog Rules](#3-ufli-lesson-catalog-rules)
4. [Skill Section Rules](#4-skill-section-rules)
5. [Review Lesson (Gateway) Rules](#5-review-lesson-gateway-rules)
6. [Performance Threshold & Status Rules](#6-performance-threshold--status-rules)
7. [Grade Metrics Rules](#7-grade-metrics-rules)
8. [Progress Tracking Rules](#8-progress-tracking-rules)
9. [Group & Roster Management Rules](#9-group--roster-management-rules)
10. [Mixed Grade Support Rules](#10-mixed-grade-support-rules)
11. [SetupWizard & Configuration Rules](#11-setupwizard--configuration-rules)
12. [Feature Flag Rules](#12-feature-flag-rules)
13. [AdminImport Rules](#13-adminimport-rules)
14. [Tutoring System Rules](#14-tutoring-system-rules)
15. [Coaching Dashboard Rules](#15-coaching-dashboard-rules)
16. [Grant Reporting Rules](#16-grant-reporting-rules)
17. [Branding & UI Rules](#17-branding--ui-rules)
18. [Security & Data Integrity Rules](#18-security--data-integrity-rules)
19. [Sync & Automation Rules](#19-sync--automation-rules)
20. [Sheet Layout & Structure Rules](#20-sheet-layout--structure-rules)
21. [Phase History & Rule Evolution](#21-phase-history--rule-evolution)
22. [Open Questions & Deferred Decisions](#22-open-questions--deferred-decisions)

---

## 1. System Overview

### 1.1 Purpose
The UFLI School Progress Tracking system is a Google Apps Script–based platform deployed inside Google Sheets. It tracks student reading progress using the UFLI (University of Florida Literacy Institute) curriculum across multiple schools. Each school deployment shares a common codebase but may enable school-specific features via configuration flags.

### 1.2 Core Entities
| Entity | Description |
|--------|-------------|
| **School** | A single deployment instance (one Google Sheet per school) |
| **Student** | An enrolled learner tracked within a school |
| **Group** | A set of students assigned to a teacher for small-group instruction |
| **Grade** | A grade level from PreK through Grade 8 |
| **Lesson** | A numbered UFLI instructional unit (L1–L128) |
| **Skill Section** | A thematic grouping of lessons (16 sections total) |
| **Status** | A lesson completion state: `N/A`, `P` (Pass), `M` (Master), `IP` (In Progress) |

### 1.3 Authoritative Source Files
| Rule Domain | Primary File(s) |
|-------------|----------------|
| Constants | `SharedConstants.gs` |
| Core calculations | `SharedEngine.gs` |
| Configuration | `SiteConfig_TEMPLATE.gs` |
| SetupWizard logic | `SetupWizard.gs` |
| Mixed grade support | `MixedGradeSupport_Unified.gs` |
| Admin import | `AdminImport_Unified.gs` |
| Feature activation | `modules/ModuleLoader.gs` |

---

## 2. Schools & Deployments

### 2.1 Active Schools
| School | Key | Grade Range | Special Features |
|--------|-----|-------------|-----------------|
| Adelante | `adelante` | PreK–G8 | SC Classroom (G1–G5), Dynamic Branding, Mixed Grades (G6–G8) |
| Allegiant | `allegiant` | PreK–G8 | Structured Logging |
| CCA (Christel House Academy) | `cca` | PreK–G8 | Skill Averages Analytics, Formula-Centric approach |
| CHAW (Christel House Academy West) | `chaw` | PreK–G8 | Mixed Grades (KG–G1, G2–G3, G4–G6), Dynamic Branding |
| GlobalPrep | `globalprep` | PreK–G8 | Tutoring System, Grant Reporting |
| Sankofa | `sankofa` | PreK–G8 | Co-Teaching, SC Classroom (G1–G4), Coaching Dashboard, Mixed Grades (KG–G1, G2–G3, G6–G8) |

### 2.2 Deployment Contract
- **BR-DEPLOY-01:** Every school deployment MUST include `SharedConstants.gs`, `SharedEngine.gs`, `SiteConfig_TEMPLATE.gs`, `SetupWizard.gs`, and `SetupWizardUI.html`.
- **BR-DEPLOY-02:** School-specific `*Phase2_ProgressTracking.gs` files are retained for school-specific branding/dashboard functions only. Core calculation logic MUST be delegated to `SharedEngine.gs`.
- **BR-DEPLOY-03:** All optional features MUST be activated via feature flags in `SITE_CONFIG.features`. No optional feature code may be unconditionally executed.

---

## 3. UFLI Lesson Catalog Rules

### 3.1 Lesson Number Range
- **BR-LESSON-01:** The UFLI lesson catalog spans lessons **L1 through L128** (128 total lessons).
- **BR-LESSON-02:** Lesson labels are defined in `LESSON_LABELS` in `SharedConstants.gs` and are the single source of truth for all lesson display names.
- **BR-LESSON-03:** Lesson numbers are 1-indexed (first lesson = 1).

### 3.2 Lesson Groups
| Group | Lesson Range | Count | Purpose |
|-------|-------------|-------|---------|
| Foundational | L1–L34 | 34 | Core foundational phonics |
| G1 Minimum | L1–L44 | 44 | Grade 1 minimum benchmark |
| G1 Current Year | L23–L45 (excl. reviews) | 23 | Grade 1 current-year target |
| G2/G3 Minimum | L1–L56 | 56 | Grade 2/3 minimum benchmark |
| G2 Current Year | Various | 18 | Grade 2 current-year target |
| G4–G8 Minimum | L1–L103 | 103 | Grades 4–8 minimum benchmark |
| All Non-Review | Lessons 1–128 excl. 23 review | 105 | Non-gateway lessons |

- **BR-LESSON-04:** Lesson group arrays are defined in `SharedEngine.gs` (`FOUNDATIONAL_LESSONS`, `G1_MINIMUM_LESSONS`, etc.) and MUST NOT be redefined locally in school files.

### 3.3 Valid Lesson Statuses
- **BR-LESSON-05:** Valid lesson status values are: `""` (empty/not started), `"N/A"`, `"P"` (Pass), `"M"` (Master), `"IP"` (In Progress).
- **BR-LESSON-06:** Any value not in this set MUST be treated as invalid and flagged in import validation.

---

## 4. Skill Section Rules

### 4.1 Section Catalog
- **BR-SKILL-01:** There are exactly **16 skill sections**. They are defined in `SKILL_SECTIONS` in `SharedConstants.gs`.
- **BR-SKILL-02:** Each skill section contains a named array of lesson numbers that belong to it.

### 4.2 Section Percentage Calculation
- **BR-SKILL-03:** Section percentage = (number of passed/mastered lessons in section) / (total lessons in section) × 100.
- **BR-SKILL-04:** Passed = status `"P"` or `"M"`. Status `"N/A"`, `"IP"`, or `""` does NOT count as passed.
- **BR-SKILL-05:** Section percentage calculation is performed by `calculateSectionPercentage()` in `SharedEngine.gs`.

---

## 5. Review Lesson (Gateway) Rules

### 5.1 Review Lesson Catalog
- **BR-REVIEW-01:** There are exactly **23 review lessons** (gateway tests). They are defined in `REVIEW_LESSONS` (array) and `REVIEW_LESSONS_SET` (Set for O(1) lookup) in `SharedConstants.gs`.
- **BR-REVIEW-02:** Review lesson numbers: `[35,36,37,39,40,41,49,53,57,59,62,71,76,79,83,88,92,97,102,104,105,106,128]`.

### 5.2 Gateway Logic (v5.2)
- **BR-REVIEW-03 (Gateway Rule):** If ANY review lesson in a skill section is populated (has a status), the student MUST pass ALL review lessons in that section to receive 100% section credit.
- **BR-REVIEW-04:** If no review lessons are populated in a section, section credit falls back to the non-review calculation (BR-SKILL-03).
- **BR-REVIEW-05:** Passing a review lesson requires status `"P"` or `"M"`.
- **BR-REVIEW-06:** Gateway logic is implemented in `checkGateway()` in `SharedEngine.gs` and applies identically to all 6 schools. This logic MUST NOT be overridden per school.
- **BR-REVIEW-07:** `partitionLessonsByReview()` in `SharedEngine.gs` separates lessons into review and non-review buckets for a given section.

---

## 6. Performance Threshold & Status Rules

### 6.1 Thresholds
- **BR-PERF-01:** Performance thresholds are defined in `PERFORMANCE_THRESHOLDS` in `SharedConstants.gs`:
  - `ON_TRACK`: ≥ 80%
  - `NEEDS_SUPPORT`: ≥ 50%
  - `INTERVENTION`: < 50%

### 6.2 Status Labels
- **BR-PERF-02:** Performance status labels are defined in `STATUS_LABELS` in `SharedConstants.gs`:
  - `"On Track"`
  - `"Needs Support"`
  - `"Intervention"`

### 6.3 Status Determination
- **BR-PERF-03:** Status is determined by `getPerformanceStatus(percentage)` in `SharedConstants.gs`:
  ```
  if (percentage >= 80) → "On Track"
  if (percentage >= 50) → "Needs Support"
  otherwise             → "Intervention"
  ```
- **BR-PERF-04:** All dashboards, reports, and UI displays MUST use `getPerformanceStatus()` to determine status. Hardcoded threshold comparisons are prohibited in school-specific files.

---

## 7. Grade Metrics Rules

### 7.1 Shared Grade Metrics
- **BR-GRADE-01:** `SHARED_GRADE_METRICS` in `SharedEngine.gs` defines the standard denominator values for each grade level (PreK through G8).
- **BR-GRADE-02:** Grade metrics define, for each grade: `minimum` (benchmark lesson count) and `currentYear` (current-year target lesson count).
- **BR-GRADE-03:** School-specific grade metric overrides (e.g., GlobalPrep G3 uses `currentYear: 120` vs standard `107`) MUST be documented in the school's `get[School]Config()` function with a comment explaining the deviation.

### 7.2 Grade Range Model
- **BR-GRADE-04:** The system supports the following grade range models (configured in `SITE_CONFIG.gradeRangeModel`):

| Model Key | Grades Served |
|-----------|--------------|
| `prek_only` | PreK only |
| `k5` | KG, G1, G2, G3, G4, G5 |
| `k8` | KG, G1, G2, G3, G4, G5, G6, G7, G8 |
| `prek_8` | PreK, KG, G1, G2, G3, G4, G5, G6, G7, G8 |
| `custom` | School-defined via `gradesServed` array |

- **BR-GRADE-05:** The SetupWizard UI MUST offer preset buttons for all five models. Selecting a preset auto-populates the `gradesServed` array.
- **BR-GRADE-06:** The `custom` model requires an explicit `gradesServed` list in `SITE_CONFIG`.

---

## 8. Progress Tracking Rules

### 8.1 Core Sync Rules
- **BR-SYNC-01:** `updateAllProgress()` is the master sync function. It MUST update all progress sheets, the school summary, and pacing reports in a single call.
- **BR-SYNC-02:** `updateSchoolSummary()` aggregates per-grade statistics and renders the main dashboard.
- **BR-SYNC-03:** `syncSmallGroupProgress()` copies lesson data from grade-specific group sheets into the Small Group Progress master sheet.
- **BR-SYNC-04:** Progress recalculation MUST be triggered after any lesson data entry, student roster change, or group reassignment.

### 8.2 Growth Metrics
- **BR-SYNC-05:** `calculateGrowthMetrics()` computes student growth by comparing current performance to a baseline period.
- **BR-SYNC-06:** `calculateDistributionBands()` segments students into performance tiers for distribution analysis.

### 8.3 Pacing Rules
- **BR-PACING-01:** Pacing reports compare a student's/group's current lesson progress against grade-level expected pacing targets.
- **BR-PACING-02:** `scanGradeSheetsForPacing()` reads all grade sheets and computes pacing deltas.
- **BR-PACING-03:** Pacing is expressed as lessons ahead/behind the grade-level target at the current point in the school year.

### 8.4 New Student Initialization
- **BR-SYNC-07:** When a new student is added, `updateStatsForNewStudents()` MUST be called to initialize all formula cells and statistics for that student's row.

---

## 9. Group & Roster Management Rules

### 9.1 Group Naming
- **BR-GROUP-01:** Group naming follows one of three patterns, configured in `SITE_CONFIG.groupNamingPattern`:
  - `NUMBERED_TEACHER` — e.g., "Group 1 - Ms. Smith" (default)
  - `NUMBERED` — e.g., "Group 1"
  - `ALPHA` — e.g., "Group A"
- **BR-GROUP-02:** Group names MUST be unique within a school deployment.

### 9.2 Teacher Assignment
- **BR-GROUP-03:** Each group MUST have exactly one assigned teacher. `getTeacherForGroup(groupName)` returns the teacher for a given group.
- **BR-GROUP-04:** Teacher-group assignments are stored on the Teacher Roster sheet and the Group Config sheet.

### 9.3 Student-Group Assignment
- **BR-GROUP-05:** Each student MUST be assigned to exactly one group at a time.
- **BR-GROUP-06:** Student transfers between groups are performed by `moveStudentBetweenGroups()` in `MixedGradeSupport_Unified.gs` (or the school's phase2 file if not mixed-grade enabled).
- **BR-GROUP-07:** `autoBalanceStudents()` in `SetupWizard.gs` auto-assigns students to groups to achieve balanced group sizes.

### 9.4 Group Size Recommendations
- **BR-GROUP-08:** `calculateGroupRecommendations()` in `SetupWizard.gs` suggests group counts based on total student enrollment and target group size (configured in `SITE_CONFIG.advanced.groupSize`).

---

## 10. Mixed Grade Support Rules

### 10.1 Activation
- **BR-MIXED-01:** Mixed grade support is activated by setting `SITE_CONFIG.features.mixedGradeSupport: true`.
- **BR-MIXED-02:** When active, the system reads grade combinations from `MIXED_GRADE_CONFIG.combinations` at runtime. No combinations may be hardcoded in logic files.

### 10.2 Grade Combinations
- **BR-MIXED-03:** Grade combinations are defined as an array of objects in `MIXED_GRADE_CONFIG.combinations`:
  ```javascript
  { grades: ["KG", "G1"], sheetName: "KG-G1 Mixed" }
  ```
- **BR-MIXED-04:** A student may only be in one combination group at a time.
- **BR-MIXED-05:** `isMixedGradeGroup(groupName)` returns `true` if the group spans multiple grades.
- **BR-MIXED-06:** `getGradesForGroup(groupName)` returns the array of grades for a given group.

### 10.3 SC Classroom
- **BR-MIXED-07:** SC Classroom support is activated by `SITE_CONFIG.features.scClassroomGroups: true`.
- **BR-MIXED-08:** SC Classroom configuration is defined in `MIXED_GRADE_CONFIG.scClassroom`:
  ```javascript
  scClassroom: {
    gradeRange: ["G1", "G2", "G3", "G4"],  // configurable per school
    hasSubGroups: true,
    sheetName: "SC Classroom"
  }
  ```
- **BR-MIXED-09:** Adelante's SC Classroom spans G1–G5; Sankofa's spans G1–G4. The `gradeRange` field captures this school-specific difference.

### 10.4 Co-Teaching
- **BR-MIXED-10:** Co-teaching support is activated by `SITE_CONFIG.features.coTeachingSupport: true` (Sankofa only by default).
- **BR-MIXED-11:** Co-teaching pairs are defined by a `partnerGroupColumn` in `MIXED_GRADE_CONFIG.coTeaching`.
- **BR-MIXED-12:** `getPartnerGroup(groupName)` returns the co-teaching partner group.
- **BR-MIXED-13:** `getAllCoTeachingPairs()` returns all active co-teaching pairs.

### 10.5 Sheet Formats
- **BR-MIXED-14:** Mixed grade sheets support two formats, configured in `SITE_CONFIG.sheetFormat`:
  - `STANDARD` — Column A headers (default for all schools)
  - `SANKOFA` — Column D group headers
- **BR-MIXED-15:** Format selection MUST be applied consistently to all mixed grade sheets in a deployment.

---

## 11. SetupWizard & Configuration Rules

### 11.1 Wizard Flow
- **BR-WIZARD-01:** The SetupWizard MUST be presented as the first-run experience for any new deployment. `isSystemConfigured()` gates the wizard display.
- **BR-WIZARD-02:** The wizard collects configuration across 9 steps:
  1. School Information
  2. Grade Levels & Grade Range Model
  3. Students
  4. Teachers
  5. Groups
  6. Features
  7. Branding
  8. Sheet Layout
  9. Review & Confirmation
- **BR-WIZARD-03:** All configuration values collected by the wizard MUST be persisted to the Configuration sheet via `saveConfiguration()`. No wizard data may be stored only in memory.

### 11.2 Configuration Sheet Layout
- **BR-WIZARD-04:** All configuration sheet row numbers MUST be referenced via `CONFIG_LAYOUT` constants. Hardcoded row numbers are prohibited.
- **BR-WIZARD-05:** `CONFIG_LAYOUT` is defined in `SetupWizard.gs` and includes constants for every configuration row.

### 11.3 Re-configuration
- **BR-WIZARD-06:** The wizard MUST support re-running via "Re-run Setup Wizard" menu item. `getWizardData()` pre-populates all steps from existing configuration.
- **BR-WIZARD-07:** `getWizardData()` MUST include `gradeRangeModel`, `gradesServed`, and all feature flags in its return object.

### 11.4 Validation
- **BR-WIZARD-08:** Each wizard step has a corresponding `validateStep[N]()` function. Steps MUST NOT be completable until validation passes.
- **BR-WIZARD-09:** `validateSiteConfig(config)` performs post-wizard integrity checks including: required fields presence, valid color format, mixed grade constraint consistency.

---

## 12. Feature Flag Rules

### 12.1 Feature Flag Contract
- **BR-FLAG-01:** All feature flags live in `SITE_CONFIG.features` in `SiteConfig_TEMPLATE.gs`.
- **BR-FLAG-02:** All feature flags default to `false`. No feature may default to `true` unless it is a security feature (see BR-SEC-01).
- **BR-FLAG-03:** Feature flag names MUST be camelCase and match exactly the key checked in code.
- **BR-FLAG-04:** New feature flags MUST be added with a JSDoc comment block explaining the feature, which schools use it, and what it enables.

### 12.2 Current Feature Flag Catalog
| Flag | Default | Description | Schools Using |
|------|---------|-------------|--------------|
| `mixedGradeSupport` | `false` | Cross-grade grouping | Adelante, CHAW, Sankofa |
| `coachingDashboard` | `false` | Weekly coaching metrics | Sankofa |
| `tutoringSystem` | `false` | Dual-track tutoring progress | GlobalPrep |
| `grantReporting` | `false` | Automated grant reports | GlobalPrep |
| `growthHighlighter` | `false` | Visual growth highlighting | Adelante |
| `adminImport` | `false` | CSV historical data import | Adelante, Allegiant |
| `unenrollmentAutomation` | `false` | Auto-archival & Monday.com sync | Adelante |
| `scClassroomGroups` | `false` | SC Classroom mixed-group support | Adelante, Sankofa |
| `coTeachingSupport` | `false` | Co-teaching partner groups | Sankofa |
| `diagnosticTools` | `false` | Group sheet structure diagnostics | Allegiant, Sankofa, GlobalPrep, CHAW |
| `dynamicStudentRoster` | `false` | Dynamic student add/remove from sheets | Allegiant, GlobalPrep, CCA |
| `lessonArrayTracking` | `false` | Group lesson array tracking | Adelante, Allegiant, Sankofa, CHAW |
| `ufliMapQueueSystem` | `false` | UFLI MAP queue-based lesson updates | Adelante, Allegiant, CHAW |
| `enhancedSecurity` | `true` | Input sanitization & injection prevention | All schools |
| `structuredLogging` | `false` | Structured diagnostic logging | Allegiant |

### 12.3 Menu Activation
- **BR-FLAG-05:** `buildFeatureMenu()` in `ModuleLoader.gs` MUST be the sole mechanism for adding feature-specific menu items. No feature menu items may be hardcoded in `onOpen()`.
- **BR-FLAG-06:** Menu items for a feature MUST only appear when its flag is `true`.

---

## 13. AdminImport Rules

### 13.1 Import Types
- **BR-IMPORT-01:** The system supports two import types:
  - `"initial"` — Initial Assessment import (grid or row format)
  - `"progress"` — Lesson Progress import (incremental updates)

### 13.2 CSV Format Support
- **BR-IMPORT-02:** Grid format: students as rows, lessons as columns.
- **BR-IMPORT-03:** Row format: one row per student-lesson combination.
- **BR-IMPORT-04:** `detectFormat()` automatically identifies the CSV format. Manual override is not required.

### 13.3 Staging Workflow
- **BR-IMPORT-05:** ALL imports MUST be staged to the "Import Staging" sheet before processing. No direct writes to tracking sheets during import.
- **BR-IMPORT-06:** Validation runs row-by-row via `validateRow()`. Invalid rows MUST be written to the "Import Exceptions" sheet with: row number, student name, issue type, details, and raw data.
- **BR-IMPORT-07:** Only rows with a valid `"✓"` status in the staging sheet may be processed.

### 13.4 Validation Rules
- **BR-IMPORT-08:** Student names must be non-empty and match a student in the roster.
- **BR-IMPORT-09:** Lesson names must match a valid UFLI lesson label from `LESSON_LABELS`.
- **BR-IMPORT-10:** Status values must be one of: `"N/A"`, `"P"`, `"M"`, `"IP"`, `""`.
- **BR-IMPORT-11:** Date fields must be parseable as valid dates.

### 13.5 Constants
- **BR-IMPORT-12:** Import constants (`ADMIN_SHEET_NAMES`, `IMPORT_COLUMNS`, `IMPORT_TYPES`, `VALID_STATUSES`) are defined in `AdminImport_Unified.gs` and MUST NOT be redefined elsewhere.

### 13.6 Post-Import
- **BR-IMPORT-13:** After successful processing, data MUST be archived to "Small Group Historical" sheet via `archiveToHistorical()`. 
- **BR-IMPORT-14:** `refreshAllStats()` MUST be called after every import to ensure dashboards and reports reflect imported data.
- **BR-IMPORT-15:** Staging sheet MUST be cleared via `clearStagingSheet()` after archival.

---

## 14. Tutoring System Rules

### 14.1 Activation
- **BR-TUTOR-01:** The tutoring system is activated by `SITE_CONFIG.features.tutoringSystem: true` (GlobalPrep only by default).
- **BR-TUTOR-02:** Tutoring sheets are initialized via `createTutoringSheets()`.

### 14.2 Tutoring Tracking
- **BR-TUTOR-03:** The tutoring system tracks a second progress track parallel to the main UFLI track.
- **BR-TUTOR-04:** `syncTutoringProgress()` synchronizes tutoring progress data to the main tracking system.
- **BR-TUTOR-05:** `goToTutoringSummary()` and `goToTutoringLog()` provide navigation helpers.

---

## 15. Coaching Dashboard Rules

### 15.1 Activation
- **BR-COACH-01:** The coaching dashboard is activated by `SITE_CONFIG.features.coachingDashboard: true` (Sankofa only by default).

### 15.2 Dashboard Behavior
- **BR-COACH-02:** `openCoachView()` launches the weekly coaching dashboard.
- **BR-COACH-03:** `refreshCoachView()` recalculates and re-renders coaching metrics.
- **BR-COACH-04:** `setupCoachViewTrigger()` installs a time-based trigger for automatic dashboard refresh.
- **BR-COACH-05:** The coaching dashboard displays weekly metrics and is refreshed on a configurable schedule.

---

## 16. Grant Reporting Rules

### 16.1 Activation
- **BR-GRANT-01:** Grant reporting is activated by `SITE_CONFIG.features.grantReporting: true` (GlobalPrep only by default).

### 16.2 Report Generation
- **BR-GRANT-02:** Grant reports are generated via `GrantReporting.gs` in the `modules/` directory.
- **BR-GRANT-03:** Grant reports summarize student performance metrics in a format required by grant funding bodies.

---

## 17. Branding & UI Rules

### 17.1 Branding Configuration
- **BR-BRAND-01:** All school branding is configured in `SITE_CONFIG.branding`:
  - `schoolName` — Full school name
  - `shortName` — Abbreviated name
  - `tagline` — School tagline
  - `logoUrl` — Google Drive file ID or public URL
  - `primaryColor` — Main accent color (hex)
  - `headerGradientStart` — Setup wizard header gradient start (hex)
  - `headerGradientEnd` — Setup wizard header gradient end (hex)
  - `accentColor` — Secondary accent color (hex)

### 17.2 Dynamic Branding (Adelante & CHAW only)
- **BR-BRAND-02:** Dynamic branding (logo insertion, color theming on sheets) is activated by implementing `loadSchoolBranding()` and `applySheetBranding()` in the school-specific phase2 file.
- **BR-BRAND-03:** `lightenColor(hex, factor)` is a utility for computing lighter tints of brand colors.
- **BR-BRAND-04:** Adelante maintains a branding cache (`clearBrandingCache()`) to avoid redundant Drive API calls.

### 17.3 UI Templating
- **BR-UI-01:** All HTML UI files use Apps Script server-side templating (`<?= ?>`) for branding injection. Client-side config fetching is prohibited for branding.
- **BR-UI-02:** `getBranding()` in `SiteConfig_TEMPLATE.gs` returns the branding object with safe defaults.
- **BR-UI-03:** All UI color references MUST use `getBranding().primaryColor`, `getBranding().accentColor`, etc. Hardcoded hex values in HTML files are prohibited.

### 17.4 Canonical UI Files
| File | Purpose |
|------|---------|
| `SetupWizardUI.html` | 9-step setup wizard |
| `ManageStudentsUI.html` | Student roster management dialog |
| `ManageGroupsUI.html` | Group configuration dialog |
| `GenerateReportsUI.html` | Report generation dialog |
| `LessonEntryForm.html` | Daily lesson data entry form |
| `GrowthHighlighterSidebar.html` | Growth visualization sidebar |

- **BR-UI-04:** School-specific HTML files have been deleted (Phase 5). All schools use canonical UI files with branding tokens.

---

## 18. Security & Data Integrity Rules

### 18.1 Input Sanitization
- **BR-SEC-01:** `SITE_CONFIG.features.enhancedSecurity` defaults to `true` for all schools.
- **BR-SEC-02:** `sanitizeCellValue(value)` in `AdminImport_Unified.gs` MUST be applied to ALL user-provided input before writing to any sheet. It enforces:
  - Formula injection prevention: strips leading `=`, `+`, `-`, `@` characters
  - Null byte removal
  - String length limit: max 32,767 characters
  - Whitespace normalization
- **BR-SEC-03:** Data row padding: all import rows MUST be padded to 5 columns before metadata is appended. This prevents column offset errors.
- **BR-SEC-04:** Security sanitization MUST NOT be bypassed even when `enhancedSecurity` is `false`. The flag only controls whether the full `sanitizeCellValue()` chain runs; basic null/type checking always applies.

### 18.2 Data Validation
- **BR-VALID-01:** `validateRequiredProps(obj, props)` checks that all required properties exist on a configuration object. All wizard save operations MUST call this before persisting.
- **BR-VALID-02:** `validateSiteConfig(config)` runs integrity checks on the full SITE_CONFIG. It is called at system startup.

### 18.3 Sheet Protection
- **BR-PROTECT-01:** Configuration, Group Config, and Feature Settings sheets MUST be protected via `protectSheet()` after initial setup to prevent accidental edits.

---

## 19. Sync & Automation Rules

### 19.1 Nightly Sync
- **BR-AUTO-01:** `setupNightlySyncTrigger()` installs a Google Apps Script time-based trigger for automated overnight sync.
- **BR-AUTO-02:** `removeNightlySyncTrigger()` removes the trigger. Both functions are accessible from the Sync & Performance menu.
- **BR-AUTO-03:** `runFullSyncDeferred()` queues a full sync for deferred execution to avoid blocking the UI.

### 19.2 UFLI MAP Queue System
- **BR-AUTO-04:** When `SITE_CONFIG.features.ufliMapQueueSystem: true`, lesson entry operations are queued rather than written immediately. `updateUFLIMapTargeted()` processes queue entries.
- **BR-AUTO-05:** `updateGroupSheetTargeted()` performs targeted (non-full) progress updates for a specific group/lesson combination. This is preferred over full recalc for single-lesson updates.
- **BR-AUTO-06:** `showSyncStatus()` displays the current queue status. `showTriggerStatus()` displays trigger configuration status.

### 19.3 Unenrollment Automation
- **BR-AUTO-07:** Unenrollment automation is activated by `SITE_CONFIG.features.unenrollmentAutomation: true` (Adelante only by default).
- **BR-AUTO-08:** On unenrollment, student records are archived and optionally synced to Monday.com.
- **BR-AUTO-09:** `logUnenrolledStudents()` writes a record of unenrolled students for audit purposes.

---

## 20. Sheet Layout & Structure Rules

### 20.1 Layout Configuration
- **BR-LAYOUT-01:** Sheet layout is configured in `SITE_CONFIG.layout`:
  - `headerRowCount` — Number of header rows before data begins
  - `dataStartRow` — First row containing student data (= headerRowCount + 1)
  - `lessonColumnOffset` — Column where lesson data begins
  - `groupFormat` — Group column format (see BR-LAYOUT-02)
  - `includeSCClassroom` — Whether to include SC Classroom sheet

### 20.2 Group Format Options
- **BR-LAYOUT-02:** `groupFormat` values and their meanings:
  - `STANDARD` — Column A contains group headers (most schools)
  - `SANKOFA` — Column D contains group headers (Sankofa legacy format)

### 20.3 School-Specific Layout Values
| School | headerRowCount | dataStartRow | Notes |
|--------|---------------|-------------|-------|
| Adelante | 5 | 6 | Standard layout |
| CCA | 4 | 5 | Compact header |
| Others | 4–5 | 5–6 | See school config |

- **BR-LAYOUT-03:** Layout values are used by `UnifiedPhase2_ProgressTracking.gs` (Phase 7 target) and `UnifiedConfig.gs` to compute cell references at runtime. No sheet generation function may hardcode row numbers.

### 20.4 System Sheets
- **BR-LAYOUT-04:** The following sheets are required in every deployment and created by `generateSystemSheets()`:
  - School Summary (main dashboard)
  - Small Group Progress
  - UFLI MAP
  - Skills Tracker
  - Grade Summary
  - Group Config
  - Configuration
  - Student Roster
  - Teacher Roster
  - Feature Settings

---

## 21. Phase History & Rule Evolution

| Phase | Date | Key Rules Introduced |
|-------|------|---------------------|
| Phase 1 | Feb 2026 | `SharedConstants.gs` extraction. All UFLI constants centralized. BR-LESSON-*, BR-SKILL-*, BR-REVIEW-*, BR-PERF-* established. |
| Phase 2 | Feb 2026 | `SharedEngine.gs` created. Core calculation functions unified. BR-SYNC-*, BR-PACING-* established. Gateway logic v5.2 locked in. |
| Phase 3 | Feb 2026 | `SiteConfig_TEMPLATE.gs` and `SetupWizard.gs` v4.0 introduced. BR-WIZARD-*, BR-LAYOUT-* established. |
| Phase 4 | Feb 2026 | `modules/` directory and `ModuleLoader.gs` introduced. BR-FLAG-*, BR-DEPLOY-* established. All optional features extracted to modules. |
| Phase 5 | Feb 2026 | HTML UI files unified to canonical versions with server-side templating. BR-UI-*, BR-BRAND-* established. School-specific HTML files deleted. |
| Phase 6 | Feb 2026 | SharedConstants backport validated across all 6 schools. 89 references confirmed. BR-DEPLOY-02 enforced. |
| Phase 7a | Feb 2026 | Audit of 17 school-specific logic files. Feature flag matrix produced. Delta report authored (`PHASE7_AUDIT_REPORT.md`). |
| Phase 7b | Feb 2026 | `AdminImport_Unified.gs` created. BR-SEC-*, BR-IMPORT-* established. `enhancedSecurity` and `structuredLogging` flags added. |
| Phase 7c | Feb 2026 | `MixedGradeSupport_Unified.gs` created. BR-MIXED-* established. `scClassroomGroups` and `coTeachingSupport` flags added. |

---

## 22. Open Questions & Deferred Decisions

> This section tracks business rule decisions that are pending, under discussion, or require stakeholder input. Remove items once resolved and document them in the relevant section above.

| # | Question | Status | Owner | Target Phase |
|---|----------|--------|-------|-------------|
| OQ-01 | Should `diagnosticTools` be a named feature flag or remain implicit in certain school configs? | Open | ckelley-adira | Phase 7d |
| OQ-02 | CCA's `calculateSkillAverages()` and `renderSkillAveragesRow()` — should these be promoted to a general feature flag (`skillAveragesAnalytics`) or remain CCA-only in Phase 7d consolidation? | Open | ckelley-adira | Phase 7d |
| OQ-03 | GlobalPrep `getGroupsFromConfiguration()` is defined 3 times — consolidation target for Phase 7d. Confirm which definition is canonical. | Open | ckelley-adira | Phase 7d |
| OQ-04 | Sankofa `updateAllStats_Sankofa()` uses different statistical logic from the standard `updateAllProgress()`. Should this become a `customStatsCalculation` flag or be normalized? | Open | ckelley-adira | Phase 7d |
| OQ-05 | `UnifiedPhase2_ProgressTracking.gs` (Phase 7 target) — when Phase 7d–7g are complete, should school-specific Phase2 files be deleted or retained as deprecated stubs? | Open | ckelley-adira | Phase 7g |
| OQ-06 | `structuredLogging` defaults to `false`. Should it auto-enable in non-production environments? Requires definition of environment detection strategy. | Open | ckelley-adira | Future |
| OQ-07 | Monday.com integration details (field mapping, API version, auth approach) are not yet documented. Requires spec from operations team. | Open | ckelley-adira | Future |

---

*This document is maintained alongside the codebase. When submitting a PR that changes a business rule, update the relevant section(s) here in the same PR.*