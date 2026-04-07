# CLAUDE.md — Adira Reads Web App

> **This file is read automatically by Claude Code on every session.** Keep it lean. Deep context lives in `docs/`. When you start working on a specific area, read the relevant doc first.

---

## Who you're working with

**Christina Kelley** (CK Consulting / Christina Kelley Consulting) — fractional CTO and sole technical lead at **TILT (The Indy Learning Team)**, a two-person nonprofit literacy intervention organization she co-founded with Susan Appel.

- Christina is **self-taught** and describes her style as **"developer hacker"** — highly capable, iterative, comfortable with multi-file systems across Google Apps Script, Python, and now this web app.
- She built the entire current Adira Reads platform (Sheets + Apps Script, 6 school sites, 2,000+ students) from scratch.
- She values **exhaustive documentation that anticipates every question**. Match that standard in your own code and explanations.
- She does **not** want generic SaaS patterns applied without thought. The current system encodes 5+ years of pedagogical insight that **must be carried forward exactly**. We are changing the container, not the content.

## What we're building

A **purpose-built multi-tenant SaaS web application** to replace the entire Google Sheets / Apps Script architecture currently powering Adira Reads. This is a **full rebuild**, not a parallel system or incremental migration.

The new platform must:

1. Serve **8–12 partner school sites** in Indianapolis (currently 6, scaling).
2. Support the **UFLI Foundations curriculum** (128 lessons, K–8 grade band, structured literacy).
3. Preserve every analytical framework from the current system: **Big Four metrics, banding logic, conditional probability chains, five student archetypes, 10-skill screener, fidelity scoring**.
4. Enforce **strict school-level data isolation** at the database layer (PostgreSQL Row Level Security).
5. Be **operable by a two-person nonprofit** — minimal ops overhead, managed services where possible.
6. Surface AI recommendations (regrouping, early warning, coaching) that are **always explainable and human-overridable**. The system never acts autonomously on student data.

## North-star principles (do not violate)

1. **Data sovereignty above all.** No school's data is ever accessible to another school. Enforced at the database layer, not the application layer. This is non-negotiable.
2. **Preserve what works.** The Big Four, the banding archetypes, the cliff alerts, the diagnostic framework — these are carried forward exactly. If you're tempted to "improve" them, stop and ask Christina.
3. **Human decision authority.** AI surfaces evidence and recommendations. Humans make decisions. Never auto-regroup, auto-escalate, or auto-modify student records.
4. **Sustainable for two people.** Favor managed services, boring tech, and low ops burden over cleverness.
5. **Designed for scale.** One deployment must reach all schools simultaneously. The current N-deployments-per-change pain is the thing we're fixing.

## Doc index — read what's relevant before working

| When you're working on... | Read first |
|---|---|
| **Anything data-model related** | `docs/data-model.md` + `docs/source/future-state-data-model-v1.docx` |
| **UFLI lessons, assessments, scoring, fidelity** | `docs/ufli-domain.md` |
| **School-specific behavior, naming, edge cases** | `docs/school-variations.md` |
| **What exists today / what we're replacing** | `docs/current-state-inventory.md` |
| **Acronyms or unfamiliar terms** | `docs/glossary.md` |
| **Architectural decisions already made** | `docs/decisions.md` |
| **Visual identity, colors, voice** | `docs/brand.md` |

If a doc doesn't exist for something you need, **ask Christina before assuming**. Gaps in this bundle are intentional — she will fill them by reference, not by guessing.

## Tech stack (locked — see decisions.md D-013)

- **Framework:** Next.js 15 (App Router) — Server Actions for mutations, API routes for public endpoints
- **Database:** Supabase (managed PostgreSQL with native RLS)
- **ORM:** Drizzle (type-safe, migrations as code, SQL-close)
- **Auth:** Supabase Auth (JWT claims wired to RLS policies)
- **UI:** Tailwind CSS + shadcn/ui (components copied into the repo, owned outright)
- **Hosting:** Vercel
- **Monitoring:** Sentry (errors) + Posthog (analytics)

## MVP scope (locked — see decisions.md D-014)

The MVP bar is **"can one school run on this without Sheets?"** Nothing more.

**In MVP:** Auth, School/Staff/Student basics, Group management, Session capture (mobile-first), UFLI MAP view, Big Four dashboard for one school.

**Deferred past MVP:** Cross-school dashboards, AI engine, Monday Digest, fidelity scoring, banding, cliff alerts, IREAD-3 prediction, Sound Inventory/Fry Word, Parent role, reporting layer, all of: Coaching Dashboard, Grant Reporting, Growth Highlighter, Unenrollment Automation, Pre-K subsystem.

The deferred features get **schema'd** so the data model accommodates them, but no application code touches them in MVP.

**Multi-tenant from day one (D-015):** RLS and `school_id` threading are built in from line one even though MVP has only one tenant. No "we'll add tenancy in v2" shortcuts.

**Migration approach (D-016):** Pilot school starts fresh. 4–6 week parallel period with Sheets. Cutover at a natural break (winter break, end of quarter). UFLI_Lesson reference table is the only thing seeded from day one.

## Working agreements

- **Tech stack and MVP scope are locked.** If you find yourself wanting to add something that's deferred or swap out a stack component, **stop and ask Christina** rather than just doing it.
- **Always confirm brand colors before applying them.** TILT has multiple palettes for different contexts. See `docs/brand.md`.
- **Use the file-header / JSDoc / inline comment conventions** documented in `docs/decisions.md` D-010 (ported from Christina's `code-docs` skill).
- **Christina's full name is Christina Kelley.** CK = Christina Kelley. CK Consulting = Christina Kelley Consulting. Never abbreviate to "Kelley" alone.
- **When in doubt, ask.** Wrong assumptions are more expensive than questions.

## What lives outside this repo

This bundle is the **technical context** for the web app build. Christina's broader context (caregiving, @parentingmyparents brand, garage construction, Bridge Builder Consulting, Mapt Solutions engagement, the Lilly Endowment grant work) is real and shapes her availability and priorities — but is not in scope for this codebase. If she mentions any of these, that's life context, not feature requests.
