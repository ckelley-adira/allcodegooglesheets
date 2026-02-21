# DIVERGENCE ANALYSIS: Phase2 × MixedGradeSupport × SetupWizard

> **Prepared:** February 2026  
> **Scope:** Function-by-function overlap, constant collisions, write-strategy divergence, and refactoring recommendations  
> **Files analyzed:**
> | Abbreviation | File | Lines |
> |---|---|---|
> | **P2** | `gold-standard-template/Phase2_ProgressTracking.gs` | 2,558 |
> | **MG** | `gold-standard-template/modules/MixedGradeSupport.gs` | 2,201 |
> | **SW** | `gold-standard-template/SetupWizard.gs` | 2,906 |
> | **SE** | `gold-standard-template/SharedEngine.gs` | 664 |
> | **SEC** | `gold-standard-template/SharedEngine_Core.gs` | 639 |
> | **SC** | `gold-standard-template/SharedConstants.gs` | 141 |

---

## Section 1: Executive Summary

The three largest files in the gold-standard template — Phase2_ProgressTracking.gs (P2), MixedGradeSupport.gs (MG), and SetupWizard.gs (SW) — collectively contain ~7,665 lines, of which an estimated **800–1,100 lines** are duplicated or near-duplicated logic across file boundaries.

The overlap falls into five critical categories:
1. **Group-sheet update functions** that implement three incompatible write strategies (TextFinder, cached arrays, and format-aware dispatch).
2. **Pacing/scanning functions** duplicated between P2 and MG with subtle denominator and absent-rate formula divergences.
3. **Student-lookup and sheet-data-as-map helpers** redefined with differing empty-sheet guards.
4. **Utility functions** (`extractLessonNumber`, `normalizeStudent`, `naturalSort`, `getExistingGrades`, `formatPercent`/`formatGrowth`/`formatDate`) duplicated across files with different implementations.
5. **The `LAYOUT` constant** defined in both P2 (as a rich object with 10+ properties) and SW (as a reference to `CONFIG_LAYOUT.ROSTER` with only 4 properties), creating a **guaranteed runtime collision** in the GAS flat namespace.

When one file's function is modified — say, the absent-rate denominator in `processPacing_Standard` — the other file's copy silently retains the old logic, producing inconsistent dashboard data. This is the most common class of production bug reported in the system.

**Estimated duplicated/divergent code:** ~950 lines (±150)

**Risk assessment:**
- **CRITICAL:** `LAYOUT` constant collision between P2 and SW — whichever file loads last wins. Currently both exist in production.
- **CRITICAL:** Three incompatible write strategies for group sheets create data inconsistency when form saves and sync run concurrently.
- **HIGH:** `getExistingGrades()` defined in both P2 (line 1927) and SW (line 592) with different logic — one reads Grade Summary, the other has a fallback-only implementation.
- **HIGH:** `naturalSort()` defined TWICE within MG itself (lines 1347 and 1600) with different regex patterns.
- **MEDIUM:** `extractLessonNumber()` in SW (line 2024) uses a broader regex than SE (line 436), causing edge-case mismatches.
- **MEDIUM:** Absent-rate denominator differs between P2's `scanGradeSheetsForPacing` (Y+N+A) and MG's `processPacing_Sankofa` (Y+N only for pass/fail, A/studentCount for absent).

**Recommendation summary:** **Option A (Extract Shared Primitives)** is the lower-risk, more incremental path. Create a `SharedHelpers_GroupData.gs` (~300 lines) extracting group-sheet traversal, pacing scan, and formatting utilities. Both P2 and MG would delegate to it. This eliminates ~80% of duplication with minimal structural change. Option B (full merge) is higher reward but carries significant migration risk.

---

## Section 2: Function-by-Function Overlap Catalog

### 2a. Pacing & Scanning

| Function | P2 | MG | SW | Classification | Divergence | Risk | Recommendation |
|---|---|---|---|---|---|---|---|
| `scanGradeSheetsForPacing` | L782–841 | — | — | BASE | N/A (base implementation) | — | Extract core loop |
| `scanGradeSheetsForPacing_MixedGrade` | — | L913–957 | — | DIVERGENT | Delegates to format-specific processors; builds sheet list differently (includes MIXED_GRADE_CONFIG keys + SC Classroom); same `buildDashboardRow` call | HIGH | Merge into single parameterized `scanGradeSheetsForPacing(options)` |
| `processPacing_Standard` | — | L1037–1100 | — | SIMILAR to P2:782 | Nearly identical inner loop to P2 `scanGradeSheetsForPacing` lines 795–837. Key difference: uses `isGroupHeader_Standard()` instead of inline `cellA.includes("Group")` check; absent-rate uses `studentCount > 0 ? log_A / studentCount : 0` (per-student) vs P2's `totalResp > 0 ? log_A / totalResp : 0` (per-response) | **CRITICAL** | Unify absent-rate formula; extract shared inner loop |
| `processPacing_Sankofa` | — | L962–1021 | — | UNIQUE | Sankofa-specific format; same denominator divergence as above | MEDIUM | Keep as format variant but fix denominator |
| `processPacing_SCClassroom` | — | L1028–1032 | — | WRAPPER (deprecated) | Just calls `processPacing_Standard` | LOW | Remove |
| `buildDashboardRow` | L848–876 | (calls P2's) | — | SHARED | MG calls P2's version directly | LOW | Already shared — good |
| `buildProgressHistory` | L759–780 | — | — | UNIQUE to P2 | No MG equivalent | LOW | Keep in P2 |

**Detailed divergence — absent-rate denominator:**

P2 `scanGradeSheetsForPacing` (line 831–832):
```javascript
const totalResp = log_Y + log_N + log_A;
// ... log_A / totalResp (absent rate = A as fraction of all responses)
```

MG `processPacing_Standard` (line 1083–1090):
```javascript
const total = log_Y + log_N;  // ← A excluded from denominator
// passRate = log_Y / total, failRate = log_N / total
// absentRate = log_A / studentCount  // ← different denominator entirely!
```

This means the same group's absent rate will differ depending on which code path executes, which depends on whether `ENABLE_MIXED_GRADES` is true.

---

### 2b. Group Sheet Updates

| Function | P2 | MG | SW | Classification | Divergence | Risk | Recommendation |
|---|---|---|---|---|---|---|---|
| `updateGroupArrayByLessonName` | L1204–1280 | — | — | BASE | Cached array approach; finds group header via `cellA.toUpperCase() === cleanGroupName`; sets `cache.dirty = true`; lesson match by exact name then by lesson number | — | Extract core traversal |
| `updateGroupArrayByLessonName_MixedGrade` | — | L742–786 | — | DIVERGENT | Searches ALL cached sheets (not just one by grade prefix); delegates to format-specific `updateGroupArray_Standard` / `updateGroupArray_Sankofa` | HIGH | Merge: P2 should delegate to MG when mixed grades enabled |
| `updateGroupArray_Standard` | — | L852–903 | — | SIMILAR to P2:1204 | Core logic nearly identical to P2 `updateGroupArrayByLessonName` lines 1219–1279. Differences: (1) case-sensitive group match `cellA === groupName` vs P2's `toUpperCase()` comparison, (2) stop condition uses `isGroupHeader_Standard()` vs `cellA.includes("GROUP")`, (3) lesson name is already uppercased when passed in | **HIGH** | Extract shared `findGroupAndUpdateCell(data, groupName, studentName, lessonName, status, format)` |
| `updateGroupArray_Sankofa` | — | L791–847 | — | UNIQUE | Sankofa format: searches column D for group name, different lesson row offset | MEDIUM | Keep as format variant |
| `updateGroupArrayInMemory` | L1281–1329 | — | — | SIMILAR to P2:1204 | Matches by lesson NUMBER instead of lesson NAME; otherwise identical traversal. Unclear if still called anywhere. | LOW | Deprecate — `updateGroupArrayByLessonName` supersedes this |
| `updateGroupSheetTargeted` | — | — | L2211–2304 | DIVERGENT | Completely different strategy: TextFinder + direct Range writes (not cached array). Reads sheet live, builds statusMap, writes batch. No `cache.dirty` flag. | **CRITICAL** | See Section 4 |
| `addStudentToSheet` | L2222–2231 | — | L1413–1437 | **NAME COLLISION** | P2: feature-flagged, simple appendRow. SW: full implementation with formula insertion for UFLI MAP, Skills, Grade Summary. Completely different function bodies sharing same name. | **CRITICAL** | Rename P2's to `addStudentToSheet_Dynamic` or remove (it's feature-gated) |
| `updateStudentInSheet` | L2237–2245 | — | L1399–1411 | **NAME COLLISION** | P2: feature-flagged, stub with `// Implementation details...` comment. SW: full implementation with findIndex + setValues. | **CRITICAL** | Remove P2's stub |

---

### 2c. School Summary / Dashboard

| Function | P2 | MG | SW | Classification | Divergence | Risk | Recommendation |
|---|---|---|---|---|---|---|---|
| `updateSchoolSummary` | L1352–1438 | — | — | BASE | Full GAS-native rendering: `getOrCreateSheet`, render header, loop grades, render grade cards, conditionally calls `renderMixedGradeGroupTable` | — | Keep as primary |
| `updateSchoolSummary_MixedGrade` | — | L1808–1881 | — | DIVERGENT | Completely independent implementation: builds `outputRows` array, calls `buildGradeMetrics`, uses `getGradesFromConfig` (not `getExistingGrades`), writes entire sheet in one `setValues` call. Different data sources (reads Student Roster vs Grade Summary). | **HIGH** | Choose one. P2's is more mature and already integrates MG via `renderMixedGradeGroupTable`. MG's version appears to be a dead-code alternative. |
| `renderMixedGradeGroupTable` | — | L2027–2162 | — | UNIQUE | Renders group performance table with grade mapping from Group Configuration. Called by P2's `updateSchoolSummary` when mixed grades enabled. | MEDIUM | Keep — well-integrated |
| `renderGroupTable` | L887–979 | — | — | SIMILAR to MG:2027 | 7-column layout (Group, Grade, Students, Pacing, Pass Rate, Absent Rate, Status). Same status thresholds, same alternating-row colors, same flagged-groups summary. | HIGH | `renderMixedGradeGroupTable` is the superset (adds Grades column from config). Merge. |
| `renderDashboardHeader` | L1444–1498 | — | — | UNIQUE to P2 | MG's `updateSchoolSummary_MixedGrade` hardcodes equivalent header rows inline | MEDIUM | P2's is better factored |
| `renderGradeCard` | L1518–1572 | — | — | UNIQUE to P2 | MG's version builds grade cards as array rows inline | MEDIUM | Keep P2's |
| `renderMetricsRow` | L1577–1681 | — | — | UNIQUE to P2 | MG hardcodes equivalent inline | LOW | Keep P2's |
| `renderDistributionSection` | L1688–1709 | — | — | UNIQUE to P2 | MG hardcodes equivalent inline | LOW | Keep P2's |
| `renderProgressBar` | L1711–1756 | — | — | UNIQUE to P2 | No MG equivalent (MG uses text-only distribution) | LOW | Keep in P2 |
| `calculateGrowthMetrics` | L1762–1847 | — | — | UNIQUE to P2 | MG's `buildGradeMetrics` (L1954–2002) is a simplified version reading from Student Roster instead of Grade Summary | MEDIUM | P2's is authoritative |
| `calculateDistributionBands` | L1871–1880 | — | — | UNIQUE to P2 | MG inlines equivalent in `getDefaultGradeMetrics` structure | LOW | Keep |
| `calculateGradePacing` | L1882–1905 | — | — | UNIQUE to P2 | No MG equivalent | LOW | Keep |
| `buildGroupPerformanceSection_MixedGrade` | — | L1623–1745 | — | UNIQUE to MG | Builds rows array, reads from Pacing Dashboard. Referenced in `updateSchoolSummary_MixedGrade` but not in P2's `updateSchoolSummary` (which uses `renderMixedGradeGroupTable` instead). | LOW | Dead code if `updateSchoolSummary_MixedGrade` is deprecated |
| `applySchoolSummaryFormatting_MixedGrade` | — | L2004–2022 | — | UNIQUE to MG | Basic formatting — only used by `updateSchoolSummary_MixedGrade` | LOW | Dead code |
| `getGradeHeaderText_MixedGrade` | — | L1756–1764 | — | UNIQUE to MG | Returns grade header text. Both code paths return the same string. | LOW | Remove (no-op) |

---

### 2d. Sheet Repair / Formatting

| Function | P2 | MG | SW | Classification | Divergence | Risk | Recommendation |
|---|---|---|---|---|---|---|---|
| `repairAllGroupSheetFormatting` | L2074–2166 | — | — | BASE | Scans `(PreK\|KG\|G[1-8]) Groups` sheets; finds group headers by `cellA.includes("Group") && !cellA.includes("Student")` pattern; applies `applyStatusConditionalFormatting` | — | Extract sheet-list builder |
| `repairAllGroupSheetFormatting_MixedGrade` | — | L1110–1151 | — | DIVERGENT | Also scans MIXED_GRADE_CONFIG sheets + standard pattern; delegates to `formatSheet_Standard` / `formatSheet_Sankofa` | HIGH | Merge: P2 should delegate to MG when flag is on, OR extract shared sheet-list + formatting |
| `formatSheet_Standard` | — | L1198–1227 | — | SIMILAR to P2:2074 inner loop | Nearly identical group-finding + `applyStatusConditionalFormatting` call. Key difference: uses `isGroupHeader_Standard()` instead of inline check. | HIGH | Extract shared |
| `formatSheet_Sankofa` | — | L1153–1196 | — | UNIQUE | Sankofa-specific formatting | MEDIUM | Keep as variant |
| `repairSkillsTrackerFormulas` | L2019–2030 | — | — | UNIQUE to P2 | Calls `updateAllStats` | LOW | Keep |
| `repairGradeSummaryFormulas` | L2032–2043 | — | — | UNIQUE to P2 | Calls `updateAllStats` (identical to above) | LOW | Merge with above |
| `repairAllFormulas` | L2045–2048 | — | — | UNIQUE to P2 | Calls `syncSmallGroupProgress` | LOW | Keep |
| `repairUFLIMapFormatting` | L2055–2063 | — | — | UNIQUE to P2 | Clears + reapplies conditional formatting | LOW | Keep |

---

### 2e. Data Extraction

| Function | P2 | MG | SW | Classification | Divergence | Risk | Recommendation |
|---|---|---|---|---|---|---|---|
| `getGroupsForForm` | — | — | L1779–1781 | WRAPPER | Delegates to `getGroupsForForm_MixedGrade()` | LOW | Good |
| `getGroupsForForm_MixedGrade` | — | L258–409 | — | UNIQUE to MG | 150-line function: reads Group Configuration, scans all group sheets (mixed + standard + SC Classroom + Pre-K), supports SANKOFA format | — | Keep |
| `getGroupsFromConfiguration` | — | — | L1783–1809 | UNIQUE to SW | Simpler: reads Group Configuration, generates group names from grade+count. Does NOT scan actual sheets. | MEDIUM | May return phantom groups not in sheets |
| `getGroupsAndSheets_MixedGrade` | — | L1464–1593 | — | UNIQUE to MG | 130-line function: returns `{groups, groupsBySheet}` organized mapping | — | Keep |
| `getLessonsAndStudentsForGroup` | — | — | L1811–1812 | WRAPPER | Delegates to `getLessonsAndStudentsForGroup_MixedGrade()` | LOW | Good |
| `getLessonsAndStudentsForGroup_MixedGrade` | — | L418–455 | — | UNIQUE to MG | Format-aware dispatcher: handles PreK, G6 to G8, standard/Sankofa | — | Keep |
| `getLessonsAndStudents_Standard` | — | L614–689 | — | UNIQUE to MG | Standard format parser with Grade column detection | — | Keep |
| `getLessonsAndStudents_Sankofa` | — | L534–607 | — | UNIQUE to MG | Sankofa format parser | — | Keep |
| `getLessonsForGrade` | — | — | L1815–1840 | UNIQUE to SW | Returns LESSON_LABELS for a grade range | LOW | Keep |
| `getExistingLessonData` | — | — | L1853–2017 | UNIQUE to SW | 165-line function with improved fuzzy matching. Uses `getSheetNameForGroup()` from MG. | — | Keep |
| `getPreKStudentsByGroup` | — | — | L2534–2593 | UNIQUE to SW | Pre-K specific | LOW | Keep |
| `getPreKSequences` | — | — | L2594–2682 | UNIQUE to SW | Pre-K specific | LOW | Keep |

---

### 2f. Student Lookup / Sheet Data Maps

| Function | P2 | MG | SW | Classification | Divergence | Risk | Recommendation |
|---|---|---|---|---|---|---|---|
| `buildStudentLookups` | L686–757 | — | — | UNIQUE to P2 | Returns `{studentCountByGroup, teacherByGroup}` Maps. Reads Group Configuration (row 8+) for counts, Grade Summary for teachers. Supports `mapSheet` param for CCA approach. | — | Keep |
| `getSheetDataAsMap` | L1910–1925 | — | L1763–1773 | **NAME COLLISION** | P2: iterates with for-loop from `LAYOUT.DATA_START_ROW - 1`, uses `data[i][0].toString()` key. SW: uses `data.slice()` + `new Map(dataRows.filter().map())`. Different empty-sheet guards: P2 returns empty Map if no sheet, SW returns empty Map if sheet exists but `lastRow < DATA_START_ROW`. **Both produce the same output for valid data.** | **HIGH** | Remove one; they're functionally equivalent but P2's has subtly different behavior on edge cases (no DATA_START_ROW check before reading all data). |
| `getExistingGrades` | L1927–1958 | — | L592–616 | **NAME COLLISION** | P2: reads Grade Summary column B, deduplicates, sorts by grade order. Handles case where `configSheet` param is passed but unused. SW: has different signature handling — if `configSheet` is invalid, reads Grade Summary similarly. If `configSheet` IS valid, returns hardcoded full list `['PreK', 'KG', 'G1'...]`. **Different fallback behavior.** | **HIGH** | Merge: P2's is the more useful version. SW's should delegate. |
| `getGradesFromConfig` | — | L1929–1952 | — | UNIQUE to MG | Reads Group Configuration sheet, parses comma-separated grade strings. Different data source than P2/SW versions. | MEDIUM | Used only by `updateSchoolSummary_MixedGrade` — may be dead code |
| `getSiteName` | — | L1916–1927 | — | UNIQUE to MG | Reads "School Name" from Site Configuration by searching rows | LOW | P2 reads `configSheet.getRange(2, 2)` directly (line 1373–1374). Different approach. |
| `getTeacherForGroup` | — | — | L316–336 | UNIQUE to SW | Reads UFLI MAP / Pre-K Data for teacher lookup | LOW | P2's `buildStudentLookups` serves similar purpose but batch | 
| `getGradeCountsFromConfig` | L2330–2352 | — | — | UNIQUE to P2 | Reads Group Configuration col B (Grade) + col D (Count) | LOW | Keep |
| `buildGradeMetrics` | — | L1954–2002 | — | UNIQUE to MG | Reads Student Roster, builds per-grade metrics. Simplified — all students start as "needsSupport". | LOW | Inferior to P2's `calculateGrowthMetrics`. Likely dead code. |

---

### 2g. Utility Functions

| Function | P2 | MG | SW | SE | SEC | Classification | Divergence | Risk | Recommendation |
|---|---|---|---|---|---|---|---|---|---|
| `normalizeStudent` | L345–355 | — | — | L447–452 | L477 | **TRIPLE DEFINITION** | P2: returns `{name, grade, teacher, group}` with feature flag guard. SE: returns `{...student, name: trimmed}` (spread + just trims name). SEC: same as SE. P2's version **strips all non-standard fields**; SE's **preserves them**. | **HIGH** | P2's is the authoritative production version. Delete from SE/SEC. |
| `extractLessonNumber` | — | — | L2024–2036 | L436–440 | L466 | **TRIPLE DEFINITION** | SW: broader regex `(?:LESSON\s*\|L\s*\|UFLI\s*L?\s*)?(\d{1,3})`, validates 1–128 range, handles null/undefined. SE: simpler `/L(\d+)/` regex, no range validation, no null guard. SW handles "Lesson 5" and plain "5"; SE does not. | **HIGH** | SW's is the most robust. Promote to SE, delete from SW. |
| `naturalSort` | — | L1347, L1600 | — | — | — | **DUPLICATE WITHIN FILE** | First definition (L1347): `a.match(/^(\d+)/)` — matches leading digits. Second definition (L1600): `a.match(/\d+/)` — matches first digits anywhere. GAS loads last definition. **Inconsistent behavior depending on file parse order.** | **CRITICAL** | Remove duplicate; keep one in shared module |
| `log` | (calls SE's) | — | — | L488–490 | — | UNIQUE to SE | Format: `[LEVEL] functionName: message` | LOW | Keep |
| `logMessage` | — | — | L260–262 | — | — | UNIQUE to SW | Format: `[LEVEL] [functionName] message` — different bracket style | LOW | Consolidate with `log` |
| `formatPercent` | — | L1901–1904 | — | — | — | UNIQUE to MG | Formats decimal to "N%" | LOW | Extract to shared |
| `formatGrowth` | — | L1906–1910 | — | — | — | UNIQUE to MG | Formats decimal to "+N%" | LOW | Extract to shared |
| `formatDate` | — | L1912–1914 | — | — | — | UNIQUE to MG | Simple M/D/YYYY format | LOW | SW has `formatDateSafe` (L270) using Utilities.formatDate with timezone. Prefer SW's. |
| `formatDateSafe` | — | — | L270–274 | — | — | UNIQUE to SW | Timezone-aware date formatting | LOW | Promote to shared |
| `isGroupHeader_Standard` | — | L195–216 | — | — | — | UNIQUE to MG | Checks for group header pattern + validates next row is "Student Name". Also handles numbered-teacher pattern `^\d+\s*-\s*.+$` | — | Extract to shared — P2 inlines this logic repeatedly |
| `getSheetNameForGrade` | — | L100–114 | — | — | — | UNIQUE to MG | Grade → sheet name mapping respecting MIXED_GRADE_CONFIG | — | Keep |
| `getSheetNameForGroup` | — | L116–190 | — | — | — | UNIQUE to MG | Group → sheet name mapping. 75-line function with multiple fallbacks. Called by SW's `getExistingLessonData`. | — | Keep; critical integration point |
| `getOrCreateSheet` | (calls SE's) | — | — | L470–480 | — | UNIQUE to SE | Shared properly | LOW | Good |
| `createResult` | — | — | L283–289 | — | — | UNIQUE to SW | Standardized return object | LOW | Keep |
| `validateRequiredProps` | — | — | L297–308 | — | — | UNIQUE to SW | Validation helper | LOW | Keep |

---

### 2h. Sheet Creation

| Function | P2 | MG | SW | Classification | Divergence | Risk | Recommendation |
|---|---|---|---|---|---|---|---|
| `createGradeGroupSheets` | L528–541 | — | — | UNIQUE to P2 | Creates standard single-grade sheets by iterating wizardData.groups | — | Keep |
| `createSingleGradeSheet` | L543–601 | — | — | UNIQUE to P2 | Creates one grade sheet with groups, headers, conditional formatting. Uses `createHeader` (non-merged). | — | Keep |
| `createMixedGradeGroupSheets` | — | L1238–1253 | — | UNIQUE to MG | Creates mixed-grade sheets. Falls back to `createGradeGroupSheets` if mixed grades disabled. | — | Keep |
| `createMixedGradeSheet` | — | L1268–1340 | — | SIMILAR to P2:543 | Nearly identical to `createSingleGradeSheet` (~60 lines overlap). Key differences: (1) uses `createMergedHeader` instead of `createHeader` (merged vs non-merged group header), (2) uses `getOrCreateSheet` without clear param (manually clears). Same column layout, same conditional formatting, same frozen rows. | **HIGH** | Extract shared `createGroupSheetLayout(sheet, groupNames, allStudents, options)` with `mergeHeaders` option |
| `getGroupsForMixedSheet` | — | L1255–1266 | — | UNIQUE to MG | Filters students by grade set, returns unique groups | LOW | Keep |
| `generateSystemSheets` | L400–422 | — | — | UNIQUE to P2 | Orchestrator for all system sheet creation | LOW | Keep |

---

## Section 3: Constants & Configuration Overlap

| Constant | P2 (line) | MG (line) | SW (line) | SE (line) | Values Identical? | Risk of Drift |
|---|---|---|---|---|---|---|
| **`LAYOUT`** | L97–111 (rich object: DATA_START_ROW=6, HEADER_ROW_COUNT=5, LESSON_COLUMN_OFFSET=5, TOTAL_LESSONS=128, etc.) | — (uses P2's) | L248 (alias for `CONFIG_LAYOUT.ROSTER`: TITLE_ROW=1, INSTRUCTIONS_ROW=2, HEADER_ROW=4, DATA_START_ROW=6) | — | **NO** — completely different shapes. P2 has 10 properties; SW has 4 properties. Both use `const LAYOUT`. | **CRITICAL** — GAS flat namespace means one overwrites the other. P2's code references `LAYOUT.TOTAL_LESSONS`, `LAYOUT.COL_STUDENT_NAME`, etc. which don't exist on SW's `LAYOUT`. If SW loads last, P2 breaks silently. |
| `SHEET_NAMES_V2` | L66–73 | — (uses P2's) | — | — | N/A | LOW |
| `SHEET_NAMES` | — | — | L37–43 | — | N/A | LOW — different constant name |
| `SHEET_NAMES_PREK` | L79–81 | — | — | — | N/A | LOW |
| `SHEET_NAMES_PACING` | L92–95 | — | — | — | N/A | LOW |
| `COLORS` | L113–123 | — (uses P2's) | — | — | N/A | LOW |
| `DASHBOARD_COLORS` | L125–146 | — (uses P2's) | — | — | N/A | LOW — but MG references it without defining or importing |
| `COLS` | L154–197 | — | — | — | N/A | LOW |
| `PREK_CONFIG` | L83–90 | — | — | — | N/A | LOW |
| `GRADE_METRICS` | L216 (alias for `SHARED_GRADE_METRICS`) | — | — | — | N/A | LOW |
| `ENABLE_MIXED_GRADES` | — | L36–38 | — | — | N/A | LOW |
| `SHEET_FORMAT` | — | L45 | — | — | N/A | LOW |
| `MIXED_GRADE_CONFIG` | — | L60–65 | — | — | N/A | LOW |
| `SANKOFA_COLUMNS` | — | L71–77 | — | — | N/A | LOW |
| `GROUP_NAMING_PATTERN` | — | L87 | — | — | N/A | LOW |
| `SYSTEM_VERSION` | — | — | L31 | — | N/A | LOW |
| `GRADE_OPTIONS` | — | — | L48–59 | — | N/A | LOW |
| `FEATURE_OPTIONS` | — | — | L65+ | — | N/A | LOW |
| `CONFIG_LAYOUT` | — | — | L210–244 | — | N/A | LOW |
| `RECOMMENDED_GROUP_SIZE` | — | — | L169–173 | — | N/A | LOW |

### Critical Finding: `LAYOUT` Collision

Both P2 and SW define `const LAYOUT` at the top level:

**P2 (line 97):**
```javascript
const LAYOUT = {
  DATA_START_ROW: 6,
  HEADER_ROW_COUNT: 5,
  LESSON_COLUMN_OFFSET: 5,
  TOTAL_LESSONS: 128,
  LESSONS_PER_GROUP_SHEET: 12,
  COL_STUDENT_NAME: 1,
  COL_GRADE: 2,
  COL_TEACHER: 3,
  COL_GROUP: 4,
  COL_CURRENT_LESSON: 5,
  COL_FIRST_LESSON: 6
};
```

**SW (line 248):**
```javascript
const LAYOUT = CONFIG_LAYOUT.ROSTER;
// Resolves to: { TITLE_ROW: 1, INSTRUCTIONS_ROW: 2, HEADER_ROW: 4, DATA_START_ROW: 6 }
```

In GAS flat namespace, **only one can exist**. The `const` keyword will cause a runtime error ("Identifier 'LAYOUT' has already been declared") when both files are in the same project. This is a **blocking deployment bug** if both files are deployed together.

---

## Section 4: Write Strategy Divergence (Critical)

Three different write strategies exist for updating group sheet cells:

### Strategy 1: SetupWizard → TextFinder + Direct Writes

**Entry point:** `saveLessonData()` (SW:2058) → `updateGroupSheetTargeted()` (SW:2211)

**Flow:**
```
saveLessonData(formData)
  → progressSheet.getRange().setValues(progressRows)     // Log to Small Group Progress
  → updateGroupSheetTargeted(ss, gradeSheet, group, lesson, statuses)
      → sheet.createTextFinder(groupName).findNext()      // TextFinder to locate group
      → sheet.getRange(row, 1, 1, lastCol).getValues()    // Read 1-3 rows to find lesson column
      → rangeLesson.setValues(valuesLesson)                // Direct write to lesson column
  → addToSyncQueue(...)                                    // Queue UFLI MAP update for later
```

**Trade-offs:**
- ✅ Fast (~3-4 seconds per save)
- ✅ Surgical — only touches the specific cells
- ✅ TextFinder handles both Standard and Sankofa layouts
- ❌ Does NOT update UFLI MAP immediately (deferred)
- ❌ No `cache.dirty` mechanism — writes immediately
- ❌ Can conflict with concurrent `syncSmallGroupProgress` runs

### Strategy 2: Phase2 → Cached Arrays + Batch Writes

**Entry point:** `syncSmallGroupProgress()` (P2:1005)

**Flow:**
```
syncSmallGroupProgress()
  → progressSheet.getDataRange().getValues()              // Read ALL progress data
  → mapSheet.getRange().getValues()                        // Read ALL UFLI MAP data
  → groupSheetsData[sheetName] = { sheet, values, dirty: false }  // Cache group sheets
  → for each progress row:
      → mapData[rowIdx][colIdx] = status                   // Update MAP array in memory
      → updateGroupArrayByLessonName(groupSheetsData, ...)  // Update group array in memory
          → data[k][lessonColIdx] = status; cache.dirty = true
  → mapSheet.setValues(mapData)                            // Batch write MAP
  → groupSheetsData.forEach(cache => {
      if (cache.dirty) cache.sheet.setValues(cache.values) // Batch write dirty group sheets
    })
  → updateAllStats(ss, mapData, config)                    // Chain reaction: update stats
```

**Trade-offs:**
- ✅ Atomic — all changes written together
- ✅ Efficient for full-sync scenarios
- ✅ Stats are always up-to-date after sync
- ❌ Slow for single-lesson saves (~16 seconds)
- ❌ Reads ALL data even when only 1 lesson changed
- ❌ Can overwrite TextFinder changes if both run simultaneously

### Strategy 3: MixedGradeSupport → Immediate Per-Update Writes

**Entry point:** `updateGroupArrayByLessonName_MixedGrade()` (MG:742) — called from within P2's sync

**Flow:**
```
syncSmallGroupProgress() [P2:1005]
  → updateGroupArrayByLessonName_MixedGrade(groupSheetsData, ...) [MG:742]
      → for each cached sheet:
          → search ALL rows for groupName                  // Scans every sheet, not just grade-matched
      → if SANKOFA: updateGroupArray_Sankofa(cache, ...)
      → if STANDARD: updateGroupArray_Standard(cache, ...)
          → data[k][lessonColIdx] = status; cache.dirty = true
```

This is actually **not** a separate write strategy — it modifies the same `groupSheetsData` cache used by P2's Strategy 2. The key difference is how it **finds** the correct sheet (searches all cached sheets vs P2's grade-prefix matching).

### Conflict Scenario

1. Teacher opens lesson entry form, submits data at 2:30 PM
2. `saveLessonData` (Strategy 1) fires: writes to group sheet via TextFinder, queues MAP update
3. Nightly trigger fires `runFullSyncDeferred` → `syncSmallGroupProgress` (Strategy 2)
4. Sync reads group sheet — sees the TextFinder write from step 2 ✅
5. Sync reads ALL progress rows, writes ALL data back — including data from step 2 ✅
6. **But:** If two teachers submit simultaneously, TextFinder writes can race with each other (no locking)

### Recommended Unified Approach

**Adopt Strategy 1 (TextFinder + Direct Writes) as the primary real-time path, and Strategy 2 (Full Sync) as the reconciliation path.** This is essentially what the current code does, but:

1. Remove Strategy 2's group-sheet updates from `syncSmallGroupProgress` — the form already handles them
2. Keep `syncSmallGroupProgress` for UFLI MAP and stats only
3. Add a lightweight conflict-detection mechanism: before TextFinder write, check if the cell already has the expected value

---

## Section 5: Proposed Shared Primitives

### Proposed file: `SharedHelpers_GroupData.gs` (~300 lines)

| # | Proposed Function | Replaces | Parameters | Est. Lines Saved |
|---|---|---|---|---|
| 1 | `findGroupInSheetData(data, groupName, format)` → `{groupStartRow, subHeaderRowIdx, studentStartRow}` | P2:1224–1231, MG:852–862 (Standard), MG:796–826 (Sankofa), SW:1910–1943 | `data`: 2D array, `groupName`: string, `format`: "STANDARD"\|"SANKOFA" | ~80 lines |
| 2 | `findLessonColumn(subHeaderRow, lessonName, startCol)` → `colIdx` | P2:1242–1259, MG:870–886, SW:1953–1978 | `subHeaderRow`: array, `lessonName`: string, `startCol`: number (1 for Standard, SANKOFA_COLUMNS.LESSONS_START for Sankofa) | ~50 lines |
| 3 | `findStudentRowInGroup(data, studentStartRow, studentName, groupName, format)` → `rowIdx` | P2:1268–1279, MG:891–902, SW:1993–2010 | Standard stop conditions: empty row or next group header | ~40 lines |
| 4 | `updateCellInGroupSheet(cache, groupName, studentName, lessonName, status, format)` | Combines #1+#2+#3: P2:1204–1280, MG:852–903 | Handles both Standard and Sankofa | ~120 lines |
| 5 | `getGroupSheetList(ss, mixedGradeConfig, enableMixedGrades)` → `Sheet[]` | P2:2076–2079, MG:1114–1131, MG:919–944 | Returns array of sheets matching standard pattern + mixed-grade config | ~30 lines |
| 6 | `processGroupForPacing(sheetData, i, lookups, progressMap, format)` → `{dashboardRow, logRows}` | P2:795–837, MG:1043–1095 (Standard), MG:962–1021 (Sankofa) | Extracts the inner pacing loop | ~80 lines |
| 7 | `isGroupHeader(cellA, data, rowIndex, format)` | P2 inline checks, MG:195–216 | Unified group header detection for both formats | ~20 lines |
| 8 | `naturalSort(a, b)` | MG:1347, MG:1600 (duplicates!) | Standard natural sort | ~10 lines |

**Total estimated line savings across all three files:** ~430 lines of removed duplication

### Additional shared primitives for `SharedEngine.gs`:

| # | Function | Current Location | Notes |
|---|---|---|---|
| 9 | `extractLessonNumber(lessonText)` | SW:2024 (best version), SE:436, SEC:466 | Promote SW's version to SE; remove from SW and SEC |
| 10 | `normalizeStudent(student)` | P2:345 (best version), SE:447, SEC:477 | Keep P2's version; remove from SE and SEC |
| 11 | `formatPercent(value)` | MG:1901 | Move to SE |
| 12 | `formatGrowth(value)` | MG:1906 | Move to SE |
| 13 | `formatDateSafe(date, format)` | SW:270 | Move to SE (replaces MG's `formatDate`) |

---

## Section 6: Recommended Architecture

### Option A: Extract Shared Primitives (Recommended)

**Create `SharedHelpers_GroupData.gs`** containing the 8 shared primitives from Section 5. Both P2 and MG delegate to these primitives. SW continues to call MG functions for group lookups.

**Effort estimate:**
- New file: `SharedHelpers_GroupData.gs` (~300 lines)
- Modified files: P2 (~150 lines changed), MG (~200 lines changed), SW (~50 lines changed), SE (~30 lines changed)
- Total: ~730 lines touched across 5 files
- Estimated effort: **3–4 days** (including testing)

**Risk assessment:**
- LOW structural risk — no function signatures change for external callers
- MEDIUM testing risk — inner behavior must be validated for both Standard and Sankofa
- The `LAYOUT` collision must be resolved regardless of which option is chosen

**Migration path:**
1. Resolve `LAYOUT` collision first (rename SW's to `ROSTER_LAYOUT`)
2. Create `SharedHelpers_GroupData.gs` with extracted functions
3. Update P2 to delegate group-sheet traversal to shared helpers
4. Update MG to delegate to same shared helpers
5. Remove duplicate utility functions from MG (naturalSort, formatPercent, etc.)
6. Promote `extractLessonNumber` from SW to SE
7. Remove name-collision functions from P2 (`addStudentToSheet`, `updateStudentInSheet`, `getSheetDataAsMap`, `getExistingGrades`)
8. Fix absent-rate denominator to be consistent

**Testing strategy:**
- Run `validate_shared_constants.js` after each change
- Manual QA: Submit lesson data via form, verify group sheet + UFLI MAP + Pacing Dashboard all update correctly
- Test with both SHEET_FORMAT = "STANDARD" and "SANKOFA"
- Verify School Summary renders correctly with and without `ENABLE_MIXED_GRADES`

---

### Option B: Merge into Unified Engine

**Combine P2 and MG into a single `UnifiedProgressEngine.gs`** (~3,500 lines). Mixed-grade support becomes a first-class concept with format detection at the top level. SW continues as the UI layer.

**Effort estimate:**
- New file: `UnifiedProgressEngine.gs` (~3,500 lines — merging 2,558 + 2,201 minus ~1,200 overlap/dead code)
- Deleted files: P2, MG
- Modified files: SW (~100 lines for import path changes), SE (~30 lines)
- ModuleLoader.gs: Update feature flag registration
- Total: ~3,630 lines touched/created
- Estimated effort: **7–10 days** (including testing and regression)

**Risk assessment:**
- HIGH structural risk — every caller of P2 or MG functions must be verified
- HIGH testing risk — merged logic must handle all format combinations
- Potential for introducing bugs during merge of subtly different implementations
- Benefits: single source of truth, no more divergence risk, cleaner architecture

**Migration path:**
1. Resolve `LAYOUT` collision
2. Create `UnifiedProgressEngine.gs` starting from P2 as base
3. Add format-aware dispatch (Standard/Sankofa) to every group-sheet function
4. Port MG-unique functions (group lookup, SC Classroom, Pre-K helpers)
5. Remove dead code from MG (`updateSchoolSummary_MixedGrade`, `buildGroupPerformanceSection_MixedGrade`, `buildGradeMetrics`, etc.)
6. Delete P2 and MG
7. Update all references in SW, ModuleLoader, onOpen_Example

**Testing strategy:**
- All of Option A's testing, plus:
- Full regression test of every menu item
- Test with `ENABLE_MIXED_GRADES` = true AND false
- Test with `SHEET_FORMAT` = "STANDARD" AND "SANKOFA"
- Verify all feature flags still work (coachingDashboard, tutoringSystem, etc.)

---

## Section 7: Implementation Checklist

### Phase 0: Critical Bug Fixes (Do First, Regardless of Option)

- [ ] **Fix `LAYOUT` constant collision** — Rename SW's `LAYOUT` to `ROSTER_LAYOUT` or `SW_LAYOUT`. Update all SW references (grep for `LAYOUT.` in SW). This is a blocking deployment bug.
- [ ] **Remove duplicate `naturalSort` in MG** — Delete lines 1600–1610 (second definition). Keep lines 1347–1356 (first definition).
- [ ] **Fix `addStudentToSheet` name collision** — Rename P2's version (line 2222) to `addStudentToSheet_Dynamic` or delete it (it's a stub behind a feature flag).
- [ ] **Fix `updateStudentInSheet` name collision** — Delete P2's stub (line 2237, has only `// Implementation details...`).
- [ ] **Fix `getSheetDataAsMap` name collision** — Delete one copy. Recommend keeping SW's (more defensive). P2's callers (`updateSchoolSummary`) must verify.
- [ ] **Fix `getExistingGrades` name collision** — Make SW's version delegate to P2's, or merge logic.

### Phase 1: Extract Shared Primitives (Option A)

- [ ] Create `gold-standard-template/SharedHelpers_GroupData.gs`
- [ ] Extract `findGroupInSheetData(data, groupName, format)`
- [ ] Extract `findLessonColumn(subHeaderRow, lessonName, startCol)`
- [ ] Extract `findStudentRowInGroup(data, studentStartRow, studentName, groupName, format)`
- [ ] Extract `updateCellInGroupSheet(cache, groupName, studentName, lessonName, status, format)`
- [ ] Extract `getGroupSheetList(ss, mixedGradeConfig, enableMixedGrades)`
- [ ] Extract `processGroupForPacing(sheetData, i, lookups, progressMap, format)`
- [ ] Extract `isGroupHeader(cellA, data, rowIndex, format)` (promote MG's `isGroupHeader_Standard`)
- [ ] Move `naturalSort` to shared file
- [ ] Update P2 `updateGroupArrayByLessonName` to use shared primitives
- [ ] Update P2 `scanGradeSheetsForPacing` to use shared primitives
- [ ] Update P2 `repairAllGroupSheetFormatting` to use shared sheet-list builder
- [ ] Update MG `updateGroupArray_Standard` to use shared primitives
- [ ] Update MG `processPacing_Standard` to use shared primitives
- [ ] Update MG `repairAllGroupSheetFormatting_MixedGrade` to use shared sheet-list builder
- [ ] Fix absent-rate denominator in MG `processPacing_Standard` and `processPacing_Sankofa` to match P2's formula (Y+N+A denominator)

### Phase 2: Utility Consolidation

- [ ] Promote `extractLessonNumber` from SW (line 2024) to SE — delete from SW and SEC
- [ ] Keep `normalizeStudent` in P2 only — delete from SE and SEC
- [ ] Move `formatPercent`, `formatGrowth` from MG to SE
- [ ] Move `formatDateSafe` from SW to SE; delete MG's `formatDate`
- [ ] Consolidate `log` (SE) and `logMessage` (SW) — choose one name

### Phase 3: Dead Code Removal

- [ ] Remove `updateSchoolSummary_MixedGrade` (MG:1808–1881) — P2's `updateSchoolSummary` already handles mixed grades via `renderMixedGradeGroupTable`
- [ ] Remove `buildGroupPerformanceSection_MixedGrade` (MG:1623–1745) — only used by the dead `updateSchoolSummary_MixedGrade`
- [ ] Remove `applySchoolSummaryFormatting_MixedGrade` (MG:2004–2022) — only used by dead code
- [ ] Remove `getDefaultGradeMetrics` (MG:1888–1899) — only used by dead code
- [ ] Remove `buildGradeMetrics` (MG:1954–2002) — only used by dead code
- [ ] Remove `getGradeHeaderText_MixedGrade` (MG:1756–1764) — both code paths return the same string
- [ ] Remove `processPacing_SCClassroom` (MG:1028–1032) — deprecated wrapper
- [ ] Remove `getLessonsAndStudentsForSCClassroom` (MG:461–478) — deprecated
- [ ] Remove `updateGroupArrayInMemory` (P2:1281–1329) — superseded by `updateGroupArrayByLessonName`
- [ ] Remove `repairSkillsTrackerFormulas` or `repairGradeSummaryFormulas` (P2:2019–2043) — both call `updateAllStats` identically; merge into one function or keep `repairAllFormulas`

### Phase 4: Validation

- [ ] Run `node gold-standard-template/validate_shared_constants.js`
- [ ] Grep for any remaining duplicate `const` names across all `.gs` files
- [ ] Grep for any remaining duplicate `function` names across all `.gs` files
- [ ] Manual QA per `docs/QA_CHECKLIST.md`
- [ ] Test lesson entry form → save → verify group sheet + UFLI MAP
- [ ] Test full sync → verify School Summary + Pacing Dashboard
- [ ] Test with `ENABLE_MIXED_GRADES` = true and false
- [ ] Test with both Standard and Sankofa sheet formats

---

*End of Divergence Analysis. This document should be attached to the GitHub issue for the refactoring effort.*
