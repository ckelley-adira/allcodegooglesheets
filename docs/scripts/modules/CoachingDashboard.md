# CoachingDashboard.gs (Module)

## 📋 Overview
**Feature Flag:** `SITE_CONFIG.features.coachingDashboard`

`CoachingDashboard.gs` generates and maintains the **Weekly Coaching Dashboard** sheet, which gives instructional coaches a consolidated week-over-week performance view for every small group. It reads raw lesson-entry rows from the *Small Group Progress* sheet and the *Pacing Dashboard*, bucketed by ISO calendar week, and writes a formatted summary sheet with pass rates, absence rates, and the delta (change) versus the prior week.

Plain-English summary: *Every time a coach opens the dashboard (or runs a refresh), the module reprocesses all historical Small Group Progress entries, groups them by ISO week and group name, and writes a colour-coded table showing how each group performed this week versus last week. Groups with no data in a given week are still shown, but appear greyed out.*

---

## 📜 Business Rules
1. **All groups are always shown** — even groups with zero activity in a given week appear as a row (with a grey font colour), so coaches can identify missing data.
2. Week keys follow the **ISO-8601** format `YYYY-Www` (e.g., `"2025-W05"`). Weeks are ordered most-recent first.
3. Pass rate is calculated as `Y / (Y + N + A)`. Absent (`A`) entries count against the pass rate denominator.
4. Conditional formatting thresholds on the **Pass %** column: ≥ 80 % → green (On Track); 50 – 79 % → amber (Progressing); < 50 % → red (At Risk).
5. The **Change** column is formatted `+0.0%;-0.0%` and colour-coded: positive → green, negative → red.
6. A **medium-weight border** is drawn between consecutive week blocks for visual grouping.
7. The dashboard is rebuilt from scratch on every refresh; it does not merge or diff previous content.
8. The group list is sourced from the **Pacing Dashboard** first (authoritative), supplemented by any additional groups found only in Small Group Progress.

---

## 📥 Data Inputs
| Input | Source Sheet / Symbol | Notes |
|---|---|---|
| Lesson submission rows | `SHEET_NAMES_V2.SMALL_GROUP_PROGRESS` | Columns: Date, Teacher, Group, Student, Lesson, Status |
| Group master list | `SHEET_NAMES_PACING.DASHBOARD` | Column A from `COLS.PACING_DASHBOARD.DATA_START_ROW` |
| Layout constants | `LAYOUT.DATA_START_ROW`, `COLS.SMALL_GROUP_PROGRESS.*` | From `SharedConstants.gs` / `SharedEngine.gs` |
| Dashboard colours | `DASHBOARD_COLORS.*` | Defined in `SharedEngine.gs` |
| Date formatting | `formatDateSafe()` | From `SharedEngine.gs` |

---

## 📤 Outputs
| Output | Description |
|---|---|
| Sheet: *Weekly Coaching Dashboard* | Created or cleared and fully rewritten on each refresh |
| Frozen rows | First 3 rows (title, subtitle, headers) are frozen |
| Conditional formatting rules | Applied to Pass % column and Change column |
| Week separator borders | Heavier horizontal border between consecutive week blocks |
| Grey rows | Groups with zero lessons in a week are greyed out |
| Empty-state message | Written when no Small Group Progress data exists |

---

## 🔗 Dependencies

### Feature Flag
`SITE_CONFIG.features.coachingDashboard === true`

### Depends On (calls into)
| File / Symbol | Purpose |
|---|---|
| `SharedEngine.gs` → `getOrCreateSheet()` | Get/create the dashboard sheet |
| `SharedEngine.gs` → `log()` | Structured logging |
| `SharedEngine.gs` → `formatDateSafe()` | Date string in subtitle |
| `SharedConstants.gs` → `SHEET_NAMES_V2` | Sheet name for Small Group Progress |
| `SharedConstants.gs` → `SHEET_NAMES_PACING` | Sheet name for Pacing Dashboard |
| `SharedConstants.gs` → `LAYOUT` | `DATA_START_ROW` |
| `SharedConstants.gs` → `COLS.SMALL_GROUP_PROGRESS` | Column index constants |
| `SharedConstants.gs` → `COLS.PACING_DASHBOARD` | `DATA_START_ROW` for Pacing Dashboard |
| `SharedEngine.gs` → `DASHBOARD_COLORS` | Hex colour constants |
| `SpreadsheetApp` (GAS built-in) | Sheet access, conditional format rules |

### Used By (called from)
| File | Context |
|---|---|
| `ModuleLoader.gs` → `buildFeatureMenu()` | Registers `openWeeklyDashboard` and `refreshWeeklyDashboard` in the *Coach Tools* submenu |
| `SetupWizard.gs` / `onOpen_Example.gs` | Menu items invoke these functions directly |

---

## ⚙️ Function Reference

### `openWeeklyDashboard()`
**Description:** Calls `refreshWeeklyDashboard()` to rebuild the dashboard, then navigates the user to the *Weekly Coaching Dashboard* sheet.

**Parameters:** None.

**Returns:** (void)

---

### `refreshWeeklyDashboard()`
**Description:** Main entry point to rebuild the dashboard. Reads all Small Group Progress rows, buckets them by ISO week and group, computes pass/absent/not-passed rates and week-over-week change, then writes the fully formatted sheet.

**Parameters:** None.

**Returns:** (void)

---

### `getAllGroupNamesForDashboard_(ss)`
**Description:** (Private) Returns a sorted, deduplicated list of all group names from the Pacing Dashboard (primary) and Small Group Progress (secondary).

**Parameters:**
- `ss` (Spreadsheet): Active spreadsheet instance.

**Returns:** (Array\<string\>) Sorted group names.

---

### `bucketByWeek_(data)`
**Description:** (Private) Iterates all Small Group Progress rows and aggregates `Y`/`N`/`A` counts, unique lesson names, and unique student names into a nested map keyed by `weekKey → groupName`.

**Parameters:**
- `data` (Array\<Array\>): 2-D array of SGP sheet values starting from `DATA_START_ROW`.

**Returns:** (Object) `{ "2025-W05": { "KG Group 1": { Y, N, A, lessons, students } } }`

---

### `getISOWeekKey_(date)`
**Description:** (Private) Returns the ISO 8601 week key (`"YYYY-Www"`) for a given `Date` object. Uses UTC arithmetic to avoid timezone-crossing edge cases.

**Parameters:**
- `date` (Date): Any JavaScript Date.

**Returns:** (string) e.g. `"2025-W05"`

---

### `weekKeyToDate_(weekKey)`
**Description:** (Private) Returns the Monday `Date` for a given ISO week key.

**Parameters:**
- `weekKey` (string): ISO week key such as `"2025-W05"`.

**Returns:** (Date) The Monday of that week.

---

### `buildWeeklyRows_(weekBuckets, weekKeys, allGroups)`
**Description:** (Private) Iterates weeks (most-recent first) × all groups, computing pass/absent/not-passed rates and the week-over-week change versus the prior week entry. Groups with no bucket data in a week still produce a row with empty rate fields.

**Parameters:**
- `weekBuckets` (Object): Output of `bucketByWeek_()`.
- `weekKeys` (Array\<string\>): Sorted week keys, most-recent first.
- `allGroups` (Array\<string\>): All group names from `getAllGroupNamesForDashboard_()`.

**Returns:** (Array\<Array\>) One array per data row in column order matching `WEEKLY_HEADERS`.

---

### `writeWeeklySheet_(sheet, rows, weekKeys)`
**Description:** (Private) Clears and rebuilds the Weekly Coaching Dashboard sheet: writes the title (row 1), subtitle (row 2), and column headers (row 3); writes all data rows; applies number formats, column widths, conditional formatting, week separators, and no-data row styling.

**Parameters:**
- `sheet` (Sheet): The *Weekly Coaching Dashboard* sheet.
- `rows` (Array\<Array\>): Output of `buildWeeklyRows_()`.
- `weekKeys` (Array\<string\>): Used to build the subtitle string.

**Returns:** (void)

---

### `applyChangeConditionalFormatting_(sheet, rowCount)`
**Description:** (Private) Adds conditional format rules for: the Change column (positive → green, negative → red) and the Pass % column (≥ 80 % → green, 50–79 % → amber, < 50 % → red).

**Parameters:**
- `sheet` (Sheet): The dashboard sheet.
- `rowCount` (number): Number of data rows to format.

**Returns:** (void)

---

### `applyWeekSeparators_(sheet, rows)`
**Description:** (Private) Walks the data rows and draws a medium-weight horizontal border between any two consecutive rows whose *Week Of* dates differ, creating a visual separator between week blocks.

**Parameters:**
- `sheet` (Sheet): The dashboard sheet.
- `rows` (Array\<Array\>): Data rows as built by `buildWeeklyRows_()`.

**Returns:** (void)

---

### `applyNoDataStyling_(sheet, rows)`
**Description:** (Private) Sets the font colour to grey (`#999999`) for any row where *Lessons Taught* equals zero, indicating the group had no recorded activity that week.

**Parameters:**
- `sheet` (Sheet): The dashboard sheet.
- `rows` (Array\<Array\>): Data rows.

**Returns:** (void)

---

### `writeWeeklyEmptyState_(sheet)`
**Description:** (Private) Writes a minimal title row and an italicised empty-state message when no Small Group Progress data is available.

**Parameters:**
- `sheet` (Sheet): The dashboard sheet.

**Returns:** (void)
