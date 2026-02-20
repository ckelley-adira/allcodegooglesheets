# Code Review History
## ckelley-adira/allcodegooglesheets
*Generated: February 2026*

---

## Summary Statistics
- Total PRs reviewed: 20 (PR #8, #9, #10, #11, #13, #14, #15, #16, #17, #18, #20, #21, #22, #23, #24, #26, #28, #30, #31, #32)
- Total inline review comments: 31 (across 22 threads)
- Total PR-level reviews: 25
- Total discussion comments: 12
- Reviewers: ckelley-adira, copilot-pull-request-reviewer[bot], copilot-swe-agent[bot]

> **Note:** PR numbers are not consecutive because some numbers (#12, #19, #25, #27, #29) are GitHub Issues rather than pull requests and are therefore not listed here.
>
> **Note on verbatim quotes:** Reviewer comments and discussion comment content in this document preserve the original language used by reviewers, including technical file identifiers that may contain partner-site-specific names.

---

## Pull Request Reviews (Chronological, Oldest First)

---

### PR #8 — Extract shared UFLI constants to SharedConstants.gs
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-18T18:20:01Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/8

**Description Summary:**
Eliminates 444 lines of duplicate business-rule constants across 6 partner site implementations by extracting to a single shared module (`SharedConstants.gs`). Centralizes `LESSON_LABELS` (128 entries), `SKILL_SECTIONS`, `REVIEW_LESSONS`, `REVIEW_LESSONS_SET`, `PERFORMANCE_THRESHOLDS`, and `STATUS_LABELS` + `getPerformanceStatus()`. All 6 partner site Phase2 files refactored to reference shared module. Pure extraction — no logic changes.

#### PR-Level Reviews
*No PR-level reviews submitted.*

#### Inline Code Review Comments
*No inline review comments.*

#### Discussion Comments
*No discussion comments.*

*No review comments on this PR.*

---

### PR #9 — Phase 3: Canonical setup wizard with dynamic SITE_CONFIG
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-18T19:06:30Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/9

**Description Summary:**
Replaces school-specific setup wizards with a universal configuration-driven system. Creates `SiteConfig_TEMPLATE.gs` (30+ documented keys, helper functions, validation) and `SetupWizard.gs` v4.0 (universal wizard based on a partner site's v3.2 setup wizard). Expands `FEATURE_OPTIONS` from 5 to 10 modules. Adds `SetupWizardUI.html` with 9-step guided configuration including new Branding (Step 7) and Sheet Layout (Step 8) steps. For greenfield deployments and major rewrites only.

#### PR-Level Reviews
*No PR-level reviews submitted.*

#### Inline Code Review Comments
*No inline review comments.*

#### Discussion Comments
*No discussion comments.*

*No review comments on this PR.*

---

### PR #10 — Phase 2: Consolidate Phase2_ProgressTracking logic into SharedEngine
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-18T19:14:27Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/10

**Description Summary:**
Creates `SharedEngine.gs` (664 lines) extracting core calculation logic from 6 school-specific files. Unified functions include `calculateBenchmark`, `calculateSectionPercentage`, `updateAllStats`, gateway helpers, and utilities. Each school file now implements `get[School]Config()` and delegates to shared engine. Net -1,241 lines (35% reduction across Phase2 files). Zero functional changes.

#### PR-Level Reviews
*No PR-level reviews submitted.*

#### Inline Code Review Comments
*No inline review comments.*

#### Discussion Comments
*No discussion comments.*

*No review comments on this PR.*

---

### PR #11 — Extract feature modules into centralized modules/ directory with flag-driven activation
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-18T21:20:54Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/11

**Description Summary:**
Extracts 7 optional feature modules into `modules/` directory with feature flag system: MixedGradeSupport, CoachingDashboard, TutoringSystem, GrantReporting, GrowthHighlighter, AdminImport, UnenrollmentAutomation. Adds `ModuleLoader.gs` with `buildFeatureMenu()` for dynamic menu building. Refactors `onOpen()` to read from `SITE_CONFIG.features`. Includes `MIGRATION_GUIDE.md`, `QA_CHECKLIST.md`, `ARCHITECTURE.md`. 37% code reduction (432 KB → 270 KB).

#### PR-Level Reviews
*No PR-level reviews submitted.*

#### Inline Code Review Comments
*No inline review comments.*

#### Discussion Comments
*No discussion comments.*

*No review comments on this PR.*

---

### PR #13 — Phase 6 Backport Tracking: SharedConstants Integration Verification
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-18T18:43:34Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/13

**Description Summary:**
Investigates Phase 6 backport request (Issue #12). Finds no backport needed — SharedConstants.gs is already integrated in main with all 6 schools referencing it correctly (89 references, 0 duplicates). Creates `validate_shared_constants.js` (automated verification script), `BACKPORT_TRACKING_SHAREDCONSTANTS.md` (deployment guide), and `PHASE6_BACKPORT_SUMMARY.md` (executive summary). Risk assessment: LOW.

#### PR-Level Reviews
*No PR-level reviews submitted.*

#### Inline Code Review Comments
*No inline review comments.*

#### Discussion Comments
*No discussion comments.*

*No review comments on this PR.*

---

### PR #14 — Phase 3: Complete canonical setup wizard with CONFIG_LAYOUT constants and 9-step UI
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-18T19:17:43Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/14

**Description Summary:**
Finalizes the universal setup wizard. Fixes UI inconsistencies: adds Step 9 (Review) to step indicator, corrects `totalSteps` from 8→9. Eliminates hardcoded row numbers in `SetupWizard.gs` by extending `CONFIG_LAYOUT.SITE_CONFIG` with missing constants (`HEADER_ROW`, `GRADES_HEADER_ROW`, `GRADE_MIXING_HEADER_ROW`). All Phase 3 requirements now complete: SiteConfig_TEMPLATE.gs (42 config keys), SetupWizard.gs v4.0 (10 feature modules), SetupWizardUI.html (9-step wizard), documentation.

#### PR-Level Reviews
*No PR-level reviews submitted.*

#### Inline Code Review Comments
*No inline review comments.*

#### Discussion Comments
*No discussion comments.*

*No review comments on this PR.*

---

### PR #15 — Phase 6 completion verification and formal sign-off
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-18T21:27:17Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/15

**Description Summary:**
Provides formal verification that Phase 6 (SharedConstants backport tracking) is complete. Adds `PHASE6_COMPLETION_REPORT.md` documenting: PR#13 merge status, validation results (6 schools, 89 shared constant references, 0 duplicates), deployment readiness matrix, risk assessment, and rollback procedures. Confirms `node validate_shared_constants.js` passes with ✅ ALL VALIDATIONS PASSED.

#### PR-Level Reviews
*No PR-level reviews submitted.*

#### Inline Code Review Comments
*No inline review comments.*

#### Discussion Comments
*No discussion comments.*

*No review comments on this PR.*

---

### PR #16 — Complete Phase 2 SharedEngine consolidation for remaining school files
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-18T21:25:54Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/16

**Description Summary:**
Completes SharedEngine.gs consolidation for 4 remaining partner site files. Removes 17 core functions and 7 lesson array constants. Implements `get[School]Config()` pattern for each site. Results: Partner Site A -594 lines (18.4%), Partner Site F -141 lines (5.3%), Partner Site D -109 lines (4.4%), Partner Site E -31 lines (1.6%). One partner site retains custom `GRADE_METRICS` (G3 uses 120 lessons vs standard 107). Adds `PHASE2_CONSOLIDATION.md`.

#### PR-Level Reviews
*No PR-level reviews submitted.*

#### Inline Code Review Comments
*No inline review comments.*

#### Discussion Comments
*No discussion comments.*

*No review comments on this PR.*

---

### PR #17 — Document Phase 3 rebase verification and main branch alignment
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-18T21:26:51Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/17

**Description Summary:**
Verifies that PR #9 (Phase 3 canonical setup wizard) was already merged to main and adds `REBASE_NOTES.md` documenting the verification. Confirms all 5 Phase 3 files are present and intact in main, with no conflicts. The only delta is the new REBASE_NOTES.md file itself.

#### PR-Level Reviews
*No PR-level reviews submitted.*

#### Inline Code Review Comments
*No inline review comments.*

#### Discussion Comments
*No discussion comments.*

*No review comments on this PR.*

---

### PR #18 — Phase 5: Unify UI dialogs with server-side template parameterization
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-18T21:53:40Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/18

**Description Summary:**
Unifies all major UI HTML files to canonical server-side templated versions (using the most-complete partner site implementation as base). Creates 6 canonical UI files: ManageStudentsUI.html, ManageGroupsUI.html, GenerateReportsUI.html, GrowthHighlighterSidebar.html, LessonEntryForm.html, SetupWizardUI.html. Adds `branding` block to SITE_CONFIG with `getBranding()` helper. Replaces all hardcoded colors/logos/labels with `<?= getBranding().property ?>` template tokens. Deletes 4 partner-site-specific LessonEntryForm files. PreK UI files intentionally untouched. See [full PR](https://github.com/ckelley-adira/allcodegooglesheets/pull/18) for detailed before/after.

#### PR-Level Reviews
| Reviewer | State | Date | Summary |
|---|---|---|---|
| ckelley-adira | APPROVED | 2026-02-18T21:53:29Z | *(no review body)* |

#### Inline Code Review Comments
*No inline review comments.*

#### Discussion Comments
| Commenter | Date | Comment |
|---|---|---|
| ckelley-adira | 2026-02-18T21:34:46Z | Template review: Canonical Files & SITE_CONFIG Analysis. Identified missing `branding` block in SITE_CONFIG, provided full branding structure. Checklist: add branding block + getBranding(), rename 6 partner-site-prefixed files to canonical names, replace hardcoded values with `<?= ?>` tokens, delete per-school LessonEntryForm files, keep PreK files untouched, add PHASE5_UI_UNIFICATION.md. |
| ckelley-adira | 2026-02-18T21:38:00Z | "@copilot+claude-sonnet-4.5 did you incorporate my last comment?" |
| Copilot | 2026-02-18T21:42:21Z | Acknowledged feedback requesting server-side `<?= ?>` templating. Confirmed implementation: added branding block to SiteConfig_TEMPLATE.gs, created 6 canonical UI files, replaced hardcoded values with `<?= getBranding().property ?>` tokens, deleted school-specific LessonEntryForm files, kept PreK files untouched, created PHASE5_UI_UNIFICATION.md. Note: setup wizards must use `createTemplateFromFile().evaluate()` going forward. |
| ckelley-adira | 2026-02-18T21:42:29Z | Follow-up with outstanding items: (1) rename partner-site-prefixed files to canonical names (drop partner-site prefix), (2) delete per-school duplicate LessonEntryForm files, (3) add static branding block to SiteConfig_TEMPLATE.gs with full structure, (4) update PHASE5_UI_UNIFICATION.md to document school-specific files that remain. |

---

### PR #20 — Phase 7: Unified school site template with parameterized config and dynamic deployment
**State:** Open (Draft)
**Author:** Copilot
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/20

**Description Summary:**
Creates unified school site template infrastructure. New files: `UnifiedConfig.gs` (runtime config resolver with grade range model presets), `UnifiedPhase2_ProgressTracking.gs` (single parameterized Phase2 replacing all 6 school copies), `PHASE7_UNIFIED_TEMPLATE.md`. Updates: SiteConfig_TEMPLATE.gs (adds `gradeRangeModel`, `gradesServed`, `layout` block), SetupWizard.gs (delegates to `buildFeatureMenu()`, adds `GRADE_RANGE_MODEL_ROW`), SetupWizardUI.html (Grade Range Model dropdown with preset auto-selection), validate_shared_constants.js (extended for Phase 7). See [full PR](https://github.com/ckelley-adira/allcodegooglesheets/pull/20).

#### PR-Level Reviews
*No PR-level reviews submitted.*

#### Inline Code Review Comments
*No inline review comments.*

#### Discussion Comments
*No discussion comments.*

*No review comments on this PR.*

---

### PR #21 — Phase 7a: Logic file audit and consolidation roadmap
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-18T22:49:01Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/21

**Description Summary:**
Audits 17 partner-site-specific logic files to plan Phase 7 consolidation. Creates `PHASE7_AUDIT_REPORT.md` with: (1) delta analysis showing 65-75% consolidation potential, (2) 6-site × 12-category feature matrix, (3) parameterization strategy, (4) proposed feature flags (13 new), (5) consolidation roadmap (Phases 7b-7g, 17-25 days). Security finding: one partner site's AdminImport was missing input sanitization present in another partner site's version.

#### PR-Level Reviews
| Reviewer | State | Date | Summary |
|---|---|---|---|
| ckelley-adira | APPROVED | 2026-02-18T22:48:55Z | *(no review body)* |

#### Inline Code Review Comments
*No inline review comments.*

#### Discussion Comments
*No discussion comments.*

---

### PR #22 — Phase 7b: Consolidate AdminImport into unified parameterized module
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-18T23:50:13Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/22

**Description Summary:**
Creates `AdminImport_Unified.gs` (840 lines, 28 functions) combining one partner site's security hardening (formula injection prevention via `sanitizeCellValue`) with another partner site's structured logging (`log(func, msg, lvl)`). Adds two feature flags to SiteConfig_TEMPLATE.gs: `enhancedSecurity: true` (default ON) and `structuredLogging: false` (default OFF). Adds deprecation notices to both partner-site-specific files. Fixes critical bug: corrects import format detection to pass full `selectedType` to backend. See [full PR](https://github.com/ckelley-adira/allcodegooglesheets/pull/22).

#### PR-Level Reviews
| Reviewer | State | Date | Summary |
|---|---|---|---|
| copilot-pull-request-reviewer[bot] | COMMENTED | 2026-02-18T23:06:48Z | PR overview: 4 files reviewed, 2 comments generated. Consolidated AdminImport from AdelanteAdminImport.gs and AllegiantAdminImport.gs, adding enhancedSecurity and structuredLogging feature flags. |
| ckelley-adira | COMMENTED | 2026-02-18T23:45:15Z | *(no review body — applied feedback via inline thread)* |
| ckelley-adira | COMMENTED | 2026-02-18T23:45:29Z | *(no review body)* |
| ckelley-adira | COMMENTED | 2026-02-18T23:45:37Z | *(no review body)* |
| ckelley-adira | COMMENTED | 2026-02-18T23:45:46Z | *(no review body)* |
| copilot-swe-agent[bot] | COMMENTED | 2026-02-18T23:47:07Z | *(no review body — fixes applied)* |
| ckelley-adira | APPROVED | 2026-02-18T23:49:12Z | *(no review body)* |
| ckelley-adira | APPROVED | 2026-02-18T23:49:24Z | *(no review body)* |
| ckelley-adira | APPROVED | 2026-02-18T23:49:37Z | *(no review body)* |
| copilot-pull-request-reviewer[bot] | COMMENTED | 2026-02-18T23:53:45Z | Second review pass: 4 files reviewed, 10 comments generated after fix commit. |

#### Inline Code Review Comments

**Thread 1** — `AdminImport_Unified.gs` (resolved, outdated)
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| AdminImport_Unified.gs | — | copilot-pull-request-reviewer[bot] | 2026-02-18T23:06:48Z | The `selectImportType` function uses the global `event` variable without declaring it as a parameter. Works via onclick attributes but not best practice; could fail in strict mode. Note: this pattern exists in the original school-specific files, so not a regression. |

*Resolved: Yes (outdated)*

---

**Thread 2** — `AdminImport_Unified.gs` — Critical bug: import format detection (resolved, outdated)
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| AdminImport_Unified.gs | — | copilot-pull-request-reviewer[bot] | 2026-02-18T23:06:48Z | **Critical bug:** The import format detection is broken. `processImport` function incorrectly maps selected type ('initial-grid', 'initial-row', 'progress') to just 'initial' or 'progress', losing the format information. This causes `importCsvToStaging` to always evaluate `isGridFormat` as false. Fix: pass full `selectedType` value to `importCsvToStaging`, not the mapped value. |
| AdminImport_Unified.gs | — | ckelley-adira | 2026-02-18T23:45:15Z | @copilot apply changes based on [this feedback](https://github.com/ckelley-adira/allcodegooglesheets/pull/22#discussion_r2824872806) |
| AdminImport_Unified.gs | — | ckelley-adira | 2026-02-18T23:45:28Z | @copilot apply changes based on this feedback (repeated request) |
| AdminImport_Unified.gs | — | ckelley-adira | 2026-02-18T23:45:36Z | @copilot apply changes based on this feedback (repeated request) |
| AdminImport_Unified.gs | — | ckelley-adira | 2026-02-18T23:45:46Z | @copilot apply changes based on this feedback (repeated request) |
| AdminImport_Unified.gs | — | copilot-swe-agent[bot] | 2026-02-18T23:47:06Z | Fixed in 6e04482. Removed the premature type mapping (lines 329-338) and now pass `selectedType` directly to `importCsvToStaging()`. The backend correctly handles 'initial-grid', 'initial-row', and 'progress' values. |

*Resolved: Yes (outdated)*

---

**Thread 3** — `AdminImport_Unified.gs` line 84
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| AdminImport_Unified.gs | 84 | copilot-pull-request-reviewer[bot] | 2026-02-18T23:53:43Z | The `sanitizeCellValue` header lists "Whitespace normalization" as a feature, but the implementation doesn't normalize whitespace (it only length-limits, strips dangerous prefixes, and removes null bytes). Update the comment to match behavior or implement normalization so documentation stays accurate. |

*Resolved: No*

---

**Thread 4** — `AdminImport_Unified.gs` line 106
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| AdminImport_Unified.gs | 106 | copilot-pull-request-reviewer[bot] | 2026-02-18T23:53:44Z | `sanitizeCellValue` returns early for dangerous prefixes, meaning null-byte removal never runs for those inputs. Perform null-byte filtering (and any whitespace normalization) before the prefix check/return to ensure they apply universally. |

*Code context:*
```diff
  // Remove null bytes which could cause issues
  value = value.replace(/\x00/g, '');
  // Prevent formula injection - escape cells starting with dangerous characters
  if (/^[=+\-@\t\r]/.test(value)) {
    return "'" + value; // Prefix with single quote to treat as text
  }
```

*Resolved: No*

---

**Thread 5** — `AdelanteAdminImport.gs` line 6
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| AdelanteAdminImport.gs | 6 | copilot-pull-request-reviewer[bot] | 2026-02-18T23:53:44Z | The deprecation header hardcodes a specific migration date. The Phase 7b spec calls for a placeholder like `[date of PR merge]`. Consider changing to a placeholder so the note remains accurate at merge time. |

*Resolved: No*

---

**Thread 6** — `AllegiantAdminImport.gs` line 6
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| AllegiantAdminImport.gs | 6 | copilot-pull-request-reviewer[bot] | 2026-02-18T23:53:44Z | Same as Thread 5 — deprecation header hardcodes migration date; should use `[date of PR merge]` placeholder. |

*Resolved: No*

---

**Thread 7** — `AdminImport_Unified.gs` line 62
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| AdminImport_Unified.gs | 62 | copilot-pull-request-reviewer[bot] | 2026-02-18T23:53:44Z | PHASE7_AUDIT_REPORT.md §1.4/§3.4 specifies `VALID_STATUSES = ["N/A", "P", "M", "IP", ""]`. This file uses `VALID_STATUSES = ['Y','N','A']`, which doesn't match the audit/PR spec and will change validation + import behavior. |

*Resolved: No*

---

**Thread 8** — `AdminImport_Unified.gs` line 356
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| AdminImport_Unified.gs | 356 | copilot-pull-request-reviewer[bot] | 2026-02-18T23:53:45Z | The UI sends `importType` as just `'initial'`/`'progress'`, but `importCsvToStaging` expects values like `'initial-grid'`/`'initial-row'` to choose the right parser. Pass the full selected value to the backend, or update the backend to match simplified values. |

*Resolved: No*

---

**Thread 9** — `AdminImport_Unified.gs` line 13
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| AdminImport_Unified.gs | 13 | copilot-pull-request-reviewer[bot] | 2026-02-18T23:53:45Z | The audit §3.4 specifies a 26-function API (e.g., `processCSVImport`, `parseCSV`, `detectFormat`, `validateStudentName`, etc.). This file implements a different API surface (`importCsvToStaging`, `parseCSVLine`, etc.). Align the implementation to the §3.4 function set or update the audit references. |

*Resolved: No*

---

**Thread 10** — `AdminImport_Unified.gs` line 122
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| AdminImport_Unified.gs | 122 | copilot-pull-request-reviewer[bot] | 2026-02-18T23:53:45Z | There is already a global `log(functionName, message, level)` in `SharedEngine.gs`. Introducing another global `log()` here risks overriding project-wide logging depending on file load order. Consider renaming to an AdminImport-specific logger or delegating to the shared `log()`. |

*Resolved: No*

---

**Thread 11** — `AdminImport_Unified.gs` line 783
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| AdminImport_Unified.gs | 783 | copilot-pull-request-reviewer[bot] | 2026-02-18T23:53:45Z | `enhancedSecurity` sanitization is only applied while parsing the pasted CSV. Users can still edit the staging sheet after import; those edited values are later written to other sheets without sanitization, reintroducing formula injection risk. Sanitize values again before writing to UFLI MAP / Initial Assessment / Historical outputs. |

*Resolved: No*

---

**Thread 12** — `SiteConfig_TEMPLATE.gs` line 99 (outdated)
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| SiteConfig_TEMPLATE.gs | 99 | copilot-pull-request-reviewer[bot] | 2026-02-18T23:53:45Z | The `ADMIN IMPORT` feature-flag doc comment still points to `modules/AdminImport.gs`, but this PR introduces `AdminImport_Unified.gs` as the consolidated implementation. Update the reference so it's clear which file is canonical after Phase 7b. |

*Resolved: No (outdated)*

#### Discussion Comments
*No discussion comments on this PR.*

---

### PR #23 — Phase 7c: Consolidate MixedGradeSupport modules with runtime configuration
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-19T00:27:13Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/23

**Description Summary:**
Creates `MixedGradeSupport_Unified.gs` replacing all 3 school-specific versions. Implements 40+ common functions fully parameterized via `MIXED_GRADE_CONFIG`. Adds `scClassroomGroups` and `coTeachingSupport` feature flags to SiteConfig_TEMPLATE.gs. Grade combinations, SC classroom, and co-teaching settings all config-driven at runtime. Deprecation notices added to 3 school-specific files. Code review feedback addressed: fixed type mismatch (combinations: string→object), removed dead code in `getMixedGradeConfig()`, replaced optional chaining with consistent typeof checks throughout. See [full PR](https://github.com/ckelley-adira/allcodegooglesheets/pull/23).

#### PR-Level Reviews
| Reviewer | State | Date | Summary |
|---|---|---|---|
| copilot-pull-request-reviewer[bot] | COMMENTED | 2026-02-19T00:21:29Z | 5 comments on 5 files. Consolidates 3 school-specific MixedGradeSupport files, adds scClassroom/coTeaching feature flags, deprecates old files. 2 low-confidence comments suppressed. |
| copilot-swe-agent[bot] | COMMENTED | 2026-02-19T00:25:36Z | *(no review body — fixes applied)* |
| copilot-swe-agent[bot] | COMMENTED | 2026-02-19T00:25:39Z | *(no review body)* |
| copilot-swe-agent[bot] | COMMENTED | 2026-02-19T00:25:41Z | *(no review body)* |
| copilot-swe-agent[bot] | COMMENTED | 2026-02-19T00:25:44Z | *(no review body)* |
| copilot-swe-agent[bot] | COMMENTED | 2026-02-19T00:25:47Z | *(no review body)* |

#### Inline Code Review Comments

**Thread 1** — `SiteConfig_TEMPLATE.gs` — Type mismatch in combinations (resolved, outdated)
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| SiteConfig_TEMPLATE.gs | — | copilot-pull-request-reviewer[bot] | 2026-02-19T00:21:28Z | **Type mismatch:** `MIXED_GRADE_CONFIG.combinations` is defined as a string `""` in the template (with "comma-separated" comment), but `MixedGradeSupport_Unified.gs` expects an object: `{ "KG and G1 Groups": ["KG", "G1"], ... }`. The `getGradesFromConfig()` function uses `Object.entries()`/`Object.keys()` which will fail on a string. |
| SiteConfig_TEMPLATE.gs | — | copilot-swe-agent[bot] | 2026-02-19T00:25:36Z | Fixed in 092ee31. Changed `MIXED_GRADE_CONFIG.combinations` from string to object type in SiteConfig_TEMPLATE.gs to match the unified module's expectation. |

*Resolved: Yes (outdated)*

---

**Thread 2** — `SiteConfig_TEMPLATE.gs` line 179 — SC classroom config unused (resolved, outdated)
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| SiteConfig_TEMPLATE.gs | 179 | copilot-pull-request-reviewer[bot] | 2026-02-19T00:21:29Z | The `scClassroom` configuration fields (`gradeRange`, `hasSubGroups`, `sheetName`) defined in `MIXED_GRADE_CONFIG` are never used in the code. The unified module hardcodes "SC Classroom" sheet name instead of reading from config. Either remove the unused config or implement the dynamic behavior described in the PR. |
| SiteConfig_TEMPLATE.gs | 179 | copilot-swe-agent[bot] | 2026-02-19T00:25:39Z | Fixed in 092ee31. Added clarifying comments noting current implementation uses fixed values; enable/disable is controlled via `SITE_CONFIG.features` flags. Removed redundant enabled flags from scClassroom and coTeaching configs. |

*Resolved: Yes (outdated)*

---

**Thread 3** — `MixedGradeSupport_Unified.gs` — Dead code in getMixedGradeConfig() (resolved, outdated)
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| MixedGradeSupport_Unified.gs | — | copilot-pull-request-reviewer[bot] | 2026-02-19T00:21:29Z | Configuration loading references `SITE_CONFIG.mixedGradeConfig` which does not exist in SiteConfig_TEMPLATE.gs (the template defines `MIXED_GRADE_CONFIG` as a separate global constant). The check for `SITE_CONFIG.mixedGradeConfig` will always be false, making lines 133-139 dead code. Simplify to use the global `MIXED_GRADE_CONFIG` constant directly. |
| MixedGradeSupport_Unified.gs | — | copilot-swe-agent[bot] | 2026-02-19T00:25:41Z | Fixed in 092ee31. Removed dead code and simplified `getMixedGradeConfig()` to directly return the global `MIXED_GRADE_CONFIG` constant. |

*Resolved: Yes (outdated)*

---

**Thread 4** — `SiteConfig_TEMPLATE.gs` — Redundant enable flags (resolved, outdated)
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| SiteConfig_TEMPLATE.gs | — | copilot-pull-request-reviewer[bot] | 2026-02-19T00:21:29Z | `scClassroom.enabled` and `coTeaching.enabled` fields are never checked in the code; only `SITE_CONFIG.features.scClassroomGroups` and `SITE_CONFIG.features.coTeachingSupport` are used. Also, `coTeaching.partnerGroupColumn` is never used — column is hardcoded via `GROUP_CONFIG_COLS.PARTNER_GROUP`. Two separate enable flags for the same feature is confusing. Remove redundant fields or update code to use them. |
| SiteConfig_TEMPLATE.gs | — | copilot-swe-agent[bot] | 2026-02-19T00:25:44Z | Fixed in 092ee31. Added clarifying comments; removed redundant `enabled` and `partnerGroupColumn` fields. |

*Resolved: Yes (outdated)*

---

**Thread 5** — `MixedGradeSupport_Unified.gs` — Inconsistent SITE_CONFIG existence checks (resolved, outdated)
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| MixedGradeSupport_Unified.gs | — | copilot-pull-request-reviewer[bot] | 2026-02-19T00:21:29Z | Inconsistent SITE_CONFIG existence checks: some code uses `typeof SITE_CONFIG !== 'undefined'` while most relies on optional chaining (`SITE_CONFIG?.features?.xxx`). If SITE_CONFIG is not declared at all, optional chaining will throw a ReferenceError. All SITE_CONFIG access should use the `typeof` check pattern consistently (as `AdminImport_Unified.gs` does). |
| MixedGradeSupport_Unified.gs | — | copilot-swe-agent[bot] | 2026-02-19T00:25:47Z | Fixed in 092ee31. Replaced all optional chaining with consistent `typeof SITE_CONFIG !== 'undefined' && SITE_CONFIG.features && ...` checks throughout the entire file. |

*Resolved: Yes (outdated)*

#### Discussion Comments
| Commenter | Date | Comment |
|---|---|---|
| ckelley-adira | 2026-02-19T00:21:57Z | @copilot apply changes based on the comments in [this thread](https://github.com/ckelley-adira/allcodegooglesheets/pull/23#pullrequestreview-3822858535) |

---

### PR #24 — Phase 7d: Consolidate Phase2_ProgressTracking modules (6→1 + extensions)
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-19T01:27:27Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/24

**Description Summary:**
Creates `Phase2_ProgressTracking_Unified.gs` (v6.0, 2558 lines, ~60 functions) replacing all 6 partner-site-specific versions. Creates 4 partner-site extension files for site-specific logic: `AdelanteBrandingExtensions.gs`, `CHAWBrandingExtensions.gs`, `SankofaStatsExtensions.gs`, `CCASkillsExtensions.gs`. Adds 6 feature flags to SiteConfig_TEMPLATE.gs: `dynamicBranding`, `skillAveragesAnalytics`, `diagnosticTools`, `lessonArrayTracking`, `studentNormalization`, `dynamicStudentRoster`. Adds `PROGRESS_TRACKING_CONFIG`. Review feedback addressed: added missing `DASHBOARD_COLORS` constant, added `GRADE_METRICS` alias for backward compatibility, resolved 5 duplicate function name conflicts (suffixed with site-specific identifiers), removed debug Logger.log, cleaned redundant code. See [full PR](https://github.com/ckelley-adira/allcodegooglesheets/pull/24).

#### PR-Level Reviews
| Reviewer | State | Date | Summary |
|---|---|---|---|
| ckelley-adira | APPROVED | 2026-02-19T01:25:02Z | *(no review body)* |
| copilot-pull-request-reviewer[bot] | COMMENTED | 2026-02-19T01:32:27Z | 11 files reviewed, 0 comments generated. Consolidation of 6 Phase2 files into unified architecture with 4 extension files. |

#### Inline Code Review Comments
*No inline review comments.*

#### Discussion Comments
| Commenter | Date | Comment |
|---|---|---|
| ckelley-adira | 2026-02-19T01:13:40Z | "@copilot+claude-opus-4.6 please review all changes in detail." |
| Copilot | 2026-02-19T01:24:41Z | Detailed review completed. Found and fixed 8 issues in commit `75b6108`: (1) Missing `DASHBOARD_COLORS` constant (referenced ~30 times but never defined), (2) Missing `GRADE_METRICS` alias for SHARED_GRADE_METRICS, (3) Missing `SCHOOL_BRANDING` in AdelanteBrandingExtensions.gs, (4-5) 5 function name conflicts causing duplicate declarations in GAS global scope — renamed with school suffixes, (6) Removed debug Logger.log from renderGroupTable(), (7) Removed 3 duplicate JSDoc blocks, (8) Cleaned ~40 lines of legacy "FIX #1/#2/#3" developer notes. |

---

### PR #26 — Resolve Phase 7D open questions: Pre-K layout, menu customization, version tracking
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-19T13:51:14Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/26

**Description Summary:**
Addresses 5 open decisions from Phase 7D by adding configuration surfaces. SiteConfig_TEMPLATE.gs: adds `preKOnlyMode` feature flag, `versionTracking` section, `menuCustomization` section, new helpers (`getMenuName()`, `getFeatureMenuLabel()`, `isPreKOnlySite()`, `isLegacyUpgrade()`, `getVersionTracking()`). SetupWizard.gs: adds `"prek"` to `SHEET_LAYOUT_OPTIONS`, updates `autoBalanceStudents()` to pool students across mixed-grade combinations. ModuleLoader.gs: `buildFeatureMenu()` reads label/icon overrides via `getFeatureMenuLabel()`. BUSINESS_RULES.md: documents OQ-08 through OQ-12 as Resolved. See [full PR](https://github.com/ckelley-adira/allcodegooglesheets/pull/26).

#### PR-Level Reviews
| Reviewer | State | Date | Summary |
|---|---|---|---|
| copilot-pull-request-reviewer[bot] | COMMENTED | 2026-02-19T13:49:09Z | 4 files reviewed, 1 comment generated. 3 low-confidence comments suppressed. Resolves Phase 7D open questions via new config surfaces. |
| ckelley-adira | COMMENTED | 2026-02-19T13:49:41Z | *(no review body — applied feedback via inline thread)* |

#### Inline Code Review Comments

**Thread 1** — `SetupWizard.gs` line 780
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| SetupWizard.gs | 780 | copilot-pull-request-reviewer[bot] | 2026-02-19T13:49:09Z | The mixed-grade pooling logic makes assignments order-dependent when multiple grade configs belong to the same combination: the first grade processed will claim all students in `poolGrades`, and subsequent grades in the same pool will see zero unassigned students. This also hard-codes the group name prefix to the current `grade`, even when assigning students from other grades in the pool. Consider deduplicating by combination (process each pool once) and deriving both the group count and group naming from the combination definition so results are deterministic and match mixed-grade sheet expectations. |
| SetupWizard.gs | 780 | ckelley-adira | 2026-02-19T13:49:40Z | @copilot apply changes based on [this feedback](https://github.com/ckelley-adira/allcodegooglesheets/pull/26#discussion_r2828011097) |

*Resolved: No (noted for future work)*

#### Discussion Comments
| Commenter | Date | Comment |
|---|---|---|
| ckelley-adira | 2026-02-19T13:48:55Z | "@copilot are any changes needed based on your review of the code?" |
| Copilot | 2026-02-19T13:50:25Z | No changes needed. All 4 files reviewed and confirmed correct: SiteConfig_TEMPLATE.gs follows existing patterns; SetupWizard.gs gracefully degrades when mixedGradeSupport is off; ModuleLoader.gs preserves original defaults when no overrides configured; BUSINESS_RULES.md OQ-08 through OQ-12 properly documented. validate_shared_constants.js still passes. |

---

### PR #28 — Phase 7e: Consolidate SetupWizard files into unified parameterized module
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-19T14:36:47Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/28

**Description Summary:**
Extends canonical `SetupWizard.gs` (v4.0) to absorb all school-specific SetupWizard divergences. SiteConfig_TEMPLATE.gs: 6 new feature flags (`ufliMapQueue`, `syncQueueProcessing`, `nightlySyncAutomation` default ON, `syncStatusMonitoring`, `formulaRepairTools`, `studentEditCapability` default OFF). SetupWizard.gs: `getExistingLessonData()` now supports 2-arg and 3-arg calling conventions via `arguments.length` detection; adds co-teaching branch to `saveLessonData()` guarded by `coTeachingSupport` flag; `onOpen()` fully delegates to `buildFeatureMenu()`. Deprecation notices added to 5 school-specific files (no logic changes). See [full PR](https://github.com/ckelley-adira/allcodegooglesheets/pull/28).

#### PR-Level Reviews
| Reviewer | State | Date | Summary |
|---|---|---|---|
| ckelley-adira | APPROVED | 2026-02-19T14:32:37Z | *(no review body)* |
| copilot-pull-request-reviewer[bot] | COMMENTED | 2026-02-19T14:36:07Z | 7 files reviewed, 0 comments generated. All Phase 7e tasks complete: 6 feature flags, 2-arg/3-arg backward compatibility, co-teaching branch, onOpen delegation, 5 deprecation headers. |

#### Inline Code Review Comments
*No inline review comments.*

#### Discussion Comments
| Commenter | Date | Comment |
|---|---|---|
| ckelley-adira | 2026-02-19T14:34:19Z | "@copilot do you have any changes based on your code review?" |
| Copilot | 2026-02-19T14:35:31Z | Code review flagged 3 items. Two addressed in commit `bea39e4`: switched to `arguments.length` for 2-arg/3-arg detection in `getExistingLessonData()`, and optimized `progressRows` to conditionally build 6 or 7 columns instead of always 7. Third item (duplicated `student.sourceGroup || groupName` fallback) is intentional — matches Sankofa's original pattern; the two blocks serve different purposes. No further changes needed. |

---

### PR #30 — Phase 7f: Expand SetupWizardUI & SiteConfig
**State:** Open
**Author:** Copilot
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/30

**Description Summary:**
Closes the gap where Phase 7 unified modules consume runtime config from SITE_CONFIG but the Setup Wizard didn't collect all those values. SiteConfig_TEMPLATE.gs: adds `gradeRangeModel` ("prek_only", "k5", "k8", "prek_8", "custom") and `layout` block. SetupWizard.gs: new CONFIG_LAYOUT constants (`GRADE_RANGE_MODEL_ROW: 3`, `DATA_START_ROW_CONFIG_ROW: 32`, `LESSON_COLUMN_OFFSET_ROW: 33`), `getWizardData()` returns new fields, persist/load all new fields. SetupWizardUI.html: Step 2 adds Grade Range Model dropdown with GRADE_RANGE_PRESETS map auto-selection; Step 6 adds 4 new security/system checkboxes; Step 8 adds `dataStartRow` and `lessonColumnOffset` inputs; `loadExistingData()` round-trips all new fields. Adds PHASE7F_SETUP_WIZARD_EXPANSION.md. See [full PR](https://github.com/ckelley-adira/allcodegooglesheets/pull/30).

#### PR-Level Reviews
*No PR-level reviews submitted.*

#### Inline Code Review Comments
*No inline review comments.*

#### Discussion Comments
| Commenter | Date | Comment |
|---|---|---|
| ckelley-adira | 2026-02-19T16:49:31Z | "@copilot any changes required from your code review?" |

---

### PR #31 — docs: Add Technology Current State document for vendor review
**State:** Merged
**Author:** Copilot
**Merged:** 2026-02-19T16:42:33Z
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/31

**Description Summary:**
Adds `TECH_CURRENT_STATE.md` — a vendor-ready technology assessment document for a funder-facing Technology Review (February 2026). 11 structured sections: organizational context, tech stack, application architecture, UI architecture, data architecture, security controls, integration landscape, strengths, technical debt, and consolidation roadmap (Phases 1–7c). Includes technology risk summary table and glossary (7 terms). Key constraints honored: no specific school/site names (all referenced generically as "Partner Site A" etc.), honest treatment of limitations, Google Docs-compatible Markdown.

#### PR-Level Reviews
| Reviewer | State | Date | Summary |
|---|---|---|---|
| copilot-pull-request-reviewer[bot] | COMMENTED | 2026-02-19T16:47:51Z | 278-line vendor-facing technology doc reviewed. 4 inline comments generated. |

#### Inline Code Review Comments

**Thread 1** — `TECH_CURRENT_STATE.md` line 143
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| TECH_CURRENT_STATE.md | 143 | copilot-pull-request-reviewer[bot] | 2026-02-19T16:47:50Z | The filename "AdelanteSyncQueueProcessor.gs" contains a specific school name ("Adelante"), violating the constraint that no specific school/site names appear in this vendor-facing document. Generalize or describe without using the school-specific filename. Suggestion: "A **sync queue architecture** (implemented via a dedicated queue processor module) is used to handle long-running operations by batching them across multiple executions" |

*Resolved: No*

---

**Thread 2** — `TECH_CURRENT_STATE.md` line 153
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| TECH_CURRENT_STATE.md | 153 | copilot-pull-request-reviewer[bot] | 2026-02-19T16:47:51Z | The filename "AdelanteNameValidator.gs" contains a specific school name, violating the vendor-facing constraint. Suggestion: "**Input validation**: A server-side name field validation module provides name field validation" |

*Resolved: No*

---

**Thread 3** — `TECH_CURRENT_STATE.md` line 23
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| TECH_CURRENT_STATE.md | 23 | copilot-pull-request-reviewer[bot] | 2026-02-19T16:47:51Z | The Table of Contents lists 12 numbered items, but the Glossary (item 12) should typically not be numbered as a main section. Standard document structure treats glossaries, appendices, and similar reference sections separately from numbered main sections. |

*Resolved: No*

---

**Thread 4** — `TECH_CURRENT_STATE.md` line 56
| File | Line | Reviewer | Date | Comment |
|---|---|---|---|---|
| TECH_CURRENT_STATE.md | 56 | copilot-pull-request-reviewer[bot] | 2026-02-19T16:47:51Z | The repository name "ckelley-adira/allcodegooglesheets" includes what appears to be a personal GitHub username. For a vendor-facing document intended for funder review, consider whether this level of specificity is appropriate. If the organization has or plans to have an organizational GitHub account, consider referencing the repository more generically. |

*Resolved: No*

#### Discussion Comments
*No discussion comments on this PR.*

---

### PR #32 — [WIP] docs: Collect and publish full code review comment history
**State:** Open (Draft — this PR)
**Author:** Copilot
**URL:** https://github.com/ckelley-adira/allcodegooglesheets/pull/32

**Description Summary:**
Collects all code review comments from every pull request in the repository and assembles them into this `CODE_REVIEW_HISTORY.md` document. See [full PR](https://github.com/ckelley-adira/allcodegooglesheets/pull/32) for the original objective and task specification.

#### PR-Level Reviews
*No PR-level reviews submitted (this PR is in progress).*

#### Inline Code Review Comments
*No inline review comments.*

#### Discussion Comments
*No discussion comments.*

*No review comments on this PR (self-referential — this is the document being generated).*

---

*End of Code Review History*
