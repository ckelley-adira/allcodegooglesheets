# Adira Reads Progress Report — Redesign Plan

**Christel House Academy West · "School Lesson Tracking System" · Prepared for Christina Kelley · March 2026**

---

## Table of Contents

1. [Current-State Audit](#1-current-state-audit)
2. [Apps Script Architecture](#2-apps-script-architecture)
3. [What's Working Well](#3-whats-working-well)
4. [Pain Points & Risks](#4-pain-points--risks)
5. [CKLA vs. Adira Comparison](#5-ckla-tracker-vs-adira-reads-side-by-side)
6. [Reporting & Dashboard Gaps](#6-reporting--dashboard-gaps)
7. [Phased Redesign Roadmap](#7-phased-redesign-roadmap)
8. [Platform Decision](#8-platform-decision-where-should-this-go)
9. [Recommended Next Steps](#9-recommended-next-steps)

---

## 1. Current-State Audit

This is the **"Adira Reads Progress Report"** — a Google Sheets + Apps Script application that tracks UFLI (University of Florida Literacy Institute) lesson progress across all grades KG–G8 at Christel House Academy West. It is fundamentally different from the CKLA tracker: this one is already a functioning application with a real script backend, not just a spreadsheet.

| Metric | Value |
|--------|-------|
| Tabs in the workbook | **59** |
| Students tracked | **405** |
| Grade levels | **9** (KG–G8) |
| UFLI lessons per student | **128** |
| Apps Script files | **20+** |
| Current script version | **v5.2** |

### Tab Architecture

| Tab Category | Count | Examples | Purpose |
|-------------|-------|---------|---------|
| **Dashboards & Reports** | 5 | School Summary, Grade Summary, Band Movement Analysis, Friday Dashboard, Pacing Dashboard | Executive-level views — growth metrics, student distributions, pacing compliance, coaching priorities |
| **Group Sheets** | ~24 | KG Groups, G1 Groups, G3 Groups IS6, etc. | Per-grade instructional group views showing lesson assignments, Y/N/A color-coded status per student |
| **AIS (Assessment) Sheets** | ~10 | KG AIS4, G1 AIS4, G5 AIS3, G8 AIS3 | Assessment Instructional Sequence tracking (different versions by grade band) |
| **Master Tracking** | 4 | UFLI Map, Skills Tracker, Small Group Progress, Tutoring Progress Log | Core data stores — 128-lesson student maps, skills percentages, raw progress logs |
| **Tutoring** | 2 | Tutoring Progress Log, Tutoring Summary | Separate dual-track system for intervention vs. whole-group instruction |
| **Configuration & Admin** | ~10 | Site Configuration, Student Roster, Teacher Roster, Group Configuration, Feature Settings | System setup — school info, rosters, group assignments, feature toggles |
| **Backend / Plumbing** | ~7 | Import Staging, Import Exceptions, Sync Queue, Archive Data, Miss Match Students | Data pipeline — staging, validation, exception handling, archival |
| **Sound Tracking** | 2 | Sound Inventory - K, Sound Inventory - 1 | Sound/phonics inventory tracking for early grades |

---

## 2. Apps Script Architecture

The system is named **"School Lesson Tracking System"** and is structured as a two-phase architecture: Phase 1 (SetupWizard) handles configuration, student/group management, reports generation, and the web app interface. Phase 2 (ProgressTracking) handles system sheets, progress tracking, sync, and the pacing engine. Both are at mature versions (v3.2 and v5.2 respectively).

### Script Files

| File | Description |
|------|-------------|
| `Setupwizard.gs` (v3.2) | Phase 1: Config constants, menu, wizard, manage UI, reports, web app. Owns site configuration, student/group management. |
| `Phase2_ProgressTracking.gs` (v5.2) | Phase 2: Sheet generation, progress tracking, sync, pacing engine. "Big Gulp" batch pattern for ~90% speed improvement. |
| `AdminImport_v1.gs` (v3.0) | Historical data import with validation & exception reporting. Imports initial assessments and lesson progress data. |
| `TutoringSystem.gs` (v1.1) | Dual-track progress: whole-group UFLI vs. tutoring interventions. Separate logs and summary metrics per student. |
| `FridayCoachingDashboard.gs` (v2.2) | "Big Four" UFLI/MTSS coaching metrics: reteach frequency, pass rate, growth slope, absenteeism. Monday digest email. |
| `bandmovementanalysis.gs` | Compares initial vs. current benchmark bands. Generates movement matrix and grade-level breakdowns. |
| `SyncQueueProcessor.gs` | Queued sync system for updating sheets without hitting Sheets API performance limits. |
| `StudentHistory.gs` | Weekly growth tracking + lesson stats by skill section. Paired columns per week (% growth + taken/passed ratio). |
| `MissingStudents.gs` | Reconciliation: finds students in rosters who aren't appearing in group sheets or vice versa. |
| `UnenrollmentAutomation.gs` | Handles student withdrawals/transfers — archives data and cleans group sheets. |
| `MixedGradeSupport_En.gs` | Handles multi-grade instructional groups (students from different grades in one group). |
| `GroupCoach.gs` | Coaching-focused group analysis and recommendations. |
| `studentrecon.gs` | Student data reconciliation utilities. |
| `IER.gs` | Intervention / Exception Reporting module. |
| `SoundTracker.gs` + `SetupSoundInventory.gs` | Sound/phonics inventory tracking system for KG and G1. |
| `Utilities.gs` | Shared utility functions across all modules. |

### HTML UI Files

The system includes 6 HTML files that power custom sidebar/dialog UIs within Google Sheets: `LessonEntryForm.html`, `GenerateReportsUI.html`, `ManageGroupsUI.html`, `ManageStudentsUI.html`, `SetupWizardUI.html`, and `SoundTrackerForm.html`. This means data entry happens through custom forms, not raw cell editing — a major step up from the CKLA tracker.

> **Key architectural win:** The system uses a "Big Gulp" pattern (Batch Read → In-Memory Calc → Batch Write) that eliminated volatile spreadsheet formulas and improved sync speed by ~90%. Skills and Grade Summary percentages are calculated in script and written as static text, not live formulas. This is the right approach for a system at this scale.

---

## 3. What's Working Well

Before diving into problems, this system deserves credit for what it gets right — and there's a lot:

### ✅ Custom Form-Based Data Entry

Unlike the CKLA tracker where teachers hand-key 0s and 1s into a grid, this system has a `LessonEntryForm.html` and is linked to a Google Form ("Christel House Academy West Lesson Check Form"). Teachers enter data through structured forms, not raw cells. This eliminates wrong-column and wrong-row errors.

### ✅ Real Dashboard Architecture

The School Summary dashboard is clean: growth metrics (Initial → Current → Growth) per grade, student distribution in three bands (On Track 80%+, Progressing 50–79%, Needs Support <50%) with color coding. The Band Movement Analysis is genuinely sophisticated — a movement matrix showing how students shifted between bands, with per-grade breakdowns and individual student detail.

### ✅ Script-Driven Calculations

Moving from volatile INDIRECT/COUNTIF/MAXIFS formulas to script-calculated static values was the right call. The v5.0 changelog explicitly notes this improved performance by ~90%. The system won't slow to a crawl as data grows.

### ✅ Exception Handling & Data Validation

The Import Exceptions, Miss Match Students, and student reconciliation scripts show a system that doesn't just ingest data — it validates and reports problems. The Exception Log tab exists specifically for surfacing data quality issues. This is rare in spreadsheet-based systems.

### ✅ Multi-Track Instruction Support

The TutoringSystem.gs handles the real-world complexity that students receive BOTH whole-group UFLI lessons AND smaller tutoring interventions (reteach, comprehension, etc.). The dual-track architecture keeps these separate so one doesn't overwrite the other — a thoughtful design decision.

### ✅ Setup Wizard & Automated Configuration

The system has a proper setup wizard (SetupWizardUI.html) that handles site configuration, student rostering, group creation, and sheet generation. This makes it deployable across different schools without manual tab-by-tab setup.

---

## 4. Pain Points & Risks

### 🔴 59 Tabs Is Still Overwhelming

Even with the script backend doing the heavy lifting, end users are still navigating a 59-tab workbook. Many tabs are hidden (Site Configuration, Feature Settings, etc.), but the visible tab bar still includes ~30+ tabs. For a literacy coach who just needs to see their grade's groups and the school summary, this is a lot of noise.

### 🔴 Apps Script Execution Limits

Google Apps Script has hard limits: 6-minute execution time, 30-minute daily triggers, limited API calls per day. With 405 students across 9 grades and 128 UFLI lessons each, the "Big Gulp" batch pattern is already working around these constraints. As the system scales to more schools, these limits will become blocking. The SyncQueueProcessor exists specifically because sync operations were hitting these walls.

### 🔴 Single-File Monolith

Everything — data, configuration, reporting, and the application itself — lives in one Google Sheets file. If the file corrupts, gets too large, or someone accidentally edits a backend tab, the entire system is at risk. There's no separation between the application layer and the data layer.

### 🟡 Maintenance Complexity

The Apps Script codebase spans 20+ files across multiple versions (v1.1, v2.2, v3.0, v3.2, v5.2). The architecture split between SetupWizard (Phase 1) and ProgressTracking (Phase 2) with shared constants means changes in one file can break the other. Only someone who deeply understands the full system can safely make changes. Bus factor: 1.

### 🟡 Group Sheet Proliferation

Each grade has 2–3 group sheets (Groups, Groups IS5/IS6), and some grades have AIS sheets too. That's ~24 group-related tabs generated by script. Each time groups are reconfigured, these sheets need to be regenerated or updated. The system handles this through automation, but debugging group assignment issues across 24 tabs is painful.

### 🟡 No Visual Charts or Graphs

Despite the rich data (growth metrics, band movement, pacing percentages), there are no actual charts in the spreadsheet. The School Summary uses color-coded text and numbers. The Band Movement Analysis is a table with highlighted cells. The Pacing Dashboard is a flat data grid. All of this data is begging for visualization — trend lines, bar charts, sparklines — and getting none.

### 🟡 Hidden Tabs Contain Critical Functionality

Tabs like Site Configuration, Feature Settings, Student Roster, and Group Configuration are hidden from normal view but contain system-critical data. If a user with edit access unhides and modifies one of these, the system could break silently. Sheet protection helps but isn't foolproof.

---

## 5. CKLA Tracker vs. Adira Reads: Side-by-Side

These two systems tackle similar problems (tracking literacy skill progression) but are at dramatically different maturity levels:

| Dimension | CKLA Skills Tracker | Adira Reads Progress Report |
|-----------|--------------------|-----------------------------|
| **Architecture** | Pure spreadsheet — formulas only, no scripting. Teachers manually enter 0/1 scores into grid cells. | Google Sheets + 20-file Apps Script application. Form-based entry, script-calculated metrics. |
| **Data entry** | 542 columns of manual input for Kinder alone. No forms, no validation on scores. | Google Form + custom HTML forms. Teachers don't touch raw data cells. |
| **Reporting** | 4 basic bar charts. Percentage tables. No growth tracking. | 5 dashboard tabs with growth metrics, band movement, pacing, coaching priorities. No charts though. |
| **Scale** | 1 school, 3 grades, 105 students (only K populated). | 1 school, 9 grades, 405 students, 128 lessons per student. |
| **Maintenance** | Low tech debt but extremely labor-intensive to use. | High tech debt but automated workflows reduce manual effort. |

> **Key insight:** The CKLA tracker needs to be rebuilt from scratch — it's a spreadsheet pretending to be an app. The Adira system IS an app, already doing most things right; it needs to be *migrated to a better platform* and refined, not fundamentally redesigned. The problems here are about scale and sustainability, not about the core design being wrong.

---

## 6. Reporting & Dashboard Gaps

### Gap 1: No Visual Charts Anywhere

The School Summary shows "4% → 38% = +34% Growth" as text. Imagine that as a bar chart with an arrow. The Band Movement Analysis has a movement matrix table — imagine that as a Sankey diagram or alluvial flow showing students moving between bands. The Pacing Dashboard has pass rates per group — imagine that as a heatmap. The data quality is excellent; the presentation is pure text and tables.

### Gap 2: No Individual Student View

The Grade Summary shows per-student skill percentages, but there's no single-student deep-dive report that a parent conference or IEP meeting could use. Something like: "Rosalia's Journey: Lesson progress, skill mastery by section, growth trend, benchmark status, and comparison to grade peers" — all on one page.

### Gap 3: Friday Dashboard Is Hidden

The FridayCoachingDashboard.gs is one of the most sophisticated scripts in the system — it computes reteach frequency (the "Sticky Factor"), group pass rates, student growth vs. expected slope, and chronic absenteeism, plus a "Coaching Priority Matrix" that cross-references all four. But the Friday Dashboard tab isn't visible in the default tab bar. This coaching gold mine is buried.

### Gap 4: No Trend-Over-Time Views

StudentHistory.gs captures weekly growth snapshots with paired columns (% growth + taken/passed ratio), but this data isn't surfaced in any visible dashboard. A time-series chart showing weekly progression per group or per student would make growth patterns visible at a glance.

### Gap 5: Monday Digest Email Exists But Isn't Leveraged

The FridayCoachingDashboard includes a `sendMondayDigestPreview()` function and a Sunday trigger setup. This is a push-notification reporting system — exactly what busy coaches need. But it's unclear if this is actively running or how broadly it's used. This should be a flagship feature.

---

## 7. Phased Redesign Roadmap

### Phase 1: Quick Wins — Polish What Exists (1–2 weeks)

- Unhide the Friday Dashboard and make it a default landing tab — it's the most valuable coaching tool in the system
- Add SPARKLINE formulas or mini-charts to the School Summary and Grade Summary tabs
- Add conditional formatting heatmaps to the Pacing Dashboard (green/yellow/red on pass rates and pacing %)
- Color-code the visible tabs by function (blue = dashboards, green = group sheets, gray = backend) so users can orient quickly
- Verify the Monday Digest email trigger is active — if not, set it up and test it with coaches
- Build a "Navigation Hub" as the first visible tab: buttons/links to jump to each major section with one-line descriptions

### Phase 2: Visualization Layer (2–4 weeks)

- Add embedded charts to School Summary: grouped bar chart of On Track / Progressing / Needs Support per grade
- Build a trend-over-time chart using StudentHistory data — show weekly growth trajectories per group
- Create an individual student report template: dropdown → auto-populated one-pager with lesson map, skills breakdown, benchmark status
- Add a Sankey or flow diagram visualization to Band Movement Analysis (may need Looker Studio for this)
- Surface the Coaching Priority Matrix from FridayCoachingDashboard as a visible, formatted report tab
- Add sparklines to Grade Summary rows so each student row shows a visual trajectory

### Phase 3: Architecture Hardening (4–6 weeks)

- Separate data storage from the application: move raw data (UFLI Map, Small Group Progress, logs) to a dedicated backend spreadsheet, keep the display/reporting in the front-end sheet
- Add comprehensive error logging to all script modules — currently debugging requires reading the Apps Script execution log
- Build automated backup: nightly script that copies critical data sheets to a backup spreadsheet
- Create a system health dashboard tab: last sync time, pending queue items, exception count, data freshness per grade
- Document the full script architecture — function maps, data flows, dependency graph — so maintenance isn't limited to one person
- Add version tracking/changelog visible within the spreadsheet itself (not just in script comments)

### Phase 4: Platform Migration (2–3 months)

- Migrate to Google AppSheet: convert forms to native AppSheet views, replace group sheets with filtered views, build real dashboards with built-in charting
- OR: Build a dedicated Looker Studio dashboard suite connected to the Sheets data, keeping Sheets as the backend but removing the need for in-sheet reporting tabs
- OR: Build a lightweight web app (Apps Script Web App or external) that provides the teacher-facing experience while Sheets remains the admin/data layer
- Multi-school deployment: parameterize the system so a new school can be spun up from a template with the setup wizard
- Evaluate whether the SyncQueue/batch approach is sustainable at 5+ schools or if a real database (Firebase, Supabase) is needed

---

## 8. Platform Decision: Where Should This Go?

| Option | Strengths | Weaknesses | Verdict |
|--------|-----------|------------|---------|
| **Stay in Google Sheets + Apps Script** | Already built. Teachers know it. Free. Forms work. Scripts handle complexity. | 59 tabs. 6-min script limits. Single-file risk. No real charts. Won't scale past 2–3 schools. | Fine for 1 school. Will break at scale. |
| **Google AppSheet** | Real app UI. Mobile-friendly. Built-in dashboards. Keeps Sheets as backend. Role-based access. | Complex data model to migrate. AppSheet has formula limitations. Per-user licensing. | **Best near-term option** if staying in Google ecosystem. |
| **Looker Studio + Sheets** | Amazing dashboards. Free. Connects directly to Sheets. Filterable, interactive, shareable. | Read-only — doesn't solve data entry. Would need to pair with Forms/AppSheet for input. | Great complement but doesn't replace the app layer. |
| **Custom Web App** | Purpose-built. Best UX. Real database. Scales infinitely. Multi-school native. | Highest cost. Requires developer. 3–6 month build. Ongoing hosting/maintenance. | Right answer if deploying to 5+ schools. |

> **The honest assessment:** This system is impressive for what it is — a real application built on spreadsheet infrastructure. But it's outgrowing Google Sheets. The 59-tab, single-file, script-limited architecture worked to prove the concept. The next step is migrating to infrastructure that can sustain it. The question isn't whether to migrate, but when and to what.

---

## 9. Recommended Next Steps

### Immediate: Surface the Friday Dashboard

This is the single highest-impact change with the lowest effort. The coaching metrics (reteach frequency, pass rates, growth slope, absenteeism) are already computed by script. They just need to be visible. Unhide the tab, format it for readability, and make it the first thing coaches see on Monday morning.

### This Month: Add Charts to School Summary

The School Summary currently shows "4 students (7%)" in green text for "On Track." A stacked bar chart per grade showing the three bands would make this dashboard 10x more impactful. This can be done in the existing spreadsheet with Google Sheets' native charts — no script changes needed.

### This Quarter: Build a Looker Studio Companion Dashboard

Keep the Sheets system as the data engine, but connect a Looker Studio dashboard for the reporting/visualization layer. This gives you interactive, filterable, shareable dashboards without touching the script architecture. Test it with one stakeholder group (e.g., school leadership) before rolling out broadly.

### This Year: Start the AppSheet Migration

Begin converting the teacher-facing experience (lesson entry, group views, student lookup) to AppSheet. Keep the Sheets backend and Apps Script engine intact during transition. This gives you a mobile-friendly app layer on top of the existing data without a full rebuild.

### Before Scaling: Document the System

This system has zero external documentation. The script comments are good, but there's no architecture diagram, no data flow map, no deployment guide. Before deploying to a second school, invest in documentation so you're not the single point of failure.

---

> **Bottom line:** This is not a spreadsheet problem — it's a scaling problem. The Adira Reads system is a legitimate application that happens to be hosted in a spreadsheet. The core design is strong: form-based entry, script-calculated metrics, dual-track instruction support, coaching dashboards. The redesign isn't about fixing what's broken; it's about moving what works onto infrastructure that can grow with it. The data model is solid. The reporting concepts are right. It just needs a bigger house.
