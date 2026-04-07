# PreKParentReport.html (Pre-K UI Template)

## 📋 Overview
A printable, parent-facing literacy progress report for an individual Pre-K or Pre-School student. This is a **static server-rendered template** — it contains no client-side JavaScript business logic or `google.script.run` calls. All dynamic content is injected by `PreKMainCode.gs` using GAS template variable substitution (`{{VariableName}}` placeholders) before the HTML is sent to the browser. The report is designed for print (includes `@media print` and `@page` CSS rules) and can be shared digitally or printed and sent home to families.

## 📜 Business Rules
- The report layout adapts based on program type:
  - **Pre-K Program**: Shows three skill cards (Letter Form, Letter Name, Letter Sound) inside `#prek-skills` (`{{PreKDisplay}}`).
  - **Pre-School Program**: Shows a single Letter Sound Recognition card inside `#preschool-skills` (`{{PreSchoolDisplay}}`). The unused section is hidden via the injected `display` style.
- Skill fill bar color class (`{{FormClass}}`, `{{NameClass}}`, `{{SoundClass}}`, `{{PSClass}}`) is one of: `high` (green, ≥ 80%), `medium` (amber, 50–79%), or `low` (red, < 50%).
- The SVG progress ring uses a pre-calculated `stroke-dashoffset` (`{{OverallOffset}}`) for the circumference of 314.159 (radius = 50).
- Encouragement message (icon, title, and text) is selected server-side based on mastery level.
- Print styles force color accuracy with `-webkit-print-color-adjust: exact` and set page size to letter with 0.5 in margins.

## 📥 Data Inputs
No user-entered form fields and no `google.script.run` calls. All data is injected by the server before rendering.

### Template Variables (injected by `PreKMainCode.gs`)
| Variable | Type | Description |
|----------|------|-------------|
| `{{StudentName}}` | string | Student's full name |
| `{{Program}}` | string | Program label (e.g., "Pre-K" or "Pre-School") |
| `{{Date}}` | string | Report generation date |
| `{{OverallMastery}}` | number | Overall mastery percentage (0–100) |
| `{{OverallOffset}}` | number | SVG stroke-dashoffset for the progress ring |
| `{{ProgressMessage}}` | string | Short heading for the progress summary |
| `{{ProgressDetail}}` | string | Longer descriptive sentence for progress summary |
| `{{PreKDisplay}}` | string | CSS `display` value for the Pre-K skills section (`""` or `"display:none"`) |
| `{{PreSchoolDisplay}}` | string | CSS `display` value for the Pre-School skills section |
| `{{FormMastery}}` | number | Letter Form mastery % |
| `{{FormCumulative}}` | number | Letter Form cumulative completion % |
| `{{FormClass}}` | string | CSS class for Letter Form bar: `high`, `medium`, or `low` |
| `{{NameMastery}}` | number | Letter Name mastery % |
| `{{NameCumulative}}` | number | Letter Name cumulative completion % |
| `{{NameClass}}` | string | CSS class for Letter Name bar |
| `{{SoundMastery}}` | number | Letter Sound mastery % |
| `{{SoundCumulative}}` | number | Letter Sound cumulative completion % |
| `{{SoundClass}}` | string | CSS class for Letter Sound bar |
| `{{PSMastery}}` | number | Pre-School Letter Sound mastery % |
| `{{PSCumulative}}` | number | Pre-School Letter Sound cumulative completion % |
| `{{PSClass}}` | string | CSS class for Pre-School bar |
| `{{EncouragementIcon}}` | string | Emoji used in the encouragement section |
| `{{EncouragementTitle}}` | string | Encouragement heading |
| `{{EncouragementText}}` | string | Encouragement body text |

## 📤 Outputs
This template is read-only from the user's perspective. The intended user action is to print or share the rendered page. No server callbacks are made from the client.

| Action | Result |
|--------|--------|
| Browser print (`Ctrl+P` / `Cmd+P`) | Formatted letter-size report with color accuracy enforced |

## 🔗 Dependencies
### Server Functions Called (`google.script.run`)
_None._ This is a pure server-rendered template with no client-side server calls.

### Called From (which .gs opens this HTML)
- `PreKMainCode.gs` — fills template variables and serves the rendered output, typically opened in a new window/tab or as a GAS sidebar/dialog for printing.

## ⚙️ Client-Side JavaScript Functions
_None._ This template contains no `<script>` blocks.
