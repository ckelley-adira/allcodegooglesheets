# SharedConstants.gs

## 📋 Overview

`SharedConstants.gs` is the single source of truth for all UFLI domain constants shared across every school deployment. It defines the 128 lesson labels, 16 skill section groupings, 23 gateway review lesson numbers, performance thresholds, status label text, and a helper function for converting a score percentage into a status string.

Before this module existed, each school's `Phase2_ProgressTracking.gs` defined its own copies of these values, creating drift and inconsistency. All unified `.gs` files reference this module instead of defining constants locally.

---

## 📜 Business Rules

- **128 lessons total** — labeled L1 through L128, covering the full UFLI phonics scope and sequence (single consonants/vowels → affixes).
- **16 skill sections** — each section is a named grouping of lesson numbers. A section's score is computed across only its member lessons.
- **23 review lessons** — lessons `[35,36,37,39,40,41,49,53,57,59,62,71,76,79,83,88,92,97,102,104,105,106,128]` act as **gateway tests**. When all review lessons in a section are marked `Y` (passed), the engine awards 100% credit for the entire section's non-review lessons, bypassing individual lesson checks.
- **`REVIEW_LESSONS_SET`** is a `Set` version of `REVIEW_LESSONS` for O(1) membership lookups; always prefer it over `REVIEW_LESSONS.includes()` in hot paths.
- **Performance thresholds** (applied to `minGrade` benchmark %):
  - **On Track** — score ≥ 80%
  - **Needs Support** — score ≥ 50% and < 80%
  - **Intervention** — score < 50%
- Blank lesson cells are **never** treated as `N` — only cells explicitly containing `N` (failed) are counted as not-passed.

---

## 📥 Data Inputs

| Input | Type | Description |
|---|---|---|
| `percentage` | `number` (0–100) | Score passed to `getPerformanceStatus()` |

No sheet data is read directly by this file. It provides constants consumed by other modules.

---

## 📤 Outputs

| Output | Type | Description |
|---|---|---|
| `LESSON_LABELS` | `const Object` | Map of lesson number → label string (global) |
| `SKILL_SECTIONS` | `const Object` | Map of section name → array of lesson numbers (global) |
| `REVIEW_LESSONS` | `const Array<number>` | Ordered array of 23 review lesson numbers (global) |
| `REVIEW_LESSONS_SET` | `const Set<number>` | Set version of `REVIEW_LESSONS` for fast lookup (global) |
| `PERFORMANCE_THRESHOLDS` | `const Object` | `{ ON_TRACK: 80, NEEDS_SUPPORT: 50 }` (global) |
| `STATUS_LABELS` | `const Object` | `{ ON_TRACK, NEEDS_SUPPORT, INTERVENTION }` string labels (global) |
| `getPerformanceStatus(percentage)` | `function` | Returns the matching `STATUS_LABELS` string |

---

## 🔗 Dependencies

### Depends On (calls into)
_None._ This file has no dependencies on other `.gs` files.

### Used By (called from)
| File | Usage |
|---|---|
| `SharedEngine.gs` | References `SKILL_SECTIONS`, `REVIEW_LESSONS_SET`, `getPerformanceStatus()` in all benchmark/section calculations |
| `SharedEngine_Core.gs` | Same as `SharedEngine.gs` — pure-logic split uses the same constants |
| `SharedEngine_IO.gs` | Indirectly via `computeStudentStats()` (which uses `SKILL_SECTIONS`) |
| `UnifiedConfig.gs` | Reads `SHARED_GRADE_METRICS` (defined in `SharedEngine.gs`/`SharedEngine_Core.gs`) which in turn references these constants |
| `Phase2_ProgressTracking.gs` | References constants for sheet generation and stats updates |
| `validate_shared_constants.js` | Validates that all constants are present; run offline via Node.js |

---

## ⚙️ Constant Reference

### `LESSON_LABELS`
**Type:** `Object` (number → string)  
**Description:** Maps each lesson number (1–128) to its UFLI display label (e.g., `1 → "UFLI L1 a/ā/"`, `128 → "UFLI L128 Affixes Review 2"`). Used to render lesson headers on tracking sheets and reports.

---

### `SKILL_SECTIONS`
**Type:** `Object` (string → `Array<number>`)  
**Description:** Groups lessons into 16 named phonics skill categories. Each value is an ordered array of lesson numbers belonging to that section. The 16 sections are:

| Section | Lesson Range (approx.) |
|---|---|
| Single Consonants & Vowels | 1–34 |
| Blends | 25, 27 |
| Alphabet Review & Longer Words | 35–41 |
| Digraphs | 42–53 |
| VCE | 54–62 |
| Reading Longer Words | 63–68 |
| Ending Spelling Patterns | 69–76 |
| R-Controlled Vowels | 77–83 |
| Long Vowel Teams | 84–88 |
| Other Vowel Teams | 89–94 |
| Diphthongs | 95–97 |
| Silent Letters | 98 |
| Suffixes & Prefixes | 99–106 |
| Suffix Spelling Changes | 107–110 |
| Low Frequency Spellings | 111–118 |
| Additional Affixes | 119–128 |

---

### `REVIEW_LESSONS`
**Type:** `Array<number>` (23 elements)  
**Description:** The complete list of gateway review lesson numbers: `[35,36,37,39,40,41,49,53,57,59,62,71,76,79,83,88,92,97,102,104,105,106,128]`. These lessons gate entire sections — passing all reviews in a section yields 100% section credit.

---

### `REVIEW_LESSONS_SET`
**Type:** `Set<number>`  
**Description:** `new Set(REVIEW_LESSONS)`. Used in `partitionLessonsByReview()` and `isReviewLesson()` for O(1) lookups instead of `Array.includes()`.

---

### `PERFORMANCE_THRESHOLDS`
**Type:** `Object`  
**Description:** Numeric cut-points for status classification:
- `ON_TRACK: 80` — scores ≥ 80% are "On Track"
- `NEEDS_SUPPORT: 50` — scores ≥ 50% are "Needs Support"; below is "Intervention"

---

### `STATUS_LABELS`
**Type:** `Object`  
**Description:** Human-readable strings for each performance tier:
- `ON_TRACK: "On Track"`
- `NEEDS_SUPPORT: "Needs Support"`
- `INTERVENTION: "Intervention"`

---

## ⚙️ Function Reference

### `getPerformanceStatus(percentage)`
**Description:** Converts a numeric score percentage into one of the three performance status label strings using `PERFORMANCE_THRESHOLDS`.  
**Parameters:**
- `percentage` (number): Score from 0–100.

**Returns:** (string) One of `"On Track"`, `"Needs Support"`, or `"Intervention"`.

**Logic:**
- `percentage >= 80` → `"On Track"`
- `percentage >= 50` → `"Needs Support"`
- otherwise → `"Intervention"`
