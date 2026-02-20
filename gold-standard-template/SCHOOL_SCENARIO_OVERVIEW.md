# School Scenario Overview — Gold Standard Template

> **Purpose:** This document demonstrates how the Gold Standard Template provisions a new school end-to-end using a fictional reference school, **Horizon Academy**. It serves as both a validation tool (did we hit the 90/10 shared-vs-school-specific goal?) and a deployment guide for future schools.

---

## Table of Contents

1. [Scenario Profile — Horizon Academy](#1-scenario-profile--horizon-academy)
2. [Copy-Pasteable `SiteConfig_TEMPLATE.gs` Configuration](#2-copy-pasteable-siteconfigtemplatgs-configuration)
3. [Pre-K System — Feature Toggle Reference](#3-pre-k-system--feature-toggle-reference)
4. [Feature Activation Matrix](#4-feature-activation-matrix)
5. [Day-in-the-Life Walkthroughs](#5-day-in-the-life-walkthroughs)
6. [Architecture Validation — 90/10 Assessment](#6-architecture-validation--9010-assessment)
7. [Known Gaps & Roadmap](#7-known-gaps--roadmap)

---

## 1. Scenario Profile — Horizon Academy

| Property | Value |
|---|---|
| School Name | Horizon Academy |
| School Code | `HA` |
| Grade Range | Pre-K through Grade 8 |
| Grade Range Model | `prek_8` |
| Pre-K Curriculum | Full HWT (Handwriting Without Tears) |
| K–4 Groups | Standard single-grade UFLI groups |
| G5–G8 Groups | Mixed-grade: G5+G6 and G7+G8 |
| Intervention Program | Dual-track tutoring system enabled |
| Coaching Staff | Coaching dashboard enabled for weekly metrics |
| Grant Reporting | Mind Trust–style funder (14-day lookback) |
| Unenrollment Tracking | Monday.com integration enabled |
| Student Transience | High — archive/restore workflows needed |

---

## 2. Copy-Pasteable `SiteConfig_TEMPLATE.gs` Configuration

The block below shows the exact values Horizon Academy would set. Replace the placeholder `SiteConfig_TEMPLATE.gs` stub with this content.

```javascript
const SITE_CONFIG = {
  schoolName: "Horizon Academy",
  systemVersion: "7.0",

  // ── Grade Range ──────────────────────────────────────────────────────────
  gradeRangeModel: "prek_8",
  gradesServed: ["PreK", "KG", "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8"],

  // ── Sheet Layout ─────────────────────────────────────────────────────────
  layout: {
    headerRowCount: 5,
    dataStartRow: 6,
    lessonColumnOffset: 5,
    lessonsPerGroupSheet: 12,
    groupFormat: "standard",
    includeSCClassroom: false
  },

  // ── Branding ─────────────────────────────────────────────────────────────
  branding: {
    schoolName: "Horizon Academy",
    shortName: "HA",
    tagline: "Reach Higher. Every Day.",
    logoUrl: "",
    primaryColor: "#1A6B4A",
    headerGradientStart: "#1A6B4A",
    headerGradientEnd: "#134F36",
    accentColor: "#2D9B6B"
  },

  // ── Version Tracking ─────────────────────────────────────────────────────
  versionTracking: {
    previousVersions: [],
    upgradeDate: "",
    legacyConfigFormat: ""
  },

  // ── Menu Customization ────────────────────────────────────────────────────
  menuCustomization: {
    menuName: "HA Tools",
    featureLabels: {}
  },

  // ── Feature Flags ─────────────────────────────────────────────────────────
  features: {
    // Pre-K: Full HWT system (see Section 3 for mode details)
    preKSystem: "hwt",

    mixedGradeSupport: true,
    coachingDashboard: true,
    tutoringSystem: true,
    grantReporting: true,
    growthHighlighter: true,
    adminImport: true,
    enhancedSecurity: true,
    structuredLogging: false,
    unenrollmentAutomation: true,
    scClassroomGroups: false,
    coTeachingSupport: false,
    dynamicBranding: true,
    skillAveragesAnalytics: false,
    diagnosticTools: false,
    lessonArrayTracking: true,
    studentNormalization: false,
    dynamicStudentRoster: true,
    ufliMapQueue: true,
    syncQueueProcessing: true,
    nightlySyncAutomation: true,
    syncStatusMonitoring: true,
    formulaRepairTools: false,
    studentEditCapability: true
  }
};

// ── Mixed Grade Configuration ───────────────────────────────────────────────
const MIXED_GRADE_CONFIG = {
  enabled: true,
  sheetFormat: "STANDARD",
  // Mixed-grade sheet groupings for upper grades
  combinations: "G5+G6, G7+G8",
  namingPattern: "NUMBERED_TEACHER",
  scClassroom: {
    gradeRange: [],
    hasSubGroups: false,
    sheetName: "SC Classroom"
  },
  coTeaching: {
    partnerGroupColumn: 0
  }
};

// ── Grant Configuration ─────────────────────────────────────────────────────
const GRANT_CONFIG = {
  reportSheet: "Mind Trust Summary",
  lookbackDays: 14,
  gapThreshold: 50,
  criticalThreshold: 25,
  autoSchedule: false,
  scheduleFrequency: 14
};

// ── Unenrollment Configuration ──────────────────────────────────────────────
const UNENROLLMENT_CONFIG = {
  archiveSheet: "Student Archive",
  autoDeleteFromGroups: true,
  createMondayTask: true,
  mondayBoardId: "YOUR_MONDAY_BOARD_ID", // Replace with your numeric Monday.com board ID.
                                          // Find it in the board's URL: monday.com/boards/XXXXXXXXX
  enableAuditLog: true
};
```

---

## 3. Pre-K System — Feature Toggle Reference

The `preKSystem` flag is a **tri-state toggle** that controls how (or whether) Pre-K students are tracked.

### Available Modes

| Value | Name | Description |
|---|---|---|
| `false` | No Pre-K | Pre-K grade is excluded. The system operates as K–8 only. |
| `"light"` | Pre-K Light | Basic Pre-K tracking inside the standard UFLI lesson framework. Students are tracked like K–8 peers but with Pre-K-appropriate denominators (Form: 26, Name+Sound: 52, Full: 78). No separate HWT UI or workflows. |
| `"hwt"` | Pre-K HWT (Full) | Complete Handwriting Without Tears system with dedicated sheets, UI, and workflows (see file list below). |

### Files Activated by Mode

| File | `false` | `"light"` | `"hwt"` |
|---|:---:|:---:|:---:|
| Standard UFLI PreK denominators | — | ✅ | ✅ |
| `PreKMainCode.gs` | — | — | ✅ |
| `prek/PreKIndex.html` | — | — | ✅ |
| `prek/PreKDashboard.html` | — | — | ✅ |
| `prek/PreKTutorForm.html` | — | — | ✅ |
| `prek/PreKParentReport.html` | — | — | ✅ |
| `prek/PreKSetupWizard.html` | — | — | ✅ |
| `prek/PreKPortal.html` | — | — | ✅ |
| `SHEET_NAMES_PREK` constants | — | — | ✅ |
| `PREK_CONFIG` column mappings | — | — | ✅ |
| Pre-K HWT menu in `buildFeatureMenu` | — | — | ✅ |

### Pre-K HWT Configuration Object

When `preKSystem === "hwt"`, `PreKMainCode.gs` uses the following constants (already defined in that file):

```javascript
// Fixed HWT denominators
const TOTAL_LESSONS = 26;                      // 26 letters

// Sheet names (SHEET_NAMES_PREK)
const PRE_SCHOOL_SHEET_NAME  = "Pre-School";
const PRE_K_SHEET_NAME       = "Pre-K";
const PACING_SHEET_NAME      = "Pacing";
const SUMMARY_SHEET_NAME     = "Skill Summary Page";
const TUTOR_SHEET_NAME       = "Tutors";
const TUTOR_LOG_SHEET_NAME   = "Tutor Log";
const SEQUENCE_SHEET_NAME    = "Instructional Sequence";

// PREK_CONFIG column mappings (Skill Summary Page)
const SUMMARY_PRE_K_FORM_IN_PROGRESS_COL  = 5;  // Col E
const SUMMARY_PRE_K_FORM_CUMULATIVE_COL   = 6;  // Col F
const SUMMARY_PRE_K_NAME_IN_PROGRESS_COL  = 7;  // Col G
const SUMMARY_PRE_K_NAME_CUMULATIVE_COL   = 8;  // Col H
const SUMMARY_PRE_K_SOUND_IN_PROGRESS_COL = 9;  // Col I
const SUMMARY_PRE_K_SOUND_CUMULATIVE_COL  = 10; // Col J
```

---

## 4. Feature Activation Matrix

The table below maps Horizon Academy's enabled features to the files/modules they activate.

| Feature | Flag | Status | Files / Modules |
|---|---|:---:|---|
| Core Engine | (always on) | ✅ | `SharedConstants.gs`, `SharedEngine.gs`, `Phase2_ProgressTracking.gs` |
| Pre-K HWT | `preKSystem: "hwt"` | ✅ | `PreKMainCode.gs` + all `prek/*.html` |
| Mixed Grade Support | `mixedGradeSupport: true` | ✅ | `modules/MixedGradeSupport.gs` |
| Tutoring System | `tutoringSystem: true` | ✅ | `modules/TutoringSystem.gs` |
| Coaching Dashboard | `coachingDashboard: true` | ✅ | `modules/CoachingDashboard.gs` |
| Grant Reporting | `grantReporting: true` | ✅ | `modules/GrantReporting.gs` |
| Growth Highlighter | `growthHighlighter: true` | ✅ | `modules/GrowthHighlighter.gs` |
| Unenrollment Automation | `unenrollmentAutomation: true` | ✅ | `modules/UnenrollmentAutomation.gs` |
| Admin Import | `adminImport: true` | ✅ | `modules/AdminImport.gs` |
| Enhanced Security | `enhancedSecurity: true` | ✅ | `SharedEngine.gs` (`sanitizeCellValue`) |
| Dynamic Student Roster | `dynamicStudentRoster: true` | ✅ | `Phase2_ProgressTracking.gs` |
| UFLI MAP Queue | `ufliMapQueue: true` | ✅ | `SetupWizard.gs` sync queue |
| Sync Queue Processing | `syncQueueProcessing: true` | ✅ | `SetupWizard.gs` hourly trigger |
| Nightly Sync | `nightlySyncAutomation: true` | ✅ | `SetupWizard.gs` nightly trigger |
| Sync Status Monitoring | `syncStatusMonitoring: true` | ✅ | `SetupWizard.gs` status dialog |
| Student Edit Capability | `studentEditCapability: true` | ✅ | `Phase2_ProgressTracking.gs` |
| Dynamic Branding | `dynamicBranding: true` | ✅ | `SetupWizard.gs` + `SITE_CONFIG.branding` |
| SC Classroom Groups | `scClassroomGroups: false` | ❌ | `modules/MixedGradeSupport.gs` |
| Co-Teaching Support | `coTeachingSupport: false` | ❌ | `SetupWizard.gs` |
| Skill Averages Analytics | `skillAveragesAnalytics: false` | ❌ | `modules/CoachingDashboard.gs` |
| Formula Repair Tools | `formulaRepairTools: false` | ❌ | `SetupWizard.gs` |
| Student Normalization | `studentNormalization: false` | ❌ | `Phase2_ProgressTracking.gs` |

---

## 5. Day-in-the-Life Walkthroughs

### 5.1 — Pre-K Teacher Logging HWT Progress

Ms. Rivera opens the Google Sheet and clicks **HA Tools → 🧒 Pre-K (HWT) → 📝 Pre-K Tutor Entry**.

`openPreKTutorForm()` (gated by `preKSystem === "hwt"` in `buildFeatureMenu`) serves `prek/PreKTutorForm.html`. She selects the student, chooses the current HWT letter (e.g., "F"), and marks Form, Name, and Sound progress. On submit, `PreKMainCode.gs` writes the result to the **Pre-K** sheet using the fixed column mappings in `PREK_CONFIG` and updates the **Skill Summary Page** cumulative totals.

### 5.2 — G3 Teacher Submitting a Lesson Entry

Mr. Thompson opens the spreadsheet. The **G3 Groups** sheet was generated as a standard single-grade sheet during onboarding (`gradeRangeModel: "prek_8"`, no mixed-grade entry for G3). He locates his group row and submits progress through the standard lesson entry form. `Phase2_ProgressTracking.gs` writes the result via `saveLessonData()`. Because `ufliMapQueue: true`, the UFLI MAP update is deferred to the next hourly sync run.

### 5.3 — G7 Student in a Mixed-Grade Group (Gateway)

Destiny is in a G7+G8 mixed group created by `MIXED_GRADE_CONFIG.combinations: "G5+G6, G7+G8"`. `MixedGradeSupport.gs` generates a **G7 to G8 Groups** sheet. Because Destiny scored above the gateway threshold during the beginning-of-year assessment, she is placed on a review-only lesson path. Her group's lesson entry form still submits normally; the gateway logic (P2 roadmap item) limits the lessons displayed to review lessons only.

### 5.4 — Coach Reviewing the Weekly Coaching Dashboard

After the Monday morning check-in, Instructional Coach Dr. Osei clicks **HA Tools → 👨‍🏫 Coach Tools → 🔄 Refresh Dashboard**. `CoachingDashboard.gs` reads the last four weeks of progress data (`lookbackWeeks: 4` in `COACHING_CONFIG`) and rewrites the **Weekly Coaching Dashboard** sheet with grade-level AG%, week-over-week trend arrows, and flagged groups below target.

### 5.5 — Admin Generating a Grant Report

On the last Friday of the bi-weekly reporting window, the admin clicks **HA Tools → 📊 Grant Reports → 📊 Generate Mind Trust Summary**. `GrantReporting.gs` uses `GRANT_CONFIG.lookbackDays: 14` to pull the past two weeks of lesson data, calculates gap and critical-gap rates against the configured thresholds, and writes the results to the **Mind Trust Summary** sheet.

### 5.6 — Student Being Unenrolled Mid-Year

A family notifies the office that Marcus will be leaving Horizon Academy. The admin clicks **HA Tools → Unenrollment** (surfaced by `modules/UnenrollmentAutomation.gs`). The system:

1. Archives Marcus's progress rows to the **Student Archive** sheet.
2. Removes him from his active group sheet (because `autoDeleteFromGroups: true`).
3. Creates a Monday.com task on the board specified by `mondayBoardId` (because `createMondayTask: true`).
4. Writes an audit log entry to the audit log sheet (because `enableAuditLog: true`).

If Marcus re-enrolls, the restore-from-archive workflow (P0 gap — see Section 7) would reverse steps 1–2.

---

## 6. Architecture Validation — 90/10 Assessment

### Shared vs. School-Specific Code

The goal is for **≥ 90% of code to be shared** across all schools, with ≤ 10% being school-specific configuration.

| Bucket | Files | Approx. Bytes | Notes |
|---|---|---:|---|
| Shared engine | `SharedConstants.gs`, `SharedEngine.gs`, `Phase2_ProgressTracking.gs` | ~85 KB | Zero per-school edits needed |
| Shared modules | `modules/*.gs` (7 modules) | ~110 KB | Feature-flagged; no per-school edits |
| Pre-K engine | `PreKMainCode.gs`, `prek/*.html` (6 files) | ~55 KB | Flag-gated; zero per-school edits |
| Setup & loader | `SetupWizard.gs`, `modules/ModuleLoader.gs`, `UnifiedConfig.gs` | ~95 KB | Shared infrastructure |
| **School-specific config** | `SiteConfig_TEMPLATE.gs` (one per school) | **~8 KB** | Only file that changes per school |
| UI (shared) | `ui/*.html` (shared HTML templates) | ~35 KB | Shared |
| **Total** | | **~388 KB** | |
| **School-specific share** | | **~2%** | Well inside the 10% target ✅ |

> **Assessment: The Gold Standard Template exceeds the 90/10 goal.** School-specific code (a single `SiteConfig_TEMPLATE.gs` copy) represents approximately 2% of total code volume. All logic, UI, and module code is shared across every deployment.

### Caveats

- The byte analysis above counts the *template* copy of `SiteConfig_TEMPLATE.gs`. Schools that add local extension files (e.g., custom branding extensions) would increase the school-specific share.
- The deprecated per-school wizard files (`AdelanteSetUpWizard.gs`, etc.) are not counted; they are scheduled for removal in Phase 8.

---

## 7. Known Gaps & Roadmap

### P0 — Must Fix Before Next Deployment

| Gap | Description | Affected Scenario |
|---|---|---|
| **K–8 Parent Progress Reports** | Pre-K has `PreKParentReport.html` and a full parent-facing report pipeline. K–8 has no equivalent. Parents of K–8 students receive no automated progress communication. | 5.2, 5.3 |
| **Restore from Archive** | `UnenrollmentAutomation.gs` archives students and creates Monday tasks but does not support re-enrollment. If a student returns, data must be restored manually. | 5.6 |

### P1 — High Value, Next Sprint

| Gap | Description | Affected Scenario |
|---|---|---|
| **Student History Module** | Weekly AG% snapshots for trend analysis existed in the legacy Sankofa deployment but were never promoted to the shared template. Needed for multi-week sparklines in the coaching dashboard. | 5.4 |
| **Mixed-Grade-Aware Tutoring Groups** | `TutoringSystem.gs` generates tutoring groups per single grade. When students are in G5+G6 or G7+G8 mixed groups, tutoring assignments reference the wrong sheet. | 5.3 |

### P2 — Planned

| Gap | Description | Affected Scenario |
|---|---|---|
| **Auto-Assignment of Review-Only Path** | High-scoring G5–G8 students who have completed the UFLI sequence should be automatically placed on a review-only lesson path. Gateway logic exists conceptually but is not yet implemented in the mixed-grade sheet. Separate PR in progress. | 5.3 |
| **Pre-K Light Denominators in Setup Wizard** | When `preKSystem: "light"`, the Setup Wizard should surface a simplified Pre-K denominator configuration screen (Form: 26, Name+Sound: 52, Full: 78) rather than the full HWT wizard. Currently the wizard defaults to HWT or skips Pre-K entirely. | General |
