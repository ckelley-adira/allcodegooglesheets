# Current State Inventory

A high-level catalog of the Apps Script systems Christina has built. The new platform is replacing all of these. This document tells you **what exists**, **what it does**, and **whether the logic ports forward or retires**.

> **Note:** This is not exhaustive. Christina has built dozens of scripts over five years. This covers the systems most likely to come up when porting features. When you encounter a script not listed here, ask Christina what it does.

---

## How the current system is structured

Each school site is a **separate Google Sheets workbook**. Each workbook has its own copy of the Apps Script code, configured for that school. This means **any system-wide change requires N deployments** (one per school), which is the operational pain point the new platform is fixing.

There are also some cross-school workbooks (e.g., the cross-school dashboard, the Master Fidelity Dashboard, the TRAIN system) that aggregate data from the per-school workbooks.

---

## Core data sources (current state)

| Sheet / System | What it is | Ports to |
|---|---|---|
| **UFLI MAP** | The single source of truth for where each student is in the 128-lesson curriculum. One per school workbook. | `Student`, `Group`, `Group_Membership`, `Session_Lesson_Outcome` entities |
| **Tutor Input Form** | Google Form that interventionists fill out after each session. Responses land in `Form Responses N` tabs. | `Session` entity + mobile-first session capture UI |
| **Group Configuration sheet** | Defines groups, current lessons, schedules, group leader assignments. | `Group`, `Group_Schedule`, `Staff` |
| **Assessment data** | UFLI Initial Assessment results. Currently mixed across multiple sources. | `Assessment`, `Assessment_Result` |
| **Sound Inventory** (CHAW only) | K-1 sound mastery tracking. | `Sound_Inventory_Record` (or feature-flagged module) |
| **Fry Word Tracker** (CHAW only) | Group-level Fry sight word scoring. | `Fry_Word_Record` (or feature-flagged module) |

---

## Tracking & analytics scripts

| Script | What it does | Ports as |
|---|---|---|
| **Progress Engine** (Phase 2) | Calculates lessons taken vs. passed; drives pacing and regrouping logic. | Backend service computing metrics from `Session_Lesson_Outcome` |
| **Skills Tracker** | Per-skill mastery tracking. | Computed view over assessment results |
| **Grade Summary** | Per-grade aggregations including AG% (Actual Growth). | Reporting layer view |
| **Pacing Dashboard** | Group-level pacing vs. expected slope. | Friday Dashboard panel |
| **School Summary dashboard** | School-level rollup. | Reporting layer view |
| **Master Fidelity Dashboard v3.1** | Correlates coaching observation fidelity with student outcomes. Uses Levenshtein fuzzy matching across schools. Composite scoring across 8 metrics. | Reporting layer + `Fidelity_Score` entity |

---

## Coaching & communication scripts

| Script | What it does | Ports as |
|---|---|---|
| **CoachingEmail.gs** | Generates Gmail draft coaching emails per school site. School-specific config, week-over-week growth deltas, fuzzy group name resolution, nested Gmail label organization. | Monday Digest service in the new platform |
| **Outstanding Questions email system** | Surfaces students needing assessments, students needing groups, upcoming group leader changes. Bubbled into the cross-school dashboard. | Friday Dashboard "needs attention" panel |
| **Weekly Coaching Dashboard** (portable) | Per-school weekly view for coaches. | Friday Dashboard |
| **Student History module** (portable) | Per-student trajectory view. | Student detail page |
| **Monday Digest** | Weekly AI-authored coaching email. Sent Monday morning. Uses the diagnostic framework. | First-class AI Engine output, see `data-model.md` |

---

## Workflow automation scripts

| Script | What it does | Ports as |
|---|---|---|
| **Setup Wizard v3.x** | School onboarding workflow. Currently Apps Script. | **Self-service school onboarding flow in the new platform** — this is the key scale enabler |
| **Regrouping & Resequencing Workflow** | Automation that handles UFLI lesson reordering when groups regroup. | Backend workflow + `AI Regrouping Advisor` recommendations |
| **Student unenrollment workflow** | Includes Monday.com integration and StudentRestoration.gs (rollback). | `Student` lifecycle + audit log |
| **Admin import utility** | Consolidates Monday.com assessment boards. | Migration tooling only — Monday.com may or may not stay in the loop |
| **PhoneHome.gs** | Snapshot system that writes school-level data back to a central location. | Replaced by native multi-tenant DB — no longer needed |
| **MasterDashboard.gs** | Cross-school aggregation. | Replaced by native cross-tenant queries (TILT Admin role) |

---

## CHAW-specific scripts (K-1)

| Script | What it does | Ports as |
|---|---|---|
| **SoundTracker.gs** (v2.1) | Core data loading, group focus sound logic, submission to Sound Inventory, weekly/daily digest emails. Tracks 29 KG sounds and 40 G1 sounds. Group-level focus sound selection with "taught gate" (sounds gated to lessons ≤ group's current lesson). | Feature-flagged Sound Inventory module |
| **SetupSoundInventory.gs** | Tab setup, UFLI MAP → Sound Inventory sync, refresh/rebuild for group summaries. Has a destructive `setupSoundInventoryTabs()` function that calls `ss.deleteSheet(existing)` — careful. | Replaced by native DB schema |
| **SoundTrackerForm.html** | Sidebar UI with interactive grid, student scoring table, fallback mode. | Replaced by native UI |
| **FryTrackerCode.gs + WebApp.html** | Built from scratch. Group-level Fry scoring, weekly data meeting emails, HTML-formatted summaries. | Feature-flagged Fry Word module |

---

## Reporting & document generation scripts

| Script | What it does | Ports as |
|---|---|---|
| **ClipboardSheetGenerator** | Weekly printable one-pagers for teachers combining Sound Inventory and Fry Word data. Uses fuzzy name matching across naming format variations. | PDF export from the reporting layer |
| **Parent Conference Tools** (CCA) | HTML report generator + reusable `ConferenceReportData.gs`. | CCA-specific feature, port to reporting layer |
| **IEP language generator** | Generates Specially Designed Instruction language from Adira Reads data. | Reporting layer feature |
| **DemographicsDisaggregation.gs** (CHAW) | Demographic disaggregation for the CHAW assessment data. | Reporting layer view |

---

## Internal TILT systems (not school-facing)

| Script | What it does | Ports as |
|---|---|---|
| **TRAIN** (Tracker for Requests, Actions & Issues Notes) | Two-tab Google Sheets architecture, modal forms, automated email notifications, custom menu. Used by Christina and Susan to track change requests and school notes. | Lives outside the platform — keep as a separate internal tool, OR build a simple change-request module if you want it integrated. **Open question.** |
| **TILT Tutoring Tracking System** | Internal tutor session tracking. | Possibly subsumed by the new Session entity, or kept separate |
| **Testing framework infrastructure** | Test harness for the Apps Script systems. | Replaced by proper test infrastructure in the new stack |
| **Monday.com board export utility** | Exports Monday.com board data. | Migration tooling only |

---

## What's already a "future state" artifact

| Artifact | Where it lives |
|---|---|
| **Adira Reads Future State Data Model v1** | The .docx Christina and Claude built together — included as `docs/source/future-state-data-model-v1.docx`. The canonical spec for the new platform. |
| **Adira Reads SaaS data model** | 18 entities, PostgreSQL RLS, AI regrouping engine — fully detailed in the .docx |
| **Six-layer architecture diagram** | In the .docx Section 1 |
| **Mapt Solutions Phase 1/2 deliverables + TILT response** | Outside this repo — Christina has these. Includes the 51-item build plan, capacity model, three-year grant budget. Reference if Claude Code asks "what's the phasing?" |

---

## What to retire entirely (do not port)

| Thing | Why |
|---|---|
| **PhoneHome.gs** | Multi-tenant DB makes snapshot-back patterns unnecessary |
| **Sheet ID hardcoding** | School identity becomes UUIDs in the database |
| **Per-school code deployment** | One deployment, all tenants |
| **Form Responses N tab juggling** | Native session capture replaces this |
| **Token-similarity tier in fuzzy matching** | Produces false positives — explicitly removed in the latest version |
| **Apps Script triggers** | Replaced with proper job scheduling (cron, queues) |

---

## Sequencing — what to build first

This is **not yet decided**. The Mapt Solutions 51-item build plan exists; the actual sequencing for the new platform will be a separate planning conversation. **Do not assume an order.** Ask Christina before starting on any specific feature.
