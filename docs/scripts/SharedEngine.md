# SharedEngine.gs

## 📋 Overview

`SharedEngine.gs` is the original consolidated calculation engine for the UFLI progress tracking system (Version 2.0, Phase 2 Consolidation). It contains all core business logic, grade metric definitions, utility helpers, and — unlike its successor split modules — also includes the sheet I/O functions (`getOrCreateSheet`, `log`, `updateAllStats`).

> **Architecture note:** In Version 3.0 (Modularity Refactor), the content of this file was split into two companion modules:
> - **`SharedEngine_Core.gs`** — pure, GAS-free business logic (testable in Node.js)
> - **`SharedEngine_IO.gs`** — thin I/O layer (`getOrCreateSheet`, `log`, `updateAllStats`)
>
> `SharedEngine.gs` is retained as the original monolithic version. New deployments should prefer the split modules. Both define the same functions; in a live GAS project, only one pair (`SharedEngine.gs` alone, OR `SharedEngine_Core.gs` + `SharedEngine_IO.gs`) should be active to avoid duplicate function errors.

---

## 📜 Business Rules

### Grade Metrics & Benchmark Denominators
Each grade has three benchmark tiers — **foundational**, **minimum**, and **currentYear** — each defined by a specific lesson set and fixed denominator:

| Grade | Foundational | Minimum | Current Year |
|---|---|---|---|
| PreK | L1–34 / 26 | L1–34 / 26 | L1–34 / 26 |
| KG | L1–34 / 34 | L1–34 / 34 | L1–34 / 34 |
| G1 | L1–34 / 34 | L1–34 + Digraphs / 44 | L35–62 (excl. reviews) / 23 |
| G2 | L1–34 / 34 | L1–68 (excl. reviews) / 56 | L38, L63–83 (excl. reviews) / 18 |
| G3 | L1–34 / 34 | L1–68 (excl. reviews) / 56 | All non-review / 107 |
| G4–G8 | L1–34 / 34 | L1–34 + L42–110 / 103 | All non-review / 107 |

### Gateway Logic
- Review lessons act as section-level **gateway tests**.
- If at least one review in a section is assigned (`Y` or `N`) **and** all assigned reviews passed (`Y`), the entire section's non-review lessons are counted as passed (100% credit).
- If any review is assigned `N`, the gateway fails and individual `Y` counts are used instead.
- Blank cells are always ignored — they are never treated as `N`.

### Growth Suppression
- `createMergedRow()` merges current lesson data with initial assessment data, preserving any `Y` from either source. This prevents negative growth reporting when a student was assessed earlier than their current progress data.

### Benchmark Status
- The performance status on the Grade Summary is determined by the **minimum grade skills %** (not foundational or current year).

### Pre-K Metrics (HWT — Handwriting Without Tears)
- **Foundational Skills %** = Form `Y` count ÷ 26 (motor integration)
- **Min Grade Skills %** = (Name `Y` + Sound `Y`) ÷ 52 (literacy knowledge)
- **Full Grade Skills %** = (Name `Y` + Sound `Y` + Form `Y`) ÷ 78 (K-readiness)
- Pre-K students do NOT use the 16 UFLI skill sections; their Skills Tracker rows are all blank.

---

## 📥 Data Inputs

| Source | Description |
|---|---|
| `UFLI MAP` sheet | Primary K–8 student progress data (one student per row) |
| `Pre-K Data` sheet | Pre-K HWT assessment data |
| `Initial Assessment` sheet | Baseline scores used for growth suppression (merged with current data) |
| `config` object passed to `updateAllStats()` | `SHEET_NAMES_V2`, `SHEET_NAMES_PREK`, `LAYOUT`, `PREK_CONFIG`, `GRADE_METRICS` |
| `LAYOUT.DATA_START_ROW` | First data row index (header rows skipped) |
| `LAYOUT.LESSON_COLUMN_OFFSET` | Column offset to the first lesson column in each student row |

---

## 📤 Outputs

| Output | Description |
|---|---|
| `Skills Tracker` sheet | Updated with section-percentage rows for every K–8 student and blank rows for Pre-K |
| `Grade Summary` sheet | Updated with foundational/minimum/currentYear benchmark %s and performance status per student |
| `SHARED_GRADE_METRICS` | Global constant object consumed by `UnifiedConfig.gs` and school deployments |
| Return values of calculation functions | Percentage integers, status strings, merged arrays, column letters — used by `updateAllStats()` and callers |

---

## 🔗 Dependencies

### Depends On (calls into)
| File | Items Used |
|---|---|
| `SharedConstants.gs` | `SKILL_SECTIONS`, `REVIEW_LESSONS_SET`, `getPerformanceStatus()` |

### Used By (called from)
| File | Usage |
|---|---|
| `Phase2_ProgressTracking.gs` | Calls `updateAllStats()`, uses lesson array constants and calculation functions |
| `UnifiedConfig.gs` | Reads `SHARED_GRADE_METRICS` |
| `SharedEngine_Core.gs` | Defines the same pure-logic functions (successor split module) |
| `SharedEngine_IO.gs` | Defines the same I/O functions (successor split module) |

---

## ⚙️ Function Reference

### Lesson Array Constants (IIFEs)

These are module-level `const` arrays computed once at load time:

| Constant | Lessons Included | Count |
|---|---|---|
| `FOUNDATIONAL_LESSONS` | L1–L34 | 34 |
| `G1_MINIMUM_LESSONS` | L1–34 + Digraphs L42–53 (excl. reviews 49,53) | 44 |
| `G1_CURRENT_YEAR_LESSONS` | L35–62 (excl. reviews 49,53,57,59,62) | 23 |
| `G2_MINIMUM_LESSONS` | L1–34 + Digraphs + VCE + RLW (excl. reviews) | 56 |
| `G2_CURRENT_YEAR_LESSONS` | L38 + L63–83 (excl. reviews 71,76,79,83) | 18 |
| `G4_MINIMUM_LESSONS` | L1–34 + L42–110 | 103 |
| `ALL_NON_REVIEW_LESSONS` | L1–128 excluding 23 review lessons | 105 |

---

### `getLessonColumnIndex(lessonNum, LAYOUT)`
**Description:** Converts a 1-based lesson number to a 0-based array index for reading from a student row.  
**Parameters:**
- `lessonNum` (number): Lesson number 1–128.
- `LAYOUT` (Object): Must contain `LESSON_COLUMN_OFFSET`.

**Returns:** (number) Zero-based array index.

---

### `getLessonStatus(row, lessonNum, LAYOUT)`
**Description:** Reads a lesson cell from a student row and returns its normalized status value.  
**Parameters:**
- `row` (Array): Student data row.
- `lessonNum` (number): Lesson number 1–128.
- `LAYOUT` (Object): Must contain `LESSON_COLUMN_OFFSET`.

**Returns:** (string) `'Y'`, `'N'`, or `''` (blank/not assigned).

---

### `isReviewLesson(lessonNum)`
**Description:** Checks whether a lesson number is a gateway review lesson.  
**Parameters:**
- `lessonNum` (number): Lesson number 1–128.

**Returns:** (boolean) `true` if in `REVIEW_LESSONS_SET`.

---

### `partitionLessonsByReview(lessons)`
**Description:** Splits an array of lesson numbers into two arrays — review lessons and non-review lessons — in a single pass.  
**Parameters:**
- `lessons` (Array\<number\>): Lesson numbers to partition.

**Returns:** (Object) `{ reviews: Array<number>, nonReviews: Array<number> }`.

---

### `checkGateway(row, reviewLessons, LAYOUT)`
**Description:** Evaluates whether a section's gateway is passed. A gateway passes if at least one review lesson is assigned (`Y` or `N`) AND all assigned reviews are `Y`.  
**Parameters:**
- `row` (Array): Student data row.
- `reviewLessons` (Array\<number\>): Review lesson numbers for the section.
- `LAYOUT` (Object): Must contain `LESSON_COLUMN_OFFSET`.

**Returns:** (Object) `{ assigned: boolean, allPassed: boolean, gatewayPassed: boolean }`.

---

### `calculateBenchmark(mapRow, lessonIndices, denominator, LAYOUT)`
**Description:** Calculates a benchmark percentage (0–100) for a student against a specific lesson set. Applies gateway logic section-by-section: if a section's reviews all passed, all non-review lessons in that section count as passed.  
**Parameters:**
- `mapRow` (Array): Student data row.
- `lessonIndices` (Array\<number\>): Lesson numbers included in this benchmark.
- `denominator` (number): Expected denominator (the count of non-review lessons in the set).
- `LAYOUT` (Object): Layout configuration.

**Returns:** (number) Percentage 0–100 (rounded integer).

---

### `calculateSectionPercentage(mapRow, sectionLessons, isInitialAssessment, LAYOUT)`
**Description:** Calculates the percentage score for a single skill section. For initial assessments, no gateway logic is applied. For ongoing progress, a passing gateway yields 100%.  
**Parameters:**
- `mapRow` (Array): Student data row.
- `sectionLessons` (Array\<number\>): All lesson numbers in the section.
- `isInitialAssessment` (boolean): If `true`, skips gateway logic (baseline calculation).
- `LAYOUT` (Object): Layout configuration.

**Returns:** (number|string) Percentage 0–100, or `""` if nothing has been attempted.

---

### `calculatePreKScores(row, headers, PREK_CONFIG)`
**Description:** Computes the three HWT Pre-K benchmark scores using fixed denominators.  
**Parameters:**
- `row` (Array): Student row from Pre-K Data sheet.
- `headers` (Array): Header row from Pre-K Data sheet.
- `PREK_CONFIG` (Object): Must contain `FORM_DENOMINATOR` (26), `NAME_SOUND_DENOMINATOR` (52), `FULL_DENOMINATOR` (78).

**Returns:** (Object) `{ foundational: number, minGrade: number, fullGrade: number }`.

---

### `countYsInColumns(row, headers, pattern)`
**Description:** Counts the number of `Y` values in columns whose header contains the given pattern string. Used internally by `calculatePreKScores()`.  
**Parameters:**
- `row` (Array): Data row.
- `headers` (Array): Header row.
- `pattern` (string): Substring to match against header cells (e.g., `'Name'`, `'Sound'`, `'Form'`).

**Returns:** (number) Count of matching `Y` cells.

---

### `getColumnLetter(columnNumber)`
**Description:** Converts a 1-based column number to its spreadsheet letter(s) (e.g., `27 → "AA"`).  
**Parameters:**
- `columnNumber` (number): 1-based column number.

**Returns:** (string) Column letter string (e.g., `"A"`, `"Z"`, `"AA"`).

---

### `extractLessonNumber(lessonText)`
**Description:** Parses a lesson label string and extracts the numeric lesson number.  
**Parameters:**
- `lessonText` (string): Lesson label (e.g., `"UFLI L42 FLSZ spelling rule"`).

**Returns:** (number|null) Lesson number, or `null` if not parseable.

---

### `normalizeStudent(student)`
**Description:** Returns a copy of a student object with the `name` field trimmed of whitespace.  
**Parameters:**
- `student` (Object): Student object with a `name` property.

**Returns:** (Object) New student object with normalized `name`.

---

### `getLastLessonColumn(LAYOUT)`
**Description:** Returns the spreadsheet column letter for the last lesson column (lesson 128).  
**Parameters:**
- `LAYOUT` (Object): Must contain `COL_FIRST_LESSON` and `TOTAL_LESSONS`.

**Returns:** (string) Column letter (e.g., `"EH"` if lessons start at column 6).

---

### `getOrCreateSheet(ss, sheetName, clearIfExists)`
**Description:** Retrieves an existing sheet by name or creates a new one. Optionally clears its content.  
**Parameters:**
- `ss` (Spreadsheet): GAS Spreadsheet object.
- `sheetName` (string): Target sheet name.
- `clearIfExists` (boolean, default `true`): If `true`, clears the sheet if it already exists.

**Returns:** (Sheet) GAS Sheet object.

---

### `log(functionName, message, level)`
**Description:** Writes a formatted log entry via `Logger.log()`.  
**Parameters:**
- `functionName` (string): Name of the calling function (for context).
- `message` (string): Message to log.
- `level` (string, default `'INFO'`): Log level — `'INFO'`, `'WARN'`, or `'ERROR'`.

**Returns:** `undefined`

---

### `createMergedRow(currentRow, initialRow)`
**Description:** Merges current and initial assessment row data, preserving any `Y` from either source. Prevents negative growth reporting between assessment periods.  
**Parameters:**
- `currentRow` (Array): Current UFLI MAP progress data.
- `initialRow` (Array|null): Initial Assessment data row, or `null` if no baseline exists.

**Returns:** (Array) Merged row where any cell that was `Y` in either source is `Y` in the output.

---

### `updateAllStats(ss, mapData, config)`
**Description:** Full statistics update orchestrator. Reads UFLI MAP, Pre-K Data, and Initial Assessment sheets; processes all students; writes updated values to Skills Tracker and Grade Summary sheets. Calls `createMergedRow()`, `calculateSectionPercentage()`, `calculateBenchmark()`, and `calculatePreKScores()` internally.  
**Parameters:**
- `ss` (Spreadsheet): GAS Spreadsheet object.
- `mapData` (Array|null): Optional pre-loaded UFLI MAP data. If `null`, reads from the sheet.
- `config` (Object): Must contain `SHEET_NAMES_V2`, `SHEET_NAMES_PREK`, `LAYOUT`, `PREK_CONFIG`; optionally `GRADE_METRICS` (falls back to `SHARED_GRADE_METRICS`).

**Returns:** `undefined` (writes directly to sheets).
