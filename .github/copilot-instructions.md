# Copilot Coding Agent Instructions

## Repository Summary

This is a **Google Apps Script (GAS)** codebase for a multi-site UFLI literacy progress tracking system deployed into Google Sheets. The target runtime is the Google Apps Script V8 engine (server-side JavaScript ES2015+). HTML files are served as GAS dialogs/sidebars via `HtmlService`. There are **no npm dependencies, no bundler, no TypeScript, and no CI/CD pipelines**.

Languages: **JavaScript** (`.gs` files — Google Apps Script), **HTML** (dialog/sidebar UI). One **Node.js** validation script exists for offline checks.

## Architecture — Three Zones

The repository is transitioning from fragmented school-specific files into a unified "Gold Standard" template. The goal is 90% shared Core code / 10% school-specific Config+Modules.

### Current State (In Transition)

The repo root currently contains BOTH legacy school-prefixed files AND unified files. The unified files are the target:

**Unified Core Files (USE THESE):**
- `gold-standard-template/SharedConstants.gs` — Canonical constants (LESSON_LABELS, SKILL_SECTIONS, REVIEW_LESSONS, GRADE_METRICS)
- `gold-standard-template/SharedEngine.gs` — Low-level helpers (score calc, layout utilities)
- `gold-standard-template/UnifiedConfig.gs` — Runtime config loader (reads SITE_CONFIG)
- `gold-standard-template/Phase2_ProgressTracking.gs` — Unified progress tracking engine (~111 KB)
- `gold-standard-template/SetupWizard.gs` — Unified onboarding wizard, menu builder (~112 KB)
- `gold-standard-template/SiteConfig_TEMPLATE.gs` — Copy and rename per school; defines SITE_CONFIG object + feature flags
- `validate_shared_constants.js` — Node.js offline validator

**Unified UI Files (USE THESE):**
- `SetupWizardUI.html`, `LessonEntryForm.html`, `ManageGroupsUI.html`, `ManageStudentsUI.html`
- `GenerateReportsUI.html`, `GrowthHighlighterSidebar.html`

**Feature Modules (in `gold-standard-template/modules/` directory):**
- `gold-standard-template/modules/ModuleLoader.gs` — Dynamic menu builder driven by SITE_CONFIG.features
- `gold-standard-template/modules/CoachingDashboard.gs` — Flag: `coachingDashboard`
- `gold-standard-template/modules/TutoringSystem.gs` — Flag: `tutoringSystem`
- `gold-standard-template/modules/GrantReporting.gs` — Flag: `grantReporting`
- `gold-standard-template/modules/GrowthHighlighter.gs` — Flag: `growthHighlighter`
- `gold-standard-template/modules/UnenrollmentAutomation.gs` — Flag: `unenrollmentAutomation`
- `gold-standard-template/modules/AdminImport.gs` — Flag: `adminImport`
- `gold-standard-template/modules/MixedGradeSupport.gs` — Flag: `mixedGradeSupport`
- `gold-standard-template/modules/onOpen_Example.gs` — Reference implementation

**Pre-K System:**
- `PreKMainCode.gs` — Pre-K subsystem backend (~94 KB)
- `PreKDashboard.html`, `PreKIndex.html`, `PreKParentReport.html`, `PreKPortal.html`, `PreKSetupWizard.html`, `PreKTutorForm.html`

**Legacy School-Prefixed Files (READ-ONLY REFERENCE — do not modify):**
- `archive/adelante/Adelante*.gs/.html`, `archive/sankofa/Sankofa*.gs/.html`, `archive/chaw/CHAW*.gs/.html`, `archive/cca/CCA*.gs/.html`, `archive/globalprep/GlobalPrep*.gs/.html`, `archive/allegiant/Allegiant*.gs/.html`
- These are frozen legacy references from before unification and live under `archive/*`. All new work targets the unified files above.

**Documentation:**
- `docs/ARCHITECTURE.md`, `docs/BUSINESS_RULES.md`, `docs/QA_CHECKLIST.md`, `docs/MIGRATION_GUIDE.md`
- `docs/PHASE2_CONSOLIDATION.md` through `docs/PHASE7G_FINAL_REPORT.md` — Phase history
- `docs/TECH_CURRENT_STATE.md`, `docs/CODE_REVIEW_HISTORY.md`, `docs/BACKPORT_TRACKING_SHAREDCONSTANTS.md`

## Key Conventions

1. **All `.gs` files use `const`/`let`** (never `var`). The runtime is GAS V8.
2. **Google Apps Script has a flat global scope** — every `.gs` file shares the same namespace. All top-level `const`, `function`, and `class` declarations are global. Prefix module-specific constants to avoid collisions (e.g., `GH_CONFIG`, `TUTORING_LAYOUT`, `WEEKLY_COL`).
3. **Feature flags** live in `SiteConfig_TEMPLATE.gs` under `SITE_CONFIG.features`. Modules check these at runtime via `isFeatureEnabled('featureName')` or direct property access. Always gate new optional features behind a flag.
4. **Sheet layout constants**: Data rows start at row 6 (`LAYOUT.DATA_START_ROW = 6`), headers are at row 5. Column indices are 1-based for `Range` calls. These constants are in `SharedConstants.gs` and `SharedEngine.gs`.
5. **UFLI domain**: 128 lessons (L1–L128), 16 skill sections, review lessons act as gateway tests. `LESSON_LABELS`, `SKILL_SECTIONS`, `REVIEW_LESSONS`, and `GRADE_METRICS` are defined once in `SharedConstants.gs`. Never redefine them elsewhere.
6. **HTML files** are loaded with `HtmlService.createHtmlOutputFromFile('filename')` — the filename is without extension and relative to the Apps Script project root.
7. **File naming**: Unified files have NO school prefix. Legacy files have school prefixes (e.g., `AdelantePhase2_ProgressTracking.gs`). New files should never have school prefixes.

## Build, Validate, and Test

> ⚠️ **ACTIVELY UNDER DEVELOPMENT**: The Build, Validate, and Test infrastructure is currently being built out as part of the Gold Standard refactoring effort. The sections below document what exists today. Additional validation tooling is forthcoming.

There are **no GitHub Actions workflows** and **no CI pipeline** currently configured.

### Tier 1 — Available Automated Check

```bash
node validate_shared_constants.js
```

This Node.js script (requires Node 14+) validates:
- `SharedConstants.gs` defines all canonical constants (`LESSON_LABELS`, `SKILL_SECTIONS`, `REVIEW_LESSONS`, `REVIEW_LESSONS_SET`, `PERFORMANCE_THRESHOLDS`, `STATUS_LABELS`).
- No school-specific Phase2 files redefine these constants locally.

**Always run this after modifying `SharedConstants.gs` or any Phase2/engine file.**

### Tier 2 — Manual Validation Checklist (from `QA_CHECKLIST.md`)

Since GAS files cannot be executed locally, validate logic changes by:
1. Verifying syntax: `.gs` files must be valid ES2015+ JavaScript. Avoid Node.js-only APIs (`require`, `process`, `Buffer`, etc.).
2. Verifying no duplicate `const`/`function` names across all unified `.gs` files (GAS flat namespace).
3. Ensuring new constants reference `SharedConstants.gs` rather than duplicating values.
4. Checking HTML files use `google.script.run` for server calls (GAS client-side API).

### Tier 3 — Planned (Not Yet Implemented)

End-to-end testing, automated linting, and CI integration are planned but not yet available. See `PHASE7G_E2E_TESTING.md` for the testing roadmap.

### What NOT to Do

- Do not run `npm install` or create `package.json` — there is no Node project.
- Do not attempt `npx clasp push` — there is no `.clasp.json` configured.
- Do not import/require between `.gs` files — GAS does not support modules.
- Do not add `export`/`import` statements to `.gs` files.

## Making Changes

- **New shared logic** → Add to or modify the unified files (no school prefix).
- **New optional feature** → Create a new module in `modules/`, add a feature flag to `SiteConfig_TEMPLATE.gs`, register it in `modules/ModuleLoader.gs` inside `buildFeatureMenu()`.
- **Constants changes** → Edit `SharedConstants.gs`, then run `node validate_shared_constants.js`.
- **UI changes** → Edit the unified HTML files (no school prefix).
- **Documentation** → Update the relevant `.md` file in the repo root.
- **Never modify** legacy school-prefixed files — they are frozen references.

## Important Files to Read First

| Priority | File | Why |
|----------|------|-----|
| 1 | `SiteConfig_TEMPLATE.gs` | All feature flags + config shape (~27 KB) |
| 2 | `SharedConstants.gs` | Canonical UFLI constants (~10 KB) |
| 3 | `SharedEngine.gs` | Core helper functions (~26 KB) |
| 4 | `modules/README.md` | Module documentation and flag mapping |
| 5 | `ARCHITECTURE.md` | System architecture overview |
| 6 | `BUSINESS_RULES.md` | Domain rules (benchmark calc, review lesson gateways, grade metrics) |
| 7 | `QA_CHECKLIST.md` | Testing and validation procedures |

## Trust These Instructions

These instructions are comprehensive and validated against the actual repository structure as of February 2026. Only perform additional file exploration if information here is incomplete or found to be in error. The repository has no hidden build scripts, no CI, no test frameworks, and no package managers beyond the single `validate_shared_constants.js` Node script.
