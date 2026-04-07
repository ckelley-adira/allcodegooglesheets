# Data Model — Adira Reads Future State

> **Canonical source:** `docs/source/future-state-data-model-v1.docx` (the Word document Christina and Claude built together, ~50 pages, exhaustive). This markdown file is a **navigational summary** — when working on data model details, open the .docx for full attribute-level specifications, constraints, and rationale.

---

## Why this document exists

The .docx was built explicitly so that "every design decision recorded here is one that does not need to be relitigated in a review meeting." If something is in the .docx, treat it as decided. If something is **not** in the .docx, it is an open question — surface it, do not assume.

---

## Architecture in one screen

The platform is organized into **six capability layers**, each building on the one below:

| Layer | Name | What it does |
|---|---|---|
| **L1** | User & Role Layer | Defines who can see what. Five roles: Tutor, Coach, School Admin, TILT Admin, Parent (future). Every UI view and every API endpoint is gated by role. |
| **L2** | Multi-Tenant Security | Enforces school-level data isolation at the database layer using PostgreSQL Row Level Security. This is the security guarantee that makes multi-tenancy safe. |
| **L3** | Application Modules | Session capture (mobile-first tutor UI), progress tracking (UFLI, sounds, Fry words), and assessment (digital scoring, OCR input). The day-to-day operational surface. |
| **L4** | AI Engine | Three AI capabilities: regrouping advisor, early warning system, coaching intelligence. All recommendations are explainable and human-overridable. |
| **L5** | Reporting Layer | Four output formats: weekly operational (Friday Dashboard + Monday Digest), monthly leadership, semester funder, system diagnostic. On-demand builder for ad hoc queries. |
| **L6** | Audit & Compliance | Append-only log of every data-modifying action. Cannot be updated or deleted through any interface. |

## The 18 entities (high-level)

The .docx specifies 18 entities with full attribute definitions, types, constraints, FK relationships, and prose descriptions. They cluster as follows:

**Tenancy & identity**
- `School` (the tenant boundary)
- `Staff` (users — tutors, coaches, admins)
- `Role` / `Role_Permission` (RBAC)

**Student & grouping**
- `Student`
- `Group` (instructional groups, with current lesson, color/identifier)
- `Group_Membership` (historical — students move between groups)
- `Group_Schedule`

**Curriculum & instruction**
- `UFLI_Lesson` (the 128-lesson reference table — includes diagnostic framework columns: deficit type, reading error, spelling error, instructional response)
- `Session` (a recorded tutoring session)
- `Session_Lesson_Outcome` (what happened with which lessons in that session)

**Assessment**
- `Assessment` (UFLI Initial Assessment, 10-skill screener, etc.)
- `Assessment_Result` (per-student, per-skill outcomes)
- `Sound_Inventory_Record` (CHAW K-1 specific)
- `Fry_Word_Record` (group-level Fry scoring)

**Observation & fidelity**
- `Observation` (coach observations of tutors)
- `Fidelity_Score` (composite, by category)

**System**
- `Report` (generated reports, with retention)
- `Audit_Log` (append-only, immutable)

**For full attribute-level specs, open the .docx.**

## Security model (the non-negotiable part)

Three enforcement layers, defense in depth:

1. **PostgreSQL Row Level Security** — every query against any table with a `school_id` column is automatically filtered by the current session's school claim. The database itself enforces this. Application bugs cannot leak data across schools because the database will not return cross-school rows.
2. **JWT school claim** — every authenticated request carries the user's school_id in a signed JWT. The API middleware sets this as a session variable that RLS policies read.
3. **API middleware authorization** — additional role-based checks at the endpoint level. RLS handles "can this user see this row at all"; the API layer handles "can this role perform this action."

**TILT Admin** is the only role that can cross school boundaries. This is implemented via a separate `is_tilt_admin` claim, not by disabling RLS.

The `Audit_Log` table is **append-only** at the database level — no UPDATE or DELETE permissions are granted to the application user. Compliance, debugging, and accountability all depend on this.

## Key analytical structures (preserved from current state)

These are the domain frameworks that must carry forward exactly. They are detailed in the .docx and in `docs/ufli-domain.md`.

### Big Four metrics (Friday Dashboard)
The four canonical metrics. Definitions are used in funder communications and must not drift.

1. **Foundational Skills %** — L1–L34 mastery, denominator 34
2. **Minimum Grade Skills %** — MTSS metric, cumulative through end of grade (KG=34, G1=57, G2=67, G3+=107)
3. **Current Year Goal Progress** — this year's curriculum only, excluding review lessons (G1=23, G2=18, G3+=107)
4. **Student Growth vs. Expected Slope (4-Week Rolling)** — note the absence-handling logic (Metric C in the legacy code; absence = 'A' values are excluded from the slope, not zeroed)

### Banding archetypes
**Five student archetypes** derived from the 1,007-student UFLI Initial Assessment dataset (Feb 2026). The banding logic groups students by trajectory pattern, not by current performance alone.

### Cliff alerts
**Five canonical transitions** in the UFLI sequence where students historically drop off. Each has an empirically derived hazard rate. The Friday Dashboard surfaces students approaching these cliffs.

### Conditional probability chains
A prerequisite-chain analysis: given a student's current mastery state, what's the probability of mastering the next N lessons? Used for IREAD-3 prediction and bubble-student identification.

### Diagnostic framework (in UFLI_Lesson reference table)
Four-column structure embedded in the lesson reference data:
- **Deficit type** (what underlying skill is the gap)
- **Reading error** (how it manifests in reading)
- **Spelling error** (how it manifests in spelling)
- **Instructional response** (what to teach next)

The Monday Digest uses this to generate coaching recommendations.

## AI Engine — what it does and what it doesn't

**Three capabilities:**
1. **Regrouping advisor** — surfaces recommended group changes based on lesson velocity, mastery patterns, and group cohesion. **Does not auto-regroup.**
2. **Early warning system** — flags students approaching cliffs or showing early disengagement signals. **Does not auto-escalate to MTSS tiers.**
3. **Coaching intelligence** — generates the Monday Digest recommendations using the diagnostic framework. **Does not send unreviewed.**

**Hard constraints:**
- Every recommendation must be explainable (show the evidence the recommendation is based on).
- Every recommendation must be overridable by a human, and the override is logged in the audit log (`AI_RECOMMENDATION_OVERRIDDEN` action type).
- The AI engine never modifies student records directly. It writes to a `recommendation` queue that humans process.

## Open questions (validate with Christina before assuming)

The .docx includes 20+ explicit open questions in Section 9. Highlights:

- Tech stack (see `decisions.md` — not yet locked)
- Exact onboarding self-service flow scope for the Setup Wizard port
- Parent role timing (post-MVP)
- AI provider choice for the Coaching Intelligence module
- Whether Sound Inventory and Fry Word tracking become full first-class entities or remain CHAW-specific extensions
- Retention policies for `Report` and `Audit_Log`
- Backup and disaster recovery cadence
- IREAD-3 prediction model: ported as-is, retrained, or rebuilt

**Always check the .docx Section 9 for the full list before making an assumption.**
