# PreKDashboard.html (Pre-K UI Template)

## 📋 Overview
Administrative analytics dashboard for the Pre-K literacy program. Displayed as a web app page (navigated to via `?page=dashboard` URL parameter). Administrators and coordinators use it to monitor site-wide student progress, compare group performance, view mastery distributions, and export data to CSV. The dashboard loads all data in a single call on page init and renders four interactive Google Charts plus a student progress table.

## 📜 Business Rules
- Average mastery ≥ 70% is labeled "✓ On Track"; below 70% shows "Building Progress".
- Student progress bar color: ≥ 80% → green (`high`), 50–79% → amber (`medium`), < 50% → red (`low`).
- Mastery distribution buckets: Mastered (80%+), Progressing (50–79%), Beginning (<50%).
- Charts re-render on browser window resize to maintain responsiveness.
- CSV export first attempts server-side file creation; falls back to copying CSV text to the clipboard if the server call fails or returns no URL.

## 📥 Data Inputs
No user-entered form fields. All data is loaded from the server on page init.

| Data | Source |
|------|--------|
| Dashboard payload (`stats`, `programBreakdown`, `masteryDistribution`, `skillsProgress`, `groupProgress`, `students`) | `google.script.run.getDashboardData()` |
| Web app URL (for portal navigation) | `google.script.run.getWebAppUrl()` |

### Data shape expected from `getDashboardData()`
```
{
  stats: { totalStudents, avgMastery, lettersAssessed, totalGroups },
  programBreakdown: { preSchool, preK },
  masteryDistribution: { mastered, progressing, beginning },
  skillsProgress: { form, name, sound },
  groupProgress: [ { name, avgProgress }, ... ],
  students: [ { name, group, program, progress, mastery }, ... ]
}
```

## 📤 Outputs
| Action | Result |
|--------|--------|
| Page load | Calls `getDashboardData()`, renders stats cards, four charts, and student table |
| "Export to CSV" button click | Calls `createCSVDownload(csvContent, filename)`, opens download URL or copies to clipboard |
| Portal nav links | Calls `getWebAppUrl()`, redirects `window.top` to the selected page |
| Error | Error message displayed inline in the loading div with a "Retry" button |

## 🔗 Dependencies
### Server Functions Called (`google.script.run`)
| Function | Purpose |
|----------|---------|
| `getWebAppUrl()` | Retrieve the deployed web app base URL for portal navigation |
| `getDashboardData()` | Load full dashboard payload (stats, charts data, student list) |
| `createCSVDownload(csvContent, filename)` | Server-side CSV file creation; returns a download URL |

### Called From (which .gs opens this HTML)
- `PreKMainCode.gs` — serves this page when `?page=dashboard` is in the web app URL query string.

### External Libraries
- **Google Charts** (`google.charts.load('current', {packages:['corechart','bar']})`) — loaded from `https://www.gstatic.com/charts/loader.js`

## ⚙️ Client-Side JavaScript Functions

### `navigateToPortal(page)`
**Description:** Fetches the web app URL and redirects `window.top` to the specified portal page. Passing an empty string navigates to the home page.
**Parameters:**
- `page` (string): Page identifier (e.g., `'teacher'`, `'tutor'`, `'dashboard'`; empty string for home)
**Returns:** void

### `initDashboard()`
**Description:** Entry point called after Google Charts finishes loading. Invokes `getDashboardData()` on the server and passes the result to `renderDashboard()`.
**Parameters:** none
**Returns:** void

### `renderDashboard(data)`
**Description:** Orchestrates full dashboard render. Hides the loading spinner, shows dashboard content, and calls each individual render function.
**Parameters:**
- `data` (object): Full dashboard payload from `getDashboardData()`
**Returns:** void

### `renderStats(stats)`
**Description:** Builds the four KPI stat cards (Total Students, Average Mastery, Letters Assessed, Active Groups) and injects them into `#stats-grid`.
**Parameters:**
- `stats` (object): `{ totalStudents, avgMastery, lettersAssessed, totalGroups }`
**Returns:** void

### `renderProgramChart(breakdown)`
**Description:** Draws a donut (PieChart with `pieHole: 0.4`) showing Pre-School vs. Pre-K student counts.
**Parameters:**
- `breakdown` (object): `{ preSchool, preK }`
**Returns:** void

### `renderMasteryChart(distribution)`
**Description:** Draws a horizontal BarChart with three bars: Mastered (green), Progressing (amber), Beginning (red).
**Parameters:**
- `distribution` (object): `{ mastered, progressing, beginning }`
**Returns:** void

### `renderSkillsChart(skills)`
**Description:** Draws a ColumnChart showing average mastery % for Letter Form, Letter Name, and Letter Sound.
**Parameters:**
- `skills` (object): `{ form, name, sound }`
**Returns:** void

### `renderGroupsChart(groups)`
**Description:** Draws a ColumnChart comparing average progress % across all learning groups.
**Parameters:**
- `groups` (array): `[ { name, avgProgress }, ... ]`
**Returns:** void

### `renderProgressTable(students)`
**Description:** Populates the student progress data table with rows showing each student's name, group, program, a colored progress bar, and mastery %.
**Parameters:**
- `students` (array): `[ { name, group, program, progress, mastery }, ... ]`
**Returns:** void

### `exportToCSV()`
**Description:** Builds a CSV string from cached dashboard data and calls `createCSVDownload()` on the server. On success opens the returned URL; on failure falls back to `navigator.clipboard.writeText()`.
**Parameters:** none
**Returns:** void

### `showError(error)`
**Description:** Displays an error message inside the `#loading` div with a "Retry" button that re-calls `initDashboard()`.
**Parameters:**
- `error` (Error | string): The error object or message string
**Returns:** void
