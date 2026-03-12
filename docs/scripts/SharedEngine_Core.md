# SharedEngine_Core.gs

## 📋 Overview

`SharedEngine_Core.gs` is the **pure-logic split** of `SharedEngine.gs` (Version 3.0, Modularity Refactor). It contains every business logic function from the shared engine that has **zero dependencies on Google Apps Script APIs** (`SpreadsheetApp`, `Logger`, `HtmlService`, etc.), making every function in this file fully testable in Node.js via Jest or any other offline test runner.

Its companion module, `SharedEngine_IO.gs`, handles the thin I/O layer (sheet reads/writes) and calls into this file's functions for computation.

**Design principles enforced:**
1. **Pure functions** — deterministic; same inputs always produce the same outputs.
2. **Dependency injection** — config objects (`LAYOUT`, `PREK_CONFIG`) are always passed as parameters, never read from global state.
3. **No GAS APIs** — the validator script confirms zero non-comment references to `SpreadsheetApp`, `Logger`, `HtmlService`, or `UrlFetchApp`.
4. **Testable** — every function can be imported and tested in a Node.js environment.

---

## 📜 Business Rules

### Grade Metrics & Benchmarks
Identical to `SharedEngine.gs`. The same `SHARED_GRADE_METRICS` object and lesson array constants (`FOUNDATIONAL_LESSONS`, `G1_MINIMUM_LESSONS`, etc.) are defined here. See `SharedEngine.md` for the full grade metrics table.

### Gateway Logic
Review lessons (defined in `SharedConstants.gs`) act as section-level gateway tests:
- If at least one review is assigned **and** all assigned reviews are `Y` → gateway passes → 100% credit for the section's non-review lessons.
- If any review is `N` (failed) → individual `Y` counts are used.
- Blank cells are never treated as `N`.

### Growth Suppression via `createMergedRow()`
Current and initial assessment data are merged cell-by-cell, preserving any `Y` from either source. This prevents a student's score from appearing to regress between assessment periods.

### Benchmark Status Rule
The Grade Summary status column is computed from the **minimum grade skills %** (not foundational or current year).

### Pre-K Scoring (Handwriting Without Tears)
- **Foundational %** = Form `Y` ÷ 26
- **Min Grade %** = (Name `Y` + Sound `Y`) ÷ 52
- **Full Grade %** = (Name `Y` + Sound `Y` + Form `Y`) ÷ 78
- Pre-K students produce blank entries in the Skills Tracker (16 skill sections are N/A for Pre-K).

### `computeStudentStats()` — Pure Orchestration
This is the pure-logic counterpart to `updateAllStats()` in `SharedEngine_IO.gs`. It accepts all data as parameters and returns computed output arrays without any sheet I/O.

---

## 📥 Data Inputs

All inputs are passed as function parameters — this file never reads from sheets or global state directly:

| Parameter | Type | Description |
|---|---|---|
| `params.mapData` | `Array<Array>` | UFLI MAP sheet rows (loaded by the I/O layer) |
| `params.preKData` | `Array<Array>` | Pre-K Data sheet rows |
| `params.preKHeaders` | `Array` | Pre-K header row |
| `params.initialData` | `Array<Array>` | Initial Assessment sheet rows |
| `params.config.LAYOUT` | `Object` | Layout constants (`DATA_START_ROW`, `LESSON_COLUMN_OFFSET`, etc.) |
| `params.config.PREK_CONFIG` | `Object` | Pre-K config (`HEADER_ROW`, `DATA_START_ROW`, denominators) |
| `params.config.GRADE_METRICS` | `Object` | Grade benchmark definitions (optional; defaults to `SHARED_GRADE_METRICS`) |

---

## 📤 Outputs

| Output | Description |
|---|---|
| `SHARED_GRADE_METRICS` | Global constant — grade benchmark configuration for all schools |
| `FOUNDATIONAL_LESSONS` | Global constant — array of L1–L34 |
| `G1_MINIMUM_LESSONS` | Global constant — 44-lesson array for G1 minimum benchmark |
| `G1_CURRENT_YEAR_LESSONS` | Global constant — 23-lesson array for G1 current year benchmark |
| `G2_MINIMUM_LESSONS` | Global constant — 56-lesson array for G2/G3 minimum benchmark |
| `G2_CURRENT_YEAR_LESSONS` | Global constant — 18-lesson array for G2 current year benchmark |
| `G4_MINIMUM_LESSONS` | Global constant — 103-lesson array for G4–G8 minimum benchmark |
| `ALL_NON_REVIEW_LESSONS` | Global constant — all 105 non-review lessons |
| `computeStudentStats()` return value | `{ skillsOutput: Array<Array>, summaryOutput: Array<Array> }` — ready to write to sheets |
| Individual calculation functions | Percentage integers, status strings, merged arrays, column letters |

---

## 🔗 Dependencies

### Depends On (calls into)
| File | Items Used |
|---|---|
| `SharedConstants.gs` | `SKILL_SECTIONS`, `REVIEW_LESSONS_SET`, `PERFORMANCE_THRESHOLDS`, `STATUS_LABELS`, `getPerformanceStatus()` |

### Used By (called from)
| File | Usage |
|---|---|
| `SharedEngine_IO.gs` | `updateAllStats()` calls `computeStudentStats()` and `createMergedRow()` |
| `Phase2_ProgressTracking.gs` | May call calculation functions directly for sheet generation |
| `UnifiedConfig.gs` | Reads `SHARED_GRADE_METRICS` |

---

## ⚙️ Function Reference

### Lesson Array Constants

| Constant | Description | Count |
|---|---|---|
| `FOUNDATIONAL_LESSONS` | L1–L34 (all foundational phonics lessons) | 34 |
| `G1_MINIMUM_LESSONS` | L1–34 + Digraphs L42–53 (excl. reviews 49, 53) | 44 |
| `G1_CURRENT_YEAR_LESSONS` | L35–62 (excl. reviews 49, 53, 57, 59, 62) | 23 |
| `G2_MINIMUM_LESSONS` | L1–34 + Digraphs + VCE L54–62 + RLW L63–68 (excl. reviews) | 56 |
| `G2_CURRENT_YEAR_LESSONS` | L38 + L63–83 (excl. reviews 71, 76, 79, 83) | 18 |
| `G4_MINIMUM_LESSONS` | L1–34 + L42–110 | 103 |
| `ALL_NON_REVIEW_LESSONS` | L1–128 excluding all 23 review lessons | 105 |

---

### `getLessonColumnIndex(lessonNum, LAYOUT)`
**Description:** Converts a 1-based lesson number to a 0-based array index for reading a cell from a student row array.  
**Parameters:**
- `lessonNum` (number): Lesson number (1–128).
- `LAYOUT` (Object): Must contain `LESSON_COLUMN_OFFSET`.

**Returns:** (number) Zero-based array index = `LAYOUT.LESSON_COLUMN_OFFSET + lessonNum - 1`.

---

### `getLessonStatus(row, lessonNum, LAYOUT)`
**Description:** Reads the normalized status value of a lesson cell from a student row.  
**Parameters:**
- `row` (Array): Student data row.
- `lessonNum` (number): Lesson number (1–128).
- `LAYOUT` (Object): Must contain `LESSON_COLUMN_OFFSET`.

**Returns:** (string) `'Y'`, `'N'`, or `''` (blank = not assigned).

---

### `isReviewLesson(lessonNum)`
**Description:** Checks whether a lesson number is a gateway review lesson using the O(1) `REVIEW_LESSONS_SET`.  
**Parameters:**
- `lessonNum` (number): Lesson number (1–128).

**Returns:** (boolean) `true` if the lesson is a review/gateway lesson.

---

### `partitionLessonsByReview(lessons)`
**Description:** Splits a lesson array into two groups — review lessons and non-review lessons — in a single O(n) pass.  
**Parameters:**
- `lessons` (Array\<number\>): Array of lesson numbers.

**Returns:** (Object) `{ reviews: Array<number>, nonReviews: Array<number> }`.

---

### `checkGateway(row, reviewLessons, LAYOUT)`
**Description:** Evaluates the gateway test for a set of review lessons. Returns whether any reviews were assigned and whether all assigned reviews passed.  
**Parameters:**
- `row` (Array): Student data row.
- `reviewLessons` (Array\<number\>): Review lesson numbers for the section.
- `LAYOUT` (Object): Must contain `LESSON_COLUMN_OFFSET`.

**Returns:** (Object) `{ assigned: boolean, allPassed: boolean, gatewayPassed: boolean }`.  
- `assigned` — `true` if at least one review has `Y` or `N`.
- `allPassed` — `true` if no review has `N`.
- `gatewayPassed` — `true` only when both `assigned` and `allPassed` are `true`.

---

### `calculateBenchmark(mapRow, lessonIndices, denominator, LAYOUT)`
**Description:** Calculates a benchmark percentage for a student over a defined set of lessons. Processes each skill section's contribution, applying gateway logic where applicable.  
**Parameters:**
- `mapRow` (Array): Student data row.
- `lessonIndices` (Array\<number\>): Lesson numbers in the benchmark.
- `denominator` (number): The count of non-review lessons (used as the score denominator).
- `LAYOUT` (Object): Layout configuration.

**Returns:** (number) Rounded percentage (0–100).

**Gateway rule:** For each skill section in the benchmark, if that section's review lessons all pass, every non-review lesson in that section counts as passed.

---

### `calculateSectionPercentage(mapRow, sectionLessons, isInitialAssessment, LAYOUT)`
**Description:** Calculates the percentage score for one of the 16 skill sections.  
**Parameters:**
- `mapRow` (Array): Student data row.
- `sectionLessons` (Array\<number\>): All lesson numbers in the section.
- `isInitialAssessment` (boolean): `true` to skip gateway logic (baseline/initial calc).
- `LAYOUT` (Object): Layout configuration.

**Returns:** (number|string) Rounded percentage 0–100, or `""` if no lessons have been attempted.

**Rules:**
- Initial assessment: `Y count ÷ non-review count` (no gateway).
- Ongoing: If gateway passes → `100`. Otherwise → `Y count ÷ non-review count`.

---

### `calculatePreKScores(row, headers, PREK_CONFIG)`
**Description:** Calculates the three HWT Pre-K benchmark percentages using fixed denominators from `PREK_CONFIG`.  
**Parameters:**
- `row` (Array): Student row from Pre-K Data sheet.
- `headers` (Array): Header row from Pre-K Data sheet.
- `PREK_CONFIG` (Object): Must contain `FORM_DENOMINATOR` (26), `NAME_SOUND_DENOMINATOR` (52), `FULL_DENOMINATOR` (78).

**Returns:** (Object) `{ foundational: number, minGrade: number, fullGrade: number }`.

---

### `countYsInColumns(row, headers, pattern)`
**Description:** Counts `Y` values in columns whose header cell contains a specified string pattern. Internal helper for `calculatePreKScores()`.  
**Parameters:**
- `row` (Array): Data row.
- `headers` (Array): Header row.
- `pattern` (string): Substring to match in header (e.g., `'Name'`, `'Sound'`, `'Form'`).

**Returns:** (number) Count of cells that are `Y` and whose header includes `pattern`.

---

### `getColumnLetter(columnNumber)`
**Description:** Converts a 1-based spreadsheet column number to its letter representation.  
**Parameters:**
- `columnNumber` (number): 1-based column number.

**Returns:** (string) Column letter(s) (e.g., `1 → "A"`, `26 → "Z"`, `27 → "AA"`).

---

### `extractLessonNumber(lessonText)`
**Description:** Parses a UFLI lesson label and extracts the lesson number via regex `/L(\d+)/`.  
**Parameters:**
- `lessonText` (string): Lesson label (e.g., `"UFLI L42 FLSZ spelling rule"`).

**Returns:** (number|null) Lesson number integer, or `null` if the pattern is not found.

---

### `normalizeStudent(student)`
**Description:** Returns a shallow copy of a student object with `name` trimmed of leading/trailing whitespace.  
**Parameters:**
- `student` (Object): Student object with a `name` string property.

**Returns:** (Object) New object with `name` trimmed.

---

### `getLastLessonColumn(LAYOUT)`
**Description:** Computes the spreadsheet column letter of the last lesson column (lesson 128).  
**Parameters:**
- `LAYOUT` (Object): Must contain `COL_FIRST_LESSON` (1-based) and `TOTAL_LESSONS` (128).

**Returns:** (string) Column letter (e.g., `"EH"` when lessons start at column 6).

---

### `createMergedRow(currentRow, initialRow)`
**Description:** Merges a student's current row with their initial assessment row, preserving any `Y` from either source. This is the growth suppression mechanism.  
**Parameters:**
- `currentRow` (Array): Current UFLI MAP row data.
- `initialRow` (Array|null): Initial Assessment row, or `null` if no baseline exists.

**Returns:** (Array) New array where any cell that was `Y` in either source row is `Y` in the output.

---

### `computeStudentStats(params)`
**Description:** Pure-logic orchestrator for the full stats computation pipeline. Accepts all data as parameters, processes K–8 students and Pre-K students, and returns two output arrays ready to be written to sheets. This function has **no I/O side effects**.  
**Parameters:**
- `params` (Object):
  - `params.mapData` (Array\<Array\>): UFLI MAP rows.
  - `params.preKData` (Array\<Array\>): Pre-K Data rows.
  - `params.preKHeaders` (Array): Pre-K header row.
  - `params.initialData` (Array\<Array\>): Initial Assessment rows.
  - `params.config` (Object): Config with `LAYOUT`, `PREK_CONFIG`, and optional `GRADE_METRICS`.

**Returns:** (Object) `{ skillsOutput: Array<Array>, summaryOutput: Array<Array> }`.  
- `skillsOutput` — rows for the Skills Tracker sheet (metadata + 16 section percentages per K–8 student; blank sections for Pre-K).
- `summaryOutput` — rows for the Grade Summary sheet (metadata + foundational %, minimum %, currentYear %, status per student).
