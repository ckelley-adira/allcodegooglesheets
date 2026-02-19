# Technology Current State Assessment

**Prepared for:** Technology Review
**Date:** February 2026
**Version:** 1.0
**Purpose:** This document provides a structured overview of the organization's current technology stack, architecture, strengths, limitations, and active consolidation roadmap. It is intended to support a vendor-led Technology Review and inform a future-state technology strategy for submission to a funder.

---

## Table of Contents

1. [Organizational Context](#1-organizational-context)
2. [Technology Stack — Primary Platform](#2-technology-stack--primary-platform)
3. [Application Architecture — Current State](#3-application-architecture--current-state)
4. [User Interface Architecture](#4-user-interface-architecture)
5. [Data Architecture](#5-data-architecture)
6. [Security & Quality Controls](#6-security--quality-controls)
7. [Integration Landscape](#7-integration-landscape)
8. [Current State Strengths](#8-current-state-strengths)
9. [Current State Limitations & Technical Debt](#9-current-state-limitations--technical-debt)
10. [Consolidation Roadmap (In-Progress)](#10-consolidation-roadmap-in-progress)
11. [Technology Summary Table](#11-technology-summary-table)
12. [Glossary](#glossary)

---

## 1. Organizational Context

The organization is a literacy instruction nonprofit that provides structured literacy support to students at partner school sites. Its primary instructional model is grounded in the UFLI (University of Florida Literacy Initiative) phonics curriculum, a research-based framework consisting of **128 sequenced lessons** organized into skill sections and grade-level benchmarks.

### Mission and Operational Model

- Delivers UFLI structured literacy instruction across **6 partner school sites** serving students from **PreK through Grade 8**
- Supports **instructional coaches** and **classroom teachers** who track student progress through a rigorous, skill-sequenced phonics curriculum
- Uses **small-group instruction** as the primary delivery model, with students grouped by reading level across and within grade levels
- Tracks student progress, pacing, benchmark attainment, and lesson completion at the individual and group level
- Generates **grant reports**, **pacing reports**, **parent reports**, and **coaching dashboards** to communicate student outcomes to stakeholders
- Manages student enrollment, unenrollment, and historical data import across all partner sites

### Instructional Curriculum Structure

- **128 lessons** organized into **16 skill sections**
- **23 review/gateway lessons** embedded throughout the sequence as pacing checkpoints
- Students advance through lessons individually; groups are reconfigured as student readiness warrants
- Grade-level benchmarks define expected lesson attainment targets for each grade

---

## 2. Technology Stack — Primary Platform

| Layer | Technology | Notes |
|---|---|---|
| Data & Spreadsheet Platform | Google Sheets | Primary data store for all student, lesson, and progress data |
| Scripting & Automation | Google Apps Script (GAS) | JavaScript-based; runs server-side in Google's cloud |
| UI Layer | HTML + CSS + JavaScript | Served via HtmlService within Google Sheets dialogs and sidebars |
| Version Control | GitHub | Repository: ckelley-adira/allcodegooglesheets |
| AI-Assisted Development | GitHub Copilot (coding agent) | Used for code generation, refactoring, and consolidation |
| External Integration | Monday.com API | Used for unenrollment/offboarding workflow automation |
| Curriculum Framework | UFLI (University of Florida Literacy Initiative) | 128-lesson structured phonics curriculum |

---

## 3. Application Architecture — Current State

### Multi-Site Deployment Model

- Each partner site runs its own **independent Google Sheets workbook** with Apps Script attached
- All sites share the **same codebase**, deployed per site and configured via a `SITE_CONFIG` object in `SiteConfig_TEMPLATE.gs`
- The system uses a **feature flag architecture** — optional modules are toggled on or off per site without requiring code changes
- Code is managed in a **single GitHub repository** and pushed to each site's Apps Script project manually

### Core Modules (Shared Across All Sites)

| Module | File | Purpose |
|---|---|---|
| Shared Constants | `SharedConstants.gs` | 128 UFLI lesson labels, 16 skill sections, 23 review lessons, performance thresholds |
| Shared Engine | `SharedEngine.gs` | Core calculation logic: benchmarks, section percentages, gateway logic, grade metrics |
| Progress Tracking | `Phase2_ProgressTracking_Unified.gs` | Sheet generation, pacing analysis, dashboard rendering, student stats |
| Setup Wizard | `SetupWizard.gs` + `SetupWizardUI.html` | 9-step guided configuration UI for new site onboarding |
| Site Configuration | `SiteConfig_TEMPLATE.gs` | Per-site config object with 30+ keys covering school info, grades, features, branding, and layout |
| Module Loader | `modules/ModuleLoader.gs` | Feature-flag-driven dynamic menu builder |

### Optional Feature Modules (Activated via Feature Flags)

| Module | File | Feature Flag | Availability |
|---|---|---|---|
| Admin Import | `AdminImport_Unified.gs` | `adminImport` | Select sites |
| Mixed Grade Support | `MixedGradeSupport_Unified.gs` | `mixedGradeSupport` | Select sites |
| Coaching Dashboard | `modules/CoachingDashboard.gs` | `coachingDashboard` | Select sites |
| Tutoring System | `modules/TutoringSystem.gs` | `tutoringSystem` | Select sites |
| Grant Reporting | `modules/GrantReporting.gs` | `grantReporting` | Select sites |
| Growth Highlighter | `modules/GrowthHighlighter.gs` | `growthHighlighter` | Select sites |
| Unenrollment Automation | `modules/UnenrollmentAutomation.gs` | `unenrollmentAutomation` | Select sites (Monday.com integration) |

### Pre-K System

The Pre-K system is a **separate, standalone application** within the same codebase, isolated from the K–8 engine to allow independent evolution:

- `PreKMainCode.gs` — Full standalone engine (~94 KB)
- Dedicated UI files: `PreKDashboard.html`, `PreKIndex.html`, `PreKPortal.html`, `PreKTutorForm.html`, `PreKParentReport.html`, `PreKSetupWizard.html`
- Includes tutoring system, parent reports, and a portal UI
- Activated via the `preKOnlyMode` feature flag for sites that serve only Pre-K students

---

## 4. User Interface Architecture

- All UIs are delivered as **modal dialogs or sidebars** within Google Sheets; there is no standalone web application
- UI is rendered via Google Apps Script's `HtmlService` — HTML, CSS, and JavaScript are injected into the spreadsheet context at runtime
- **Server-side template parameterization**: UI files use `<?= ?>` tokens to inject branding (colors, logos, labels) from `SITE_CONFIG` at render time, eliminating the need for duplicate per-school UI files

### Key UI Components

| File | Purpose |
|---|---|
| `LessonEntryForm.html` | Primary data entry interface for lesson progress |
| `ManageStudentsUI.html` | Student enrollment and management dialog |
| `ManageGroupsUI.html` | Instructional group management |
| `GenerateReportsUI.html` | Report generation interface |
| `SetupWizardUI.html` | 9-step guided onboarding wizard |
| `GrowthHighlighterSidebar.html` | Visual growth analysis sidebar |

---

## 5. Data Architecture

### Storage Model

- **All data lives in Google Sheets** — there is no external database or persistent backend
- Each site workbook contains multiple sheets: grade-level group sheets, pacing sheets, a summary dashboard, a skills tracker, a configuration sheet, and report output sheets
- Student data is entirely **per-site and siloed** — there is no cross-site data store or shared database

### Data Flow

1. Teacher or coach enters lesson data via the Lesson Entry Form dialog
2. Apps Script recalculates student progress against UFLI benchmarks
3. Summary sheets and dashboards are updated in place
4. Reports (pacing, grant, parent) are generated on demand from the live sheet data

### Operational Constraints

- **No persistent API or backend** — all logic runs synchronously within Apps Script execution limits (6-minute maximum per execution)
- A **sync queue architecture** (`AdelanteSyncQueueProcessor.gs`) is used to handle long-running operations by batching them across multiple executions
- **Historical data import**: `AdminImport_Unified.gs` handles bulk import of prior-year student data across 28 functions, with formula injection protection and structured logging

---

## 6. Security & Quality Controls

- **Formula injection prevention**: The `AdminImport_Unified.gs` module sanitizes all imported cell values via `sanitizeCellValue()` — removes null bytes, validates field lengths, and prevents spreadsheet formula injection from user-supplied data
- **Structured logging**: Optional diagnostic logging via a `log(func, msg, lvl)` function in the import module (disabled by default; opt-in via feature flag)
- **CodeQL security scanning**: Used during development to validate the security posture of new and modified modules
- **Input validation**: `AdelanteNameValidator.gs` provides server-side name field validation
- **Version control**: All changes are tracked in GitHub with a pull request review process
- **AI-assisted code review**: GitHub Copilot coding agent performs automated code review on all PRs prior to merge

---

## 7. Integration Landscape

| Integration | Tool | Direction | Purpose |
|---|---|---|---|
| Unenrollment Workflow | Monday.com API | Outbound | Triggers offboarding workflow when a student is unenrolled |
| Curriculum Data | UFLI Framework | Embedded | 128-lesson sequence, 16 skill sections, and 23 gateway lessons hardcoded as shared constants |
| Version Control | GitHub | Bidirectional | Code management, PR reviews, and Copilot agent workflows |
| AI Development | GitHub Copilot | Inbound | Code generation, refactoring, and security scanning |

---

## 8. Current State Strengths

The following strengths reflect genuine architectural advantages of the system as currently built:

1. **Feature flag architecture** — Partner sites can enable or disable optional modules without requiring code changes or separate deployments. This supports meaningful site-level customization at low maintenance cost.

2. **Shared engine** — A single, unified calculation engine (`SharedEngine.gs`) eliminates version drift. A fix or improvement to core logic propagates to all sites in a single deployment.

3. **Parameterized configuration** — The `SITE_CONFIG` object provides 30+ configuration keys covering school information, grade ranges, feature toggles, branding, and layout. Sites are differentiated through configuration, not code forking.

4. **Active consolidation in progress** — Seven phases of consolidation work have been completed (Phases 1–7c merged), with an estimated 65–75% of previously duplicated code now unified into shared modules.

5. **Security controls in import layer** — The unified Admin Import module includes formula injection prevention and input sanitization on all imported data values.

6. **Mixed-grade instruction support** — The `MixedGradeSupport_Unified.gs` module provides runtime-configurable grade combinations spanning KG through Grade 8, including SC classroom and co-teaching configurations.

7. **Pre-K as a separate system** — The Pre-K application is fully isolated from the K–8 engine, enabling independent feature evolution without risk of regression to core K–8 logic.

8. **Monday.com automation** — The unenrollment automation module reduces manual offboarding burden by triggering structured workflows in Monday.com when students are unenrolled.

---

## 9. Current State Limitations & Technical Debt

The following limitations represent the primary gap between the current system and a scalable, future-state technology platform. This section is intended to give the reviewing vendor and funder an honest picture of the technical debt being managed.

1. **Google Sheets as a database** — There is no relational database. Student and progress data is fragmented across per-site workbooks with no cross-site aggregation capability. Sheets are not designed for concurrent writes or large-scale queries.

2. **No centralized reporting** — The system cannot produce org-wide aggregate views across all 6 partner sites without manual data consolidation from each workbook. There is no unified dashboard for the organization.

3. **No API layer** — All logic is tightly coupled to Google Sheets. The system cannot be called from or integrated with external platforms without significant re-architecture.

4. **Apps Script execution limits** — The 6-minute execution cap per run forces workarounds such as the sync queue processor. This constraint makes the platform unsuitable for larger-scale operations or more complex data pipelines.

5. **Manual deployment** — Code changes must be manually copied and applied to each site's Apps Script project. There is no CI/CD pipeline for automated or validated deployment across sites.

6. **Per-site data silos** — Student data is stored in separate workbooks per site. There is no cross-site student lookup, no longitudinal tracking across sites, and no ability to query students across the organization.

7. **School-specific legacy files still present** — Despite significant consolidation work, deprecated school-specific files remain in the codebase (marked with deprecation notices but not yet removed). These files represent latent maintenance risk and codebase clutter.

8. **No real-time collaboration** — Google Sheets supports concurrent access, but Apps Script dialogs do not support multi-user real-time data entry. Users may overwrite each other's work if operating simultaneously.

9. **No mobile interface** — The UI is optimized for desktop Google Sheets and is not accessible or functional on mobile devices.

10. **Limited automated testing** — There is no unit test framework. Functional validation is performed manually, supplemented by CodeQL security scanning. Regressions are possible when changes are made to shared modules.

---

## 10. Consolidation Roadmap (In-Progress)

The organization has been actively executing a **multi-phase consolidation project** to reduce technical debt and prepare the codebase for future migration to a more scalable platform. The following phases have been completed:

| Phase | Name | Status | Key Deliverable |
|---|---|---|---|
| Phase 1 | SharedConstants Extraction | ✅ Complete | 128 lesson labels and 16 skill sections centralized into a single shared constants file |
| Phase 2 | SharedEngine Consolidation | ✅ Complete | Core calculation logic unified; 875+ lines of duplicated logic eliminated |
| Phase 3 | Canonical Setup Wizard | ✅ Complete | Single parameterized setup wizard with 9-step UI replaces all site-specific wizard files |
| Phase 4 | Feature Module Extraction | ✅ Complete | 7 optional modules extracted to `modules/` directory with feature flag activation |
| Phase 5 | UI Unification | ✅ Complete | Server-side template parameterization implemented; per-school UI files eliminated |
| Phase 6 | Backport & Bug Sync | ✅ Complete | All 6 sites validated against SharedConstants; 89 lesson label references verified |
| Phase 7a | Logic File Audit | ✅ Complete | 17 school-specific logic files audited; 65–75% consolidation opportunity identified |
| Phase 7b | AdminImport Consolidation | ✅ Complete | Unified 28-function import module with security layer and structured logging |
| Phase 7c | MixedGradeSupport Consolidation | ✅ Complete | Unified 49-function module with runtime configuration for grade combinations |

Remaining work includes removal of deprecated school-specific files, completion of any outstanding consolidation phases, and preparation of the codebase for potential migration to a future-state platform.

---

## 11. Technology Summary Table

| Category | Current Tool | Version / Notes | Risk Level |
|---|---|---|---|
| Primary Data Store | Google Sheets | Google Workspace | Medium-High |
| Scripting Runtime | Google Apps Script | V8 runtime (JavaScript ES2019+) | Medium |
| UI Framework | HTML/CSS/JS via HtmlService | No external framework | Low-Medium |
| Version Control | GitHub | Public repository | Low |
| AI Development Tools | GitHub Copilot | Coding agent + chat | Low |
| External Integrations | Monday.com | REST API | Low |
| Deployment Model | Manual per-site | No CI/CD pipeline | High |
| Database | None (Google Sheets only) | No RDBMS or NoSQL | High |
| Authentication | Google OAuth (via Workspace) | SSO via Google | Low |
| Mobile Access | None | Desktop only | High |
| Cross-site Reporting | None | Manual consolidation only | High |
| Automated Testing | None (CodeQL only) | No unit test framework | Medium-High |

---

## Glossary

**UFLI (University of Florida Literacy Initiative)**
A research-based structured literacy curriculum developed at the University of Florida. The curriculum consists of 128 sequential phonics lessons organized into skill sections, with embedded review and gateway lessons used as pacing benchmarks.

**Google Apps Script (GAS)**
A JavaScript-based cloud scripting platform provided by Google. It runs server-side within Google Workspace and enables automation, custom logic, and UI generation inside Google Sheets, Docs, and other Google applications.

**HtmlService**
A Google Apps Script service that allows developers to render HTML, CSS, and JavaScript as modal dialogs or sidebars within a Google Sheets workbook. It is the mechanism used to deliver all user interface components in this system.

**Feature Flag**
A configuration setting within `SITE_CONFIG` that toggles an optional module on or off for a given site. Feature flags allow the same codebase to behave differently across sites without requiring separate code branches or deployments.

**SITE_CONFIG**
A JavaScript configuration object defined in `SiteConfig_TEMPLATE.gs` for each partner site. It contains 30+ keys covering school metadata, grade range settings, feature flag toggles, branding parameters, and layout preferences. It is the primary mechanism for site-level customization.

**SharedEngine**
The unified core calculation module (`SharedEngine.gs`) that contains all shared business logic: benchmark calculations, section percentage calculations, gateway lesson logic, grade-level metrics, and utility functions. All sites use the same SharedEngine, ensuring consistent calculation behavior across the organization.

**Mixed Grade Support**
A feature module (`MixedGradeSupport_Unified.gs`) that enables instructional groups spanning multiple grade levels. It is configurable at runtime to support combinations across KG through Grade 8, as well as SC (self-contained) classroom configurations and co-teaching models.
