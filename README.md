Summary: Repository Structure & Understanding Confirmation
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
