Summary: Repository Structure & Understanding Confirmation

---

## Phase 7: Logic Layer Unification (February 2026)

**Status:** ✅ Complete (Phase 7g — Final Integration)

**Summary:** Phase 7 consolidated six school-specific deployments into a single, parameterized codebase. Schools no longer need per-school logic files — they configure everything through `SiteConfig_TEMPLATE.gs` and the unified Setup Wizard, then use the shared unified modules.

### Unified Architecture

```
SiteConfig_TEMPLATE.gs        ← School-specific configuration (feature flags, layout, branding)
  └─► UnifiedConfig.gs        ← Resolves LAYOUT, COLORS, GRADE_METRICS, PREK_CONFIG from SITE_CONFIG
  └─► SetupWizard.gs (v4.0)   ← Canonical wizard (delegates feature menus to ModuleLoader.gs)
  └─► modules/ModuleLoader.gs ← Dynamic menu builder (buildFeatureMenu)

Phase2_ProgressTracking_Unified.gs   ← Replaces 6 school-specific Phase2 files
AdminImport_Unified.gs               ← Replaces school-specific import files (security + logging)
MixedGradeSupport_Unified.gs         ← Replaces school-specific mixed-grade files (co-teaching, SC)
```

### Key Unified Modules

| File | Description |
|------|-------------|
| `UnifiedConfig.gs` | Resolves `LAYOUT`, `SHEET_NAMES_V2`, `PREK_CONFIG`, `COLORS`, `GRADE_METRICS` from `SITE_CONFIG` at runtime |
| `Phase2_ProgressTracking_Unified.gs` | Consolidated Phase 2 progress tracking replacing 6 school copies |
| `AdminImport_Unified.gs` | CSV import with formula-injection prevention (`sanitizeCellValue`) and structured logging |
| `MixedGradeSupport_Unified.gs` | Mixed-grade group management with co-teaching and SC Classroom support |
| `SetupWizard.gs` | Canonical setup wizard — grade range model, layout config, all Phase 7 feature flags |
| `SetupWizardUI.html` | Wizard UI — Step 2 grade range presets, Step 6 system security flags, Step 8 layout inputs |
| `SiteConfig_TEMPLATE.gs` | Feature flag template with 24 flags, `MIXED_GRADE_CONFIG`, `SYNC_CONFIG`, `BRANDING_CONFIG`, `PROGRESS_TRACKING_CONFIG` |
| `modules/ModuleLoader.gs` | Builds optional feature submenus dynamically from enabled `SITE_CONFIG.features` |

### Phase Timeline

| Phase | Status | Summary |
|-------|--------|---------|
| Phase 4 | ✅ Complete | Feature modules extracted to `modules/` directory |
| Phase 5 | ✅ Complete | UI unification |
| Phase 6 | ✅ Complete | SharedConstants backport |
| Phase 7a | ✅ Complete | `UnifiedConfig.gs` — runtime config resolver |
| Phase 7b | ✅ Complete | `AdminImport_Unified.gs` — security + structured logging |
| Phase 7c | ✅ Complete | `MixedGradeSupport_Unified.gs` — co-teaching + SC Classroom |
| Phase 7d | ✅ Complete | `SetupWizard.gs` v4.0 — canonical wizard |
| Phase 7e | ✅ Complete | `SiteConfig_TEMPLATE.gs` — full 22-flag expansion |
| Phase 7f | ✅ Complete | `SetupWizardUI.html` — grade range model + layout inputs |
| Phase 7g | ✅ Complete | Final integration audit, bugfix pass, QA documentation |

### Documentation

- **[PHASE7G_FINAL_REPORT.md](PHASE7G_FINAL_REPORT.md)** — Executive summary, unified module inventory, per-school migration guide, known gaps fixed, deployment checklist
- **[QA_CHECKLIST.md](QA_CHECKLIST.md)** — Phase 7 E2E QA checklist (sections 7.1–7.6) plus legacy Phase 4 module tests
- **[PHASE7_UNIFIED_TEMPLATE.md](PHASE7_UNIFIED_TEMPLATE.md)** — Architecture diagram and per-school migration guide
- **[PHASE7F_SETUP_WIZARD_EXPANSION.md](PHASE7F_SETUP_WIZARD_EXPANSION.md)** — Phase 7f wizard expansion notes

---

## Phase 4: Feature Modules Extraction (February 2026)

**Status:** ✅ Complete

**Summary:** All optional features have been extracted into the `modules/` directory with feature flag-driven activation. This modular architecture allows schools to enable/disable features without code changes, reducing drift and simplifying maintenance.

### What Changed

1. **New Directory Structure:**
   ```
   modules/
   ├── README.md                    # Module documentation
   ├── AdminImport.gs               # Historical data import
   ├── CoachingDashboard.gs         # Weekly coaching metrics
   ├── GrantReporting.gs            # Grant report generation
   ├── GrowthHighlighter.gs         # Visual growth highlighting
   ├── MixedGradeSupport.gs         # Cross-grade grouping
   ├── ModuleLoader.gs              # Dynamic menu building
   ├── TutoringSystem.gs            # Dual-track progress
   ├── UnenrollmentAutomation.gs    # Auto-archival & Monday.com
   └── onOpen_Example.gs            # Implementation example
   
   SiteConfig_TEMPLATE.gs           # Feature flag configuration
   ```

2. **Feature Flags:** All features are now controlled via `SITE_CONFIG.features`:
   ```javascript
   const SITE_CONFIG = {
     features: {
       mixedGradeSupport: false,
       coachingDashboard: false,
       tutoringSystem: false,
       grantReporting: false,
       growthHighlighter: false,
       adminImport: false,
       unenrollmentAutomation: false
     }
   };
   ```

3. **Dynamic Menus:** Menu items now appear/disappear based on enabled features, using `buildFeatureMenu()` from `ModuleLoader.gs`.

### Benefits

- **Reduced Drift:** Modules are centralized, preventing version differences between schools
- **Cleaner Codebase:** Optional features are separated from core system
- **Easier Testing:** Features can be toggled on/off without code changes
- **Better Documentation:** Each module is self-documented with purpose and usage
- **Simplified Onboarding:** New schools only see features they need

### For School Administrators

To enable a feature for your school:
1. Open `SiteConfig_TEMPLATE.gs` in your Apps Script project
2. Set the desired feature flag to `true`
3. Configure any required settings (see `modules/README.md`)
4. Reload your spreadsheet

Menu items for enabled features will appear automatically.

### For Developers

When adding a new feature module:
1. Create the module in `modules/` directory
2. Add feature flag to `SiteConfig_TEMPLATE.gs`
3. Update `ModuleLoader.gs` to add menu items
4. Document in `modules/README.md`
5. Test with feature toggled on/off

---

Based on my thorough review of the repository files, here's what I found:

1. SHARED vs. SCHOOL-SPECIFIC FILES
Shared (Core Engine - All Schools)
AdelantePhase2_ProgressTracking.gs – Core UFLI system engine (shared with all schools via inheritance)
Lesson labels (UFLI L1-L128), skill sections, review lesson logic
Core calculation functions: calculateBenchmark(), calculateSectionPercentage()
Gateway logic for review lessons (pass ALL review lessons = 100% section credit)
Grade metrics (K-G8) with different denominators per grade
School-Specific Progress Tracking
Each school has its own *Phase2_ProgressTracking.gs file that appears identical in structure to Adelante's, with one key difference:

Adelante: Uses const declarations
Sankofa: Uses var declarations (likely an older version pattern)
Allegiant, CCA, CHAW, GlobalPrep: Own versions with same core structure
FLAG: This suggests these are copied files that should be consolidated. All contain identical SKILL_SECTIONS, REVIEW_LESSONS, GRADE_METRICS, and calculation logic.

2. SCHOOL-UNIQUE MODULES IDENTIFIED
Adelante – K-8, Mixed Grades + Self-Contained
✅ AdelanteMixedGradeSupport_Enhanced.gs – Mixed grade group handling
✅ AdelanteNameValidator.gs – Name validation (legacy utility)
✅ AdelanteMapGrades.gs – Grade mapping logic
✅ AdelanteMissingStudents.gs – Missing student detection
✅ AdelanteNonGroupedStudents.gs – Ungrouped student tracking
✅ AdelanteStudentReconv1.gs – Student reconciliation (legacy)
✅ AdelanteSyncQueueProcessor.gs – Async sync queue
✅ AdelanteUnenrollmentAutomation.gs – Automatic unenrollment workflow
✅ AdelanteGenerateReportsUI.html – Custom reports interface
✅ AdelanteGrowthHighlighter.gs + AdelanteGrowthHighlighterSidebar.html – Visual growth highlighting
✅ AdelanteManageGroupsUI.html & AdelanteManageStudentsUI.html – CANONICAL VERSIONS (per your note)
Note: Adelante has the most mature and feature-rich implementation, including utilities for data cleanup and reconciliation.

Sankofa – K-6, Mixed Grades + Co-Teaching
✅ SankofaCoachView.gs – Weekly coaching dashboard visualization
✅ SankofaStudentHistory.gs – Weekly AG% growth tracking by skill section
Tracks growth (Total% - Initial%) for each student's active skill section
Supports weekly triggers (auto-capture every Monday at 6 AM)
Uses conditional formatting (red→yellow→green color scale)
✅ SankofaWeeklyCoachingDashboard.gs – Coach-facing metrics dashboard
✅ SankofaMixedGradeSupport_Enhanced.gs – Large mixed-grade support (111KB, most complex)
Handles K-6 mixed-grade groups
Co-teaching logic with partner groups
"SC Classroom" (Self-Contained Classroom) support
Sankofa format: "Student Name" header rows + group name in column D
FLAG: Sankofa's mixed-grade support is significantly more complex than Adelante's. This suggests Sankofa may have more intricate grouping patterns.

Global Prep – Single Grade, Tutoring + Whole Group + Grant Reports
✅ GlobalPrepTutoringSystem.gs – DUAL-TRACK PROGRESS SYSTEM
Separates whole-group UFLI instruction from tutoring interventions
Routes data to TWO parallel sheets:
"Tutoring Progress Log" (intervention tracking)
"Tutoring Summary" (aggregated tutoring stats)
Categorizes lessons: "UFLI Reteach", "Comprehension", "Other"
Tracks pass rates by intervention type
✅ GlobalPrepMindTrustReport.gs – Grant reporting module (47KB)
FLAG: GlobalPrep's tutoring system is architecturally separate and routes dual entries. This is a significant divergence from the UFLI-only model.

CHAW (Christel House Academy West) – K-8, Large Scale
✅ CHAWMixedGradeSupport_Enhanced.gs – Mixed-grade support (67KB, second largest)
Large Phase2_ProgressTracking.gs (129KB – largest)
CCA, Allegiant
Minimal school-specific code; rely on SetupWizard and Phase2 files
CCA and Allegiant have smaller Phase2 files (85KB, 99KB) with simpler configurations
3. STRUCTURAL PATTERNS ACROSS SITES
File Naming Convention
Code
[SchoolName][Component][Suffix].[Extension]

Examples:
- AdelantePhase2_ProgressTracking.gs
- SankofaStudentHistory.gs
- GlobalPrepTutoringSystem.gs
Shared Setup Wizard Pattern
Each school has its own setup wizard that owns:

Configuration constants
Menu creation
Wizard UI (HTML dialogs)
Manage Groups/Students interfaces
Examples:

AdelanteSetUpWizard.gs / AdelanteSetupWizardUI.html
SankofaSetupWizard.gs (no separate HTML, suggests inline UI)
GlobalPrepSetupWizard.gs
CCASetupWizard.gs
CHAWSetupWizard.gs
Lesson Entry Forms
All schools have school-specific lesson entry forms:

AdelanteLessonEntryForm.html
SankofaLessonEntryForm.html
GlobalPrepLessonEntryForm.html
etc.
4. STANDALONE / SHARED FUNCTIONALITY
Pre-K (School-Agnostic)
✅ PreKMainCode.gs – Core Pre-K system (Handwriting Without Tears)
Fixed denominators: Form(26), Name+Sound(52), Full(78)
✅ PreK.html* files (Dashboard, Index, ParentReport, Portal, SetupWizard, TutorForm)
Note: Pre-K uses a completely different data structure (26-letter matrix vs. 128-lesson UFLI matrix). It's integrated into GlobalPrep's routing but separate from the main UFLI engine.

5. AMBIGUITIES & FLAGS
Files Needing Clarification:
AdelanteUtilities.gs (4KB) – Very small file

Purpose unclear from name alone; appears to be legacy utility functions
SankofaCoachView.gs (11KB) –

Related to but separate from SankofaWeeklyCoachingDashboard.gs
Need clarification: Is CoachView the data layer and WeeklyCoachingDashboard the UI?
GlobalPrepMindTrustReport.gs (47KB) –

"MindTrust" grant reporting
Unclear how this integrates with the tutoring system
Allegiant files –

Only has AdminImport.gs, LessonEntryForm.html, and Phase2_ProgressTracking.gs
Missing SetupWizard and Manage UI files; are they shared or deleted?
Version Control –

Multiple Phase2 files suggest code duplication, not shared imports
Adelante's "Enhanced" mixed-grade support suggests it's a reference implementation
Question: Should other schools' mixed-grade code be synchronized with Adelante's?
const vs. var –

Adelante uses const (modern)
Sankofa uses var (older)
Suggests different development timelines
6. ARCHITECTURAL OBSERVATIONS
Single Source of Truth (Absent)

No shared/common folder
Each school has its own complete copy of:
SetupWizard
Phase2_ProgressTracking
Manage UI files
Risk: Bug fixes in one school don't auto-propagate
Gateway Logic Standardized

All Phase2 files contain identical REVIEW_LESSONS array and gateway logic
This suggests intentional standardization, but implementation is duplicated
Two Clear Patterns:

"Simple" Schools (Allegiant, CCA) – Minimal customization
"Complex" Schools (Adelante, Sankofa, CHAW) – Custom utilities, dashboards, mixed-grade support
My Understanding: Confirmed or Flagged for Clarification
✅ Confirmed:

Each school has its own configuration and UI setup
Adelante = reference implementation for K-8 mixed grades
Sankofa = K-6 mixed grades + co-teaching + coaching dashboards
GlobalPrep = Tutoring-focused with dual-track system
Pre-K = Standalone, integrated via routing
⚠️ Needs Clarification:

How do schools without SetupWizard files (if any) initialize?
Is duplicated Phase2 code intentional or technical debt?
What's the relationship between SankofaCoachView and WeeklyCoachingDashboard?
Are Adelante's Manage UI files the "canonical versions" to sync TO other schools, or FROM them?
Should GlobalPrep's tutoring system model be replicated to other schools if they need intervention tracking?

---

## APPENDIX: Business Requirements Document (BRD)

### Shared Constants Module (SharedConstants.gs)

**Purpose:** Centralized business-rule constants shared across all schools to ensure consistency and simplify maintenance.

**Implementation Date:** February 2026

**Affected Schools:** Adelante, Allegiant, CCA, CHAW, GlobalPrep, Sankofa

#### Constants Defined

##### 1. LESSON_LABELS (Object)
- **Type:** Object with 128 key-value pairs
- **Keys:** Lesson numbers (1-128)
- **Values:** UFLI lesson labels (e.g., "UFLI L1 a/ā/")
- **Purpose:** Human-readable labels for all UFLI lessons used in headers, reports, and UI displays
- **Example:** 
  ```javascript
  1: "UFLI L1 a/ā/"
  35: "UFLI L35 Short A Review (inclu. Nasalized A)"
  128: "UFLI L128 Affixes Review 2"
  ```

##### 2. SKILL_SECTIONS (Object)
- **Type:** Object with 16 skill section names mapped to lesson number arrays
- **Purpose:** Defines which lessons belong to each skill section for progress tracking
- **Sections:**
  1. Single Consonants & Vowels (32 lessons)
  2. Blends (2 lessons)
  3. Alphabet Review & Longer Words (7 lessons)
  4. Digraphs (12 lessons)
  5. VCE (9 lessons)
  6. Reading Longer Words (6 lessons)
  7. Ending Spelling Patterns (8 lessons)
  8. R-Controlled Vowels (7 lessons)
  9. Long Vowel Teams (5 lessons)
  10. Other Vowel Teams (6 lessons)
  11. Diphthongs (3 lessons)
  12. Silent Letters (1 lesson)
  13. Suffixes & Prefixes (8 lessons)
  14. Suffix Spelling Changes (4 lessons)
  15. Low Frequency Spellings (8 lessons)
  16. Additional Affixes (10 lessons)

##### 3. REVIEW_LESSONS (Array)
- **Type:** Array of 23 lesson numbers
- **Values:** `[35,36,37,39,40,41,49,53,57,59,62,71,76,79,83,88,92,97,102,104,105,106,128]`
- **Purpose:** Gateway tests - passing ALL review lessons in a section grants 100% credit
- **Logic:** If any review lesson is populated, student must pass ALL reviews to get 100% section credit; otherwise falls back to non-review calculation

##### 4. REVIEW_LESSONS_SET (Set)
- **Type:** Set containing review lesson numbers
- **Purpose:** O(1) lookup performance for checking if a lesson is a review lesson
- **Implementation:** `new Set(REVIEW_LESSONS)`

##### 5. PERFORMANCE_THRESHOLDS (Object)
- **Type:** Object with numeric threshold values
- **Values:**
  - `ON_TRACK: 80` (>= 80% performance)
  - `NEEDS_SUPPORT: 50` (>= 50% performance)
- **Purpose:** Defines score boundaries for performance status classification
- **Status Ranges:**
  - >= 80%: On Track
  - 50-79%: Needs Support
  - < 50%: Intervention

##### 6. STATUS_LABELS (Object)
- **Type:** Object with status label strings
- **Values:**
  - `ON_TRACK: "On Track"`
  - `NEEDS_SUPPORT: "Needs Support"`
  - `INTERVENTION: "Intervention"`
- **Purpose:** Standardized text labels for performance status across all reports and UI

##### 7. getPerformanceStatus() (Function)
- **Parameters:** `percentage` (number, 0-100)
- **Returns:** Status label string ("On Track", "Needs Support", or "Intervention")
- **Purpose:** Helper function to determine performance status from a percentage score
- **Logic:**
  ```javascript
  if (percentage >= 80) return "On Track";
  if (percentage >= 50) return "Needs Support";
  return "Intervention";
  ```

#### Usage Notes

1. **Import Pattern:** All Phase2_ProgressTracking.gs files reference SharedConstants.gs for these constants
2. **No Logic Changes:** This is a pure extraction - all values remain exactly as they were in the original Adelante implementation
3. **Backward Compatibility:** All school-specific Phase2 files updated to reference shared constants instead of local definitions
4. **Maintenance:** Any future changes to business rules (e.g., threshold adjustments) only need to be made in one place

#### Validation

**Test Criteria:**
- All 6 schools' Phase2_ProgressTracking.gs files successfully reference SharedConstants
- No functional changes to lesson calculations, skill section percentages, or performance status determination
- All existing reports, dashboards, and UI displays continue to work as before

**Verification Date:** [Pending QA]
