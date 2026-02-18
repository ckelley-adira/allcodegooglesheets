# Phase 7a: Logic File Audit & Feature Mapping Report

**Report Date:** February 18, 2026  
**Purpose:** Consolidation planning for per-school logic files into unified parameterized templates  
**Resolves:** https://github.com/ckelley-adira/allcodegooglesheets/issues/20

---

## Executive Summary

This audit analyzed **17 school-specific logic files** across 4 major file groups to identify consolidation opportunities. The analysis reveals:

- **Phase2_ProgressTracking**: 6 versions with 90%+ shared code, ready for immediate consolidation
- **SetupWizard**: 6 versions with diverging feature sets, requires feature flag expansion
- **MixedGradeSupport**: 3 versions with structural similarity, parameterization-ready
- **AdminImport**: 2 versions nearly identical, minor security harmonization needed

**Key Finding:** An estimated **65-75% of code** can be consolidated into shared modules with proper feature flags and configuration parameters.

---

## 1. File-by-File Delta Summary

### 1.1 Phase2_ProgressTracking Files

**Analyzed Files:**
- `AdelantePhase2_ProgressTracking.gs`
- `AllegiantPhase2_ProgressTracking.gs`
- `SankofaPhase2_ProgressTracking.gs`
- `GlobalPrepPhase2_ProgressTracking.gs`
- `CCAPhase2_ProgressTracking.gs`
- `CHAWPhase2_ProgressTracking.gs`

#### Functions Present in ALL Versions (Core Candidates for Shared Code)

**Formatting & Display (7 functions):**
- `createMergedHeader()` - Table header creation with merge styling
- `applyStatusConditionalFormatting()` - Color-coding for lesson status cells
- `setColumnHeaders()` - Column naming and header setup
- `calculatePercentage()` - Lesson progress percentage calculation
- `renderDashboardHeader()` - Dashboard title and navigation
- `renderGradeCard()` - Grade-level summary cards
- `renderMetricsRow()` - Performance metrics display

**Sheet Generation (10 functions):**
- `generateSystemSheets()` - Creates all required system sheets
- `createSmallGroupProgressSheet()` - Small group tracking sheet
- `createUFLIMapSheet()` - UFLI lesson mapping
- `createSkillsSheet()` - Skills progress tracker
- `createGradeSummarySheet()` - Grade-level summary statistics
- `createGradeGroupSheets()` - Grade-specific group sheets
- `createSingleGradeSheet()` - Individual grade sheet generation
- `createPacingReports()` - Pacing analysis reports
- `createSchoolSummarySheet()` - Main dashboard sheet
- `createGroupConfigSheet()` - Group configuration storage

**Data Processing (12 functions):**
- `updateAllProgress()` - Syncs all progress data across sheets
- `updateSchoolSummary()` - Updates main dashboard with latest data
- `buildStudentLookups()` - Creates student reference maps
- `buildProgressHistory()` - Historical tracking construction
- `scanGradeSheetsForPacing()` - Pacing analysis across grades
- `getSheetDataAsMap()` - Sheet data retrieval as key-value pairs
- `getExistingGrades()` - Active grade level detection
- `updatePacingReports()` - Refresh pacing calculations
- `syncSmallGroupProgress()` - Sync group progress to master sheets
- `updateStatsForNewStudents()` - Initialize statistics for new students
- `calculateGrowthMetrics()` - Student growth calculations
- `calculateDistributionBands()` - Performance distribution analysis

**Repair & Maintenance (8 functions):**
- `repairSkillsTrackerFormulas()` - Fix Skills sheet formulas
- `repairGradeSummaryFormulas()` - Fix Grade Summary formulas
- `repairAllFormulas()` - Comprehensive formula repair
- `repairCurrentLessonFormulas()` - Current lesson formula fixes
- `repairUFLIMapFormatting()` - UFLI MAP sheet formatting
- `repairAllGroupSheetFormatting()` - Group sheet formatting repair
- `addSkillFormulasForRow()` - Add formulas for new rows
- `addGradeSummaryFormulasForRow()` - Add summary formulas for new rows

#### Functions Present in SOME Versions (Feature Flag Candidates)

| Function | Adelante | Allegiant | Sankofa | GlobalPrep | CCA | CHAW | Recommendation |
|----------|:--------:|:---------:|:-------:|:----------:|:---:|:----:|----------------|
| `testGroupSheetStructure()` | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ | Feature flag: `diagnosticTools` |
| `addSkillFormulasForRow()` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | Include in shared (5/6 schools) |
| `addGradeSummaryFormulasForRow()` | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | Include in shared (5/6 schools) |
| `addStudentToSheet()` | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ | Feature flag: `dynamicStudentRoster` |
| `updateGroupArrayByLessonName()` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | Feature flag: `lessonArrayTracking` |
| `buildDashboardRow()` | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | Include in shared (5/6 schools) |
| `calculateSkillAverages()` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | School-specific (CCA only) |
| `renderSkillAveragesRow()` | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ | School-specific (CCA only) |

#### Functions Unique to ONE Version (School-Specific)

**Adelante Only (Branding System):**
- `normalizeStudent()` - Custom student field normalization
- `lightenColor()` - Color manipulation utility
- `clearBrandingCache()` - Branding cache management
- `loadSchoolBranding()` - Dynamic branding loading
- `insertSheetLogo()` - School logo insertion on sheets
- `applySheetBranding()` - Custom branding application to sheets

**CHAW Only (Similar Branding):**
- `loadSchoolBranding()`, `lightenColor()`, `insertSheetLogo()`, `applySheetBranding()`
- `getCHAWConfig()` - CHAW-specific configuration retrieval

**Sankofa Only (Custom Stats):**
- `updateAllStats_Sankofa()` - Alternative statistics update logic
- `goToSchoolSummary()` - Navigation helper function

**GlobalPrep Only (Tutoring Integration):**
- `renderProgressBar()` with `studentNames` parameter - Extended progress bar with student list

**CCA Only (Skill Analytics):**
- `calculateSkillAverages()` - Skill-based performance analytics
- `renderSkillAveragesRow()` - Dashboard row for skill metrics
- `buildStudentLookups(mapSheet)` - Unique signature accepting mapSheet parameter

**Allegiant Only:**
- `getAllegiantConfig()` - School-specific configuration retrieval

#### Architectural Variations

**Branding Approach:**
- **Adelante & CHAW**: Dynamic branding with logo insertion and color customization
- **Others**: Static branding or no custom branding

**Statistics Calculation:**
- **Sankofa**: Custom `updateAllStats_Sankofa()` with different calculation logic
- **Others**: Standard `updateAllProgress()` approach

**Skill Tracking:**
- **CCA**: Extended skill averaging and analytics
- **Others**: Standard skill tracking only

**Function Signatures:**
- `renderGradeCard()`: Parameter variations (Adelante has `overrideCount`, CCA minimal params)
- `buildStudentLookups()`: CCA accepts optional `mapSheet` parameter
- `formatPacingSheet()`: CCA omits `dataStartRow` parameter

---

### 1.2 SetupWizard Files

**Analyzed Files:**
- `SetupWizard.gs` (existing shared/canonical version)
- `AdelanteSetUpWizard.gs`
- `CCASetupWizard.gs`
- `CHAWSetupWizard.gs`
- `GlobalPrepSetupWizard.gs`
- `SankofaSetupWizard.gs`

#### Functions Present in ALL Versions (Core Setup Functions)

**Core Infrastructure (9 functions):**
- `onOpen()` - Menu initialization and feature activation
- `isSystemConfigured()` - Configuration status check
- `doGet()` - Web app initialization
- `startSetupWizard()` - Launch setup wizard dialog
- `logMessage()` - Structured logging
- `formatDateSafe()` - Date formatting utility
- `createResult()` - Result object creation
- `validateRequiredProps()` - Required property validation
- `getTeacherForGroup()` - Teacher assignment lookup

**Configuration Functions (12 functions):**
- `openSettings()` - Settings dialog launcher
- `getWizardData()` - Load wizard configuration data
- `getExistingStudents()` - Retrieve current student roster
- `getExistingTeachers()` - Retrieve current teacher roster
- `getExistingGroups()` - Retrieve current group assignments
- `getExistingGradeMixing()` - Mixed grade configuration retrieval
- `getExistingFeatures()` - Feature flag status retrieval
- `calculateGroupRecommendations()` - Auto-calculate recommended groups
- `autoBalanceStudents()` - Auto-balance students across groups
- `validateStep1()` through `validateStep6()` - Multi-step validation
- `saveConfiguration()` - Persist wizard configuration

**Sheet Management (6 functions):**
- `createConfigurationSheet()` - Configuration storage sheet
- `createStudentRosterSheet()` - Student roster sheet
- `createTeacherRosterSheet()` - Teacher roster sheet
- `createGroupConfigSheet()` - Group configuration sheet
- `createFeatureSettingsSheet()` - Feature flags storage sheet
- `protectSheet()` - Sheet protection utility

**Student & Group Management (12 functions):**
- `manageStudents()` - Student management dialog
- `getStudentRosterData()` - Retrieve roster for editing
- `saveStudent()` - Save student record
- `deleteStudent()` - Remove student record
- `updateStudentInSheet()` - Update existing student
- `addStudentToSheet()` - Add new student
- `deleteStudentFromSheet()` - Delete student from sheet
- `manageGroups()` - Group management dialog
- `getGroupsData()` - Retrieve group data for editing
- `saveGroups()` - Save group configuration
- `syncStudentGroupsToTrackers()` - Sync groups to progress trackers
- `getGroupsFromConfiguration()` - Load groups from config

**Report & Lesson Management (7 functions):**
- `generateReports()` - Report generation dialog
- `getReportOptions()` - Available report types
- `buildReport()` - Generate specific report
- `getGroupsForForm()` - Groups for lesson entry form
- `getLessonsAndStudentsForGroup()` - Lesson data for group
- `getLessonsForGrade()` - Available lessons for grade
- `saveLessonData()` - Save lesson entry data

**PreK Support (6 functions):**
- `getPreKStudentsByGroup()` - PreK roster by group
- `getPreKSequences()` - PreK lesson sequences
- `getPreKAssessmentData()` - PreK assessment data
- `getPreKSkillsForGroup()` - Skills for PreK group
- `savePreKAssessmentData()` - Save PreK assessments
- `testPreKFunctions()` - PreK feature testing

#### Functions Present in SOME Versions (Feature-Dependent)

| Function | SetupWizard | Adelante | CCA | CHAW | GlobalPrep | Sankofa | Purpose |
|----------|:-----------:|:--------:|:---:|:----:|:----------:|:-------:|---------|
| **UFLI MAP Queue Support** |
| `getExistingLessonData()` | ✅ | ✅ | ✅* | ✅ | ✅* | ✅ | Queue data retrieval |
| `extractLessonNumber()` | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | Lesson parsing |
| `logUnenrolledStudents()` | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | Student archival logging |
| `updateGroupSheetTargeted()` | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | Targeted progress updates |
| `updateUFLIMapTargeted()` | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | Targeted UFLI MAP updates |
| **Sync & Automation** |
| `runFullSyncDeferred()` | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | Deferred full sync |
| `recalculateAllStatsNow()` | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | Statistics recalculation |
| `setupNightlySyncTrigger()` | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | Automated sync setup |
| `removeNightlySyncTrigger()` | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | Remove automated sync |
| **Branding** |
| `getExistingBranding()` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | Branding configuration |
| **Status Monitoring** |
| `showSyncStatus()` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ | Sync queue status dialog |
| `showTriggerStatus()` | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ | Trigger configuration status |

*Note: CCA and GlobalPrep have `getExistingLessonData()` with different signature: `(groupName, lessonName)` vs `(gradeSheet, groupName, lessonName)`

#### Functions Unique to ONE Version

**CCA Only (Formula-Centric Approach):**
- `refreshGradeSummaryFormulas()` - Refresh all grade summary formulas
- `updateAllProgress()` - CCA-specific progress update logic
- `updateFormulasForNewStudents()` - Formula initialization for new students
- `repairUFLIMapFormatting()` - UFLI MAP formatting repair
- `repairCurrentLessonFormulas()` - Current lesson formula fixes
- `fixMissingTeachers()` - Teacher assignment repair
- `syncSmallGroupProgress()` - Small group progress synchronization
- `repairAllFormulas()` - Comprehensive formula repair
- `updateUFLIMapWithStatuses()` - Status-based UFLI MAP updates
- `updateGroupSheetWithStatuses()` - Status-based group sheet updates

**GlobalPrep Only (Tutoring-Centric):**
- `syncAllProgress()` - Global progress synchronization
- `goToTutoringSummary()` - Navigate to tutoring summary sheet
- `goToTutoringLog()` - Navigate to tutoring log sheet
- `syncTutoringProgress()` - Synchronize tutoring progress data
- `createTutoringSheets()` - Initialize tutoring system sheets
- `saveLessonData_OLD()` - Deprecated lesson data saving method
- **Code duplication:** `getGroupsFromConfiguration()` defined 3 times

**Sankofa Only (Coaching-Centric):**
- `openCoachView()` - Launch weekly coaching dashboard
- `refreshCoachView()` - Refresh coaching metrics
- `setupCoachViewTrigger()` - Auto-refresh coaching dashboard

#### Menu Structure Variations

| Menu Item | SetupWizard | Adelante | CCA | CHAW | GlobalPrep | Sankofa |
|-----------|:-----------:|:--------:|:---:|:----:|:----------:|:-------:|
| **Core Menus** |
| Setup System | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View School Summary | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Generate Reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage Students | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Manage Groups | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Sync & Performance** |
| Sync & Performance Submenu | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Show Sync Queue Status | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Show Trigger Status | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Run Full Sync Now | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Recalculate All Stats | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| Setup Nightly Sync | ✅ | ✅ | ❌ | ✅ | ❌ | ✅ |
| **School-Specific Features** |
| Refresh Grade Summary | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Update All Progress | ❌ | ❌ | ✅ | ❌ | ✅ | ❌ |
| Repair Tools Submenu | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Tutoring Submenu | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Coach Tools Submenu | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

#### Architectural Patterns Identified

**Pattern 1: Standard (SetupWizard, Adelante, CHAW)**
- Full UFLI MAP queue processing support
- Targeted lesson data updates with timestamp tracking
- Nightly sync automation
- Comprehensive sync & performance menu

**Pattern 2: CCA Variant (Formula-Focused)**
- No UFLI MAP queue system
- Emphasis on formula repairs and refreshes
- Grade summary calculation focus
- Simplified menu structure
- Dedicated "Repair Tools" submenu

**Pattern 3: GlobalPrep Variant (Tutoring-Focused)**
- Tutoring system integration throughout
- Alternative lesson data saving approach
- Progress synchronization emphasis
- Code duplication issues (multiple `getGroupsFromConfiguration()` definitions)
- Simplified sync menu

**Pattern 4: Sankofa Variant (Coaching-Focused)**
- Weekly coaching dashboard features
- Coach view auto-refresh
- Simplified sync (nightly only, no queue)
- No UFLI MAP queue support
- Dedicated "Coach Tools" menu

---

### 1.3 MixedGradeSupport Files

**Analyzed Files:**
- `AdelanteMixedGradeSupport_Enhanced.gs`
- `CHAWMixedGradeSupport_Enhanced.gs`
- `SankofaMixedGradeSupport_Enhanced.gs`

#### Functions Present in ALL Versions (40+ Core Functions)

**Sheet & Configuration (8 functions):**
- `getSheetNameForGrade()` - Map grade to sheet name
- `getSheetNameForGroup()` - Map group to sheet name
- `getMixedGradeConfig()` - Load mixed grade configuration
- `getGroupsFromConfiguration()` - Load group definitions
- `isMixedGradeGroup()` - Check if group is mixed-grade
- `getGradesForGroup()` - Extract grades from group name
- `getSoloGroupsForGrade()` - Get single-grade groups only
- `getMixedGradeGroupsForGrade()` - Get mixed-grade groups for a grade

**Lesson & Student Tracking (7 functions):**
- `getLessonsAndStudentsForGroup_MixedGrade()` - Lesson data retrieval
- `updateGroupArrayByLessonName_MixedGrade()` - Update lesson progress arrays
- `getStudentsInGroup()` - Student roster for group
- `getGroupForStudent()` - Reverse lookup: student → group
- `addStudentToMixedGradeGroup()` - Add student to mixed group
- `removeStudentFromMixedGradeGroup()` - Remove student from mixed group
- `moveStudentBetweenGroups()` - Transfer student between groups

**Sheet Generation & Formatting (8 functions):**
- `createMixedGradeSheet()` - Generate mixed-grade tracking sheet
- `formatSheet_Standard()` - STANDARD format (column A headers)
- `formatSheet_Sankofa()` - SANKOFA format (column D groups)
- `addGroupColumnHeaders()` - Group column headers
- `addLessonRows()` - Lesson tracking rows
- `setupFormulas()` - Formula initialization
- `protectSheet()` - Sheet protection
- `updateSheetFormatting()` - Refresh sheet formatting

**Pacing & Reporting (6 functions):**
- `scanGradeSheetsForPacing_MixedGrade()` - Pacing analysis
- `generatePacingReport_MixedGrade()` - Pacing report generation
- `calculateGroupPacing()` - Group-level pacing metrics
- `calculateMixedGradePacing()` - Mixed-grade pacing analytics
- `getDashboardMetrics_MixedGrade()` - Dashboard metrics
- `renderMixedGradeDashboard()` - Dashboard rendering

**Data Sync & Validation (6 functions):**
- `syncMixedGradeProgress()` - Sync progress across sheets
- `validateMixedGradeConfiguration()` - Config validation
- `validateGroupStructure()` - Group structure validation
- `repairMixedGradeFormulas()` - Formula repair for mixed grades
- `rebuildMixedGradeSheets()` - Regenerate mixed-grade sheets
- `testMixedGradeSetup()` - Mixed-grade testing utility

**Constants & Configuration:**
- `MIXED_GRADE_CONFIG` object with grade combinations
- `SHEET_FORMAT` selection (STANDARD vs SANKOFA)
- `GROUP_NAMING_PATTERN` options (NUMBERED_TEACHER, NUMBERED, ALPHA)

#### School-Specific Variations

| Feature | **Adelante** | **CHAW** | **Sankofa** |
|---------|--------------|----------|-------------|
| **Mixed Grade Combinations** |
| KG + G1 | ❌ | ✅ | ✅ |
| G2 + G3 | ❌ | ✅ | ✅ |
| G4 + G5 + G6 | ❌ | ✅ | ❌ |
| G6 + G7 + G8 | ✅ | ❌ | ✅ |
| **SC Classroom Support** |
| SC Classroom Enabled | ✅ | ❌ | ✅ |
| SC Grade Range | G1-G5 | N/A | G1-G4 |
| SC Sub-Groups | Yes | N/A | Yes |
| **Co-Teaching Support** |
| Co-Teaching Functions | ❌ | ❌ | ✅ |
| `getPartnerGroup()` | ❌ | ❌ | ✅ |
| `isCoTeachingGroup()` | ❌ | ❌ | ✅ |
| `getAllCoTeachingPairs()` | ❌ | ❌ | ✅ |
| `getAllSoloGroups()` | ❌ | ❌ | ✅ |
| **Format & Naming** |
| Default Sheet Format | STANDARD | STANDARD | STANDARD |
| Group Naming Pattern | NUMBERED_TEACHER | NUMBERED_TEACHER | NUMBERED_TEACHER |

#### Different Approaches to Mixed Grade Grouping

**Sankofa (Most Comprehensive):**
- **5 mixed-grade combinations**: KG-G1, G2-G3, G4-G6, G6-G8, SC Classroom (G1-G4)
- **Dedicated grade range functions:**
  - `getGradeForGroup()` - Extract grades from group name
  - `isG6ToG8Group()` - Check if group is G6-G8
  - `isG4ToG6Group()` - Check if group is G4-G6
- **Full co-teaching support:**
  - `getPartnerGroup(groupName)` - Find co-teaching partner
  - `isCoTeachingGroup(groupName)` - Check if group has partner
  - `getAllCoTeachingPairs()` - List all co-teaching pairs
  - `getAllSoloGroups()` - List all non-co-teaching groups
- **SC Classroom as mixed group** with sub-group tracking

**Adelante (SC Classroom Focused):**
- **2 mixed-grade combinations**: G6-G8, SC Classroom (G1-G5)
- **SC Classroom emphasis:**
  - Treats "SC Classroom" as special case with 5-grade range
  - Deprecated flat SC handling (commented: "flawed G6 to G8 check")
  - SC Classroom scan logic for multi-group format (note: deprecated)
- **No co-teaching support**
- Simpler mixed-grade detection logic

**CHAW (Minimal Configuration):**
- **3 mixed-grade combinations**: KG-G1, G2-G3, G4-G6
- **No SC Classroom variant**
- **No co-teaching support**
- Simplest implementation
- Straightforward grade range handling

#### Parameterizable Features

**High Priority (Direct Config Candidates):**

1. **MIXED_GRADE_CONFIG Object** - Currently hardcoded per school
   ```javascript
   mixedGradeCombinations: [
     {grades: ["KG", "G1"], sheetName: "KG-G1 Mixed"},
     {grades: ["G2", "G3"], sheetName: "G2-G3 Mixed"},
     {grades: ["G4", "G5", "G6"], sheetName: "G4-G6 Mixed"},
     {grades: ["G6", "G7", "G8"], sheetName: "G6-G8 Mixed"}
   ]
   ```

2. **SC Classroom Configuration**
   ```javascript
   scClassroom: {
     enabled: true,
     gradeRange: ["G1", "G2", "G3", "G4"],  // or ["G1", "G2", "G3", "G4", "G5"]
     hasSubGroups: true,
     sheetName: "SC Classroom"
   }
   ```

3. **Co-Teaching Configuration**
   ```javascript
   coTeaching: {
     enabled: true,
     partnerGroupColumn: 3,  // Column index in Group Config sheet
     pairingStrategy: "manual"  // or "automatic"
   }
   ```

4. **Sheet Format Selection** - Already parameterized but not consistently applied
   ```javascript
   sheetFormat: "STANDARD"  // or "SANKOFA"
   ```

5. **Group Naming Pattern** - Already parameterized
   ```javascript
   groupNamingPattern: "NUMBERED_TEACHER"  // or "NUMBERED", "ALPHA"
   ```

**Medium Priority (Behavioral Variations):**
- Grade range detection patterns (e.g., `["G4", "G5", "G6"]` vs `["G6", "G7", "G8"]`)
- Dashboard formatting preferences
- Column mappings for SANKOFA format

**Low Priority (Minor Variations):**
- Logging verbosity levels
- Error message text customization
- Comment/documentation text

---

### 1.4 AdminImport Files

**Analyzed Files:**
- `AdelanteAdminImport.gs`
- `AllegiantAdminImport.gs`

#### Functions Present in BOTH Versions (26 Functions)

**Core Workflow Functions:**
- `showImportDialog()` - Display CSV import dialog
- `processCSVImport()` - Parse and stage CSV data
- `validateImportData()` - Validate staged data
- `processValidatedData()` - Import validated records
- `archiveImportData()` - Archive processed data

**Parsing & Detection (5 functions):**
- `parseCSV()` - CSV string parsing
- `detectFormat()` - Grid vs Row format detection
- `parseGridFormat()` - Grid-style CSV parsing
- `parseRowFormat()` - Row-style CSV parsing
- `extractHeaders()` - Header row extraction

**Validation Functions (7 functions):**
- `validateRow()` - Row-level validation orchestrator
- `validateStudentName()` - Name format validation
- `validateLessonName()` - Lesson name validation
- `validateStatus()` - Status value validation
- `validateDate()` - Date format validation
- `validateNotes()` - Notes field validation
- `validateRequiredFields()` - Required field presence check

**Data Processing (7 functions):**
- `mapToUFLIMap()` - Map import data to UFLI_MAP sheet
- `mapToInitialAssessment()` - Map to Initial Assessment sheet
- `updateProgressTracking()` - Sync to progress tracking sheets
- `createExceptionRecord()` - Create exception log entry
- `archiveToHistorical()` - Archive to Small Group Historical sheet
- `clearStagingSheet()` - Clean up staging data
- `refreshAllStats()` - Trigger full statistics recalculation

**Sheet Management (4 functions):**
- `createStagingSheet()` - Initialize Import Staging sheet
- `createExceptionsSheet()` - Initialize Import Exceptions sheet
- `getStagingData()` - Retrieve staged import data
- `getExceptionData()` - Retrieve import exceptions

**Utility Functions (3 functions):**
- `formatImportDate()` - Date formatting for import
- `generateImportId()` - Unique import identifier
- `getImportStats()` - Import statistics summary

#### Differences Between Versions

**Adelante (Security-Hardened):**
- **Has `sanitizeCellValue()` function** (lines 424-444):
  - Formula injection prevention (strips `=`, `+`, `-`, `@` prefixes)
  - Null byte removal for security
  - String length limit enforcement (32,767 chars max)
  - Whitespace normalization
- **Data padding** (lines 306-312): Explicitly pads rows to 5 columns before adding metadata
- **No structured logging function**

**Allegiant (Diagnostics-Focused):**
- **Missing security sanitization** - No `sanitizeCellValue()` function
  - **Security gap:** Vulnerable to formula injection attacks
  - **Security gap:** No null byte filtering
  - **Security gap:** No string length validation
- **Has `log(func, msg, lvl)` function** for structured logging
- **Simpler data mapping** (line 306): Direct assignment without explicit padding

#### Import Process (Identical Workflow)

**Phase 1: CSV Input & Staging**
1. User opens import dialog via menu
2. Pastes CSV data into dialog
3. System detects format (Grid vs Row)
4. Parses CSV into structured data
5. Loads data into "Import Staging" sheet with validation status column

**Phase 2: Validation**
1. Row-by-row validation via `validateRow()`
2. Checks: Name format, lesson format, status values, required fields
3. Validation results stored in status column (✓ = valid, ✗ = invalid)
4. Invalid rows logged to "Import Exceptions" sheet with:
   - Row number, student name, issue type, details, raw data

**Phase 3: Processing & Archival**
1. Valid rows mapped to UFLI_MAP sheet
2. Initial assessment data mapped to Initial Assessment sheet
3. Progress tracking updated via `updateAllStats()` from Phase2_ProgressTracking
4. Validated data copied to "Small Group Historical" sheet
5. Staging sheet cleared

**Dependencies:**
- `Phase2_ProgressTracking.js`: `updateAllStats()`, `extractLessonNumber()`
- Global constants: `COLORS`, `LAYOUT`, `SHEET_NAMES`, `SHEET_NAMES_V2`

#### Import Type Support (Both Versions)

**Initial Assessment Import:**
- Grid format: Students as rows, lessons as columns
- Row format: One row per student-lesson combination
- Captures: Student name, lesson names, status (N/A, P, M)

**Lesson Progress Import:**
- Student name, lesson name, status, date, notes
- Incremental progress updates
- Historical tracking

#### Constants (Identical in Both)

```javascript
const ADMIN_SHEET_NAMES = {
  STAGING: "Import Staging",
  EXCEPTIONS: "Import Exceptions",
  HISTORICAL: "Small Group Historical"
};

const IMPORT_COLUMNS = {
  STUDENT_NAME: 0,
  LESSON_NAME: 1,
  STATUS: 2,
  DATE: 3,
  NOTES: 4
};

const IMPORT_TYPES = {
  INITIAL_ASSESSMENT: "initial",
  LESSON_PROGRESS: "progress"
};

const VALID_STATUSES = ["N/A", "P", "M", "IP", ""];
```

#### Security Comparison

| Security Feature | Adelante | Allegiant |
|------------------|:--------:|:---------:|
| Formula injection prevention | ✅ | ❌ |
| Null byte filtering | ✅ | ❌ |
| String length validation | ✅ | ❌ |
| Whitespace normalization | ✅ | ✅ |
| Input validation (names, lessons) | ✅ | ✅ |
| Exception logging | ✅ | ✅ |

**Recommendation:** Adopt Adelante's sanitization approach in consolidated version.

---

## 2. Feature Flag Matrix

This matrix maps features/capabilities across all schools. Use this to design feature flags for `SiteConfig_TEMPLATE.gs`.

### 2.1 Grade Range & Structure

| Feature | Adelante | Allegiant | Sankofa | GlobalPrep | CCA | CHAW |
|---------|:--------:|:---------:|:-------:|:----------:|:---:|:----:|
| **Grade Levels Supported** |
| PreK | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Kindergarten (KG) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Grades 1-5 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Grades 6-8 | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 2.2 Mixed Grade Support

| Feature | Adelante | Allegiant | Sankofa | GlobalPrep | CCA | CHAW |
|---------|:--------:|:---------:|:-------:|:----------:|:---:|:----:|
| **Mixed Grade Combinations** |
| Mixed Grades Enabled | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| KG + G1 | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| G2 + G3 | ❌ | ❌ | ✅ | ❌ | ❌ | ✅ |
| G4 + G5 + G6 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| G6 + G7 + G8 | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ |
| SC Classroom (G1-G4) | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| SC Classroom (G1-G5) | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Co-Teaching Support | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |

### 2.3 Tracking & Reporting Features

| Feature | Adelante | Allegiant | Sankofa | GlobalPrep | CCA | CHAW |
|---------|:--------:|:---------:|:-------:|:----------:|:---:|:----:|
| **Progress Tracking** |
| Standard Progress Tracking | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| UFLI MAP Queue System | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Lesson Array Tracking | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Skill Averages Analytics | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| Custom Stats Calculation | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Report Generation** |
| Standard Reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Pacing Reports | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Growth Metrics | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Distribution Analysis | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

### 2.4 Branding & UI Customization

| Feature | Adelante | Allegiant | Sankofa | GlobalPrep | CCA | CHAW |
|---------|:--------:|:---------:|:-------:|:----------:|:---:|:----:|
| **Branding System** |
| Dynamic Branding | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Sheet Logo Insertion | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Custom Color Schemes | ✅ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Branding Cache | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 2.5 Coaching & Support Features

| Feature | Adelante | Allegiant | Sankofa | GlobalPrep | CCA | CHAW |
|---------|:--------:|:---------:|:-------:|:----------:|:---:|:----:|
| **Coaching Support** |
| Coaching Dashboard | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Coach View | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Weekly Metrics | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |
| Auto-Refresh Coach View | ❌ | ❌ | ✅ | ❌ | ❌ | ❌ |

### 2.6 Tutoring System

| Feature | Adelante | Allegiant | Sankofa | GlobalPrep | CCA | CHAW |
|---------|:--------:|:---------:|:-------:|:----------:|:---:|:----:|
| **Tutoring Features** |
| Tutoring System | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Tutoring Progress Log | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Tutoring Summary | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Dual-Track Progress | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| Tutoring Sync | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

### 2.7 Grant Reporting

| Feature | Adelante | Allegiant | Sankofa | GlobalPrep | CCA | CHAW |
|---------|:--------:|:---------:|:-------:|:----------:|:---:|:----:|
| **Grant Reports** |
| Mind Trust Reporting | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

### 2.8 Admin Tools & Import

| Feature | Adelante | Allegiant | Sankofa | GlobalPrep | CCA | CHAW |
|---------|:--------:|:---------:|:-------:|:----------:|:---:|:----:|
| **Admin Import** |
| Admin Import System | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Historical Data Import | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Import Validation | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Exception Reporting | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Security Sanitization | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 2.9 Sync & Automation

| Feature | Adelante | Allegiant | Sankofa | GlobalPrep | CCA | CHAW |
|---------|:--------:|:---------:|:-------:|:----------:|:---:|:----:|
| **Sync Queue** |
| UFLI MAP Queue Processing | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Targeted Updates | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Deferred Full Sync | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Automation** |
| Nightly Sync Triggers | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Auto Stats Recalculation | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Status Monitoring** |
| Sync Status Dialog | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ |
| Trigger Status Dialog | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |

### 2.10 Maintenance & Repair

| Feature | Adelante | Allegiant | Sankofa | GlobalPrep | CCA | CHAW |
|---------|:--------:|:---------:|:-------:|:----------:|:---:|:----:|
| **Formula Repair** |
| Skills Tracker Repair | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Grade Summary Repair | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| All Formulas Repair | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Current Lesson Repair | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| UFLI MAP Formatting | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Group Sheet Formatting | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Dedicated Repair Menu | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |

### 2.11 Student Management

| Feature | Adelante | Allegiant | Sankofa | GlobalPrep | CCA | CHAW |
|---------|:--------:|:---------:|:-------:|:----------:|:---:|:----:|
| **Student Roster** |
| Student Management Dialog | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Add Student | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit Student | ❌ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Delete Student | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Unenrolled Student Logging | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| Student Normalization | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

### 2.12 Diagnostic & Testing

| Feature | Adelante | Allegiant | Sankofa | GlobalPrep | CCA | CHAW |
|---------|:--------:|:---------:|:-------:|:----------:|:---:|:----:|
| **Diagnostics** |
| Group Sheet Structure Test | ❌ | ✅ | ✅ | ✅ | ❌ | ✅ |
| Mixed Grade Test | ✅ | ❌ | ✅ | ❌ | ❌ | ✅ |
| PreK Function Test | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Structured Logging | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ |

---

## 3. Parameterization Recommendations

### 3.1 Phase2_ProgressTracking Consolidation

**Unified Module:** `Phase2_ProgressTracking_Unified.gs`

#### What Goes Into Shared Module (90% of code)

**Core Functions (All Schools):**
- Sheet generation: `generateSystemSheets()`, `create*Sheet()` functions
- Data processing: `updateAllProgress()`, `buildStudentLookups()`, etc.
- Formatting: `createMergedHeader()`, `applyStatusConditionalFormatting()`, etc.
- Dashboard rendering: `renderDashboard*()`, `renderGradeCard()`, etc.
- Repair utilities: `repairAllFormulas()`, `repair*Formulas()` functions
- Pacing analysis: `scanGradeSheetsForPacing()`, `updatePacingReports()`, etc.

**Standardize function signatures** (currently inconsistent):
- `renderGradeCard()`: Standardize to accept `(grade, gradeData, initialData, overrideCount)`
- `buildStudentLookups()`: Standardize to accept optional `mapSheet` parameter
- `formatPacingSheet()`: Standardize to always include `dataStartRow` parameter

#### What Becomes SITE_CONFIG Feature Flags

```javascript
SITE_CONFIG.features = {
  // Existing flags (from Phase 4)
  mixedGradeSupport: true,
  coachingDashboard: false,
  tutoringSystem: false,
  grantReporting: false,
  growthHighlighter: false,
  adminImport: false,
  unenrollmentAutomation: false,
  
  // New flags for Phase 7
  dynamicBranding: false,           // Adelante, CHAW
  skillAveragesAnalytics: false,    // CCA
  diagnosticTools: false,           // Allegiant, Sankofa, GlobalPrep, CHAW
  lessonArrayTracking: true,        // Adelante, Allegiant, Sankofa, CHAW (default ON)
  studentNormalization: false       // Adelante
};
```

#### What Must Remain School-Specific (10% of code)

**School-specific overrides:**
- `AdelanteBrandingExtensions.gs` - `loadSchoolBranding()`, `insertSheetLogo()`, etc.
- `CHAWBrandingExtensions.gs` - Same branding functions as Adelante
- `SankofaStatsExtensions.gs` - `updateAllStats_Sankofa()` custom logic
- `CCASkillsExtensions.gs` - `calculateSkillAverages()`, `renderSkillAveragesRow()`

**Configuration objects** (referenced by shared module):
- `AdelanteConfig.gs` - `getAdelanteConfig()`
- `CHAWConfig.gs` - `getCHAWConfig()`
- `AllegiantConfig.gs` - `getAllegiantConfig()`

---

### 3.2 SetupWizard Consolidation

**Unified Module:** `SetupWizard_Unified.gs` (extend existing `SetupWizard.gs`)

#### What Goes Into Shared Module

**All core setup functions** (already mostly shared):
- Setup wizard: `startSetupWizard()`, `getWizardData()`, validation functions
- Student/Group management: `manageStudents()`, `manageGroups()`, etc.
- Report generation: `generateReports()`, `buildReport()`, etc.
- Sheet creation: `create*Sheet()` functions
- PreK support: `getPreKStudentsByGroup()`, etc.

**Consolidate duplicated functions:**
- `getExistingLessonData()` - Unify signatures (add optional `gradeSheet` parameter)
- `getGroupsFromConfiguration()` - Remove duplicates in GlobalPrep

#### What Becomes SITE_CONFIG Feature Flags

```javascript
SITE_CONFIG.features = {
  // ... existing flags ...
  
  // New flags for Setup & Sync
  ufliMapQueue: true,               // Adelante, Allegiant, Sankofa, CHAW (default ON)
  syncQueueProcessing: true,        // Same as ufliMapQueue
  nightlySyncAutomation: true,      // Adelante, Allegiant, Sankofa, CHAW
  syncStatusMonitoring: false,      // Adelante, CHAW
  triggerManagement: true,          // Most schools
  formulaRepairTools: false,        // CCA only
  studentEditCapability: false      // Allegiant, GlobalPrep, CCA
};
```

#### What Remains School-Specific

**School-specific menu items** handled via feature flag checks:
- CCA: Repair tools submenu (controlled by `formulaRepairTools` flag)
- GlobalPrep: Tutoring menu (controlled by existing `tutoringSystem` flag)
- Sankofa: Coach tools menu (controlled by existing `coachingDashboard` flag)

**School-specific functions** (called conditionally):
- CCA: `refreshGradeSummaryFormulas()`, `updateFormulasForNewStudents()`, etc.
- GlobalPrep: `syncTutoringProgress()`, `createTutoringSheets()`, etc.
- Sankofa: `openCoachView()`, `refreshCoachView()`, `setupCoachViewTrigger()`

**Pattern:** Use dynamic menu building (like Phase 4 module system):
```javascript
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  const menu = ui.createMenu('Adira Reads Progress Report');
  
  // Add core items
  addCoreMenuItems(menu);
  
  // Conditionally add feature menus
  if (isFeatureEnabled('ufliMapQueue')) {
    addSyncMenu(menu, ui);
  }
  if (isFeatureEnabled('formulaRepairTools')) {
    addRepairToolsMenu(menu, ui);
  }
  // ... etc
  
  menu.addToUi();
}
```

---

### 3.3 MixedGradeSupport Consolidation

**Unified Module:** `MixedGradeSupport_Unified.gs`

#### What Goes Into Shared Module (95% of code)

**All 40+ common functions:**
- Sheet management: `getSheetNameForGrade()`, `createMixedGradeSheet()`, etc.
- Lesson tracking: `getLessonsAndStudentsForGroup_MixedGrade()`, etc.
- Formatting: `formatSheet_Standard()`, `formatSheet_Sankofa()`, etc.
- Pacing/Reporting: `scanGradeSheetsForPacing_MixedGrade()`, etc.
- Data sync: `syncMixedGradeProgress()`, etc.

**Make grade combinations configurable** via `SITE_CONFIG`:
```javascript
MIXED_GRADE_CONFIG = {
  enabled: true,
  sheetFormat: "STANDARD",  // or "SANKOFA"
  groupNamingPattern: "NUMBERED_TEACHER",
  
  combinations: [
    {grades: ["KG", "G1"], sheetName: "KG-G1", enabled: true},
    {grades: ["G2", "G3"], sheetName: "G2-G3", enabled: true},
    {grades: ["G4", "G5", "G6"], sheetName: "G4-G6", enabled: false},
    {grades: ["G6", "G7", "G8"], sheetName: "G6-G8", enabled: true}
  ],
  
  scClassroom: {
    enabled: true,
    gradeRange: ["G1", "G2", "G3", "G4"],  // or ["G1", ..., "G5"]
    hasSubGroups: true,
    sheetName: "SC Classroom"
  },
  
  coTeaching: {
    enabled: false,  // Sankofa only by default
    partnerGroupColumn: 3
  }
};
```

#### What Becomes SITE_CONFIG Feature Flags

```javascript
SITE_CONFIG.features = {
  // ... existing flags ...
  mixedGradeSupport: true,  // Already exists from Phase 4
  
  // New sub-features
  scClassroomGroups: false,   // Adelante, Sankofa
  coTeachingSupport: false    // Sankofa only
};
```

#### What Remains School-Specific (5% of code)

**Sankofa-specific co-teaching functions** (conditionally loaded):
- `getPartnerGroup()`, `isCoTeachingGroup()`, `getAllCoTeachingPairs()`, `getAllSoloGroups()`
- Only loaded when `MIXED_GRADE_CONFIG.coTeaching.enabled === true`

**Grade range detection helpers** (parameterized by config):
- `isG6ToG8Group()`, `isG4ToG6Group()` → Generalized to `isGradeRangeGroup(group, rangeConfig)`

**SC Classroom handling** (controlled by `scClassroom` config):
- Dynamic based on `gradeRange` and `hasSubGroups` settings

---

### 3.4 AdminImport Consolidation

**Unified Module:** `AdminImport_Unified.gs`

#### What Goes Into Shared Module (100% of code)

**All 26 functions are school-agnostic:**
- Dialog & workflow: `showImportDialog()`, `processCSVImport()`, etc.
- Parsing: `parseCSV()`, `detectFormat()`, `parseGridFormat()`, `parseRowFormat()`
- Validation: `validateRow()`, `validate*()` functions
- Processing: `mapToUFLIMap()`, `mapToInitialAssessment()`, etc.
- Sheet management: `createStagingSheet()`, `createExceptionsSheet()`, etc.

**Adopt Adelante's security sanitization:**
- Include `sanitizeCellValue()` function in shared module
- Apply to all user inputs (formula injection prevention, null byte filtering, length validation)

**Include structured logging:**
- Adopt Allegiant's `log(func, msg, lvl)` function for diagnostics

#### What Becomes SITE_CONFIG Feature Flags

```javascript
SITE_CONFIG.features = {
  // ... existing flags ...
  adminImport: true,  // Already exists from Phase 4
  
  // New sub-features
  structuredLogging: false,      // Allegiant-style diagnostics
  enhancedSecurity: true         // Adelante-style sanitization (default ON)
};
```

#### What Remains School-Specific (0% of code)

**Nothing is school-specific** - The module is fully universal.

**School-specific dependencies** (external to AdminImport):
- Phase2_ProgressTracking: `updateAllStats()`, `extractLessonNumber()`
- Global constants: `SHEET_NAMES`, `COLORS`, `LAYOUT` (from SharedConstants or site config)

---

## 4. Proposed SiteConfig_TEMPLATE.gs Feature Flag Additions

Based on the audit findings, here are the recommended additions to `SiteConfig_TEMPLATE.gs`:

```javascript
// ═══════════════════════════════════════════════════════════════════════════
// SITE CONFIGURATION TEMPLATE - PHASE 7 ENHANCEMENTS
// ═══════════════════════════════════════════════════════════════════════════

const SITE_CONFIG = {
  schoolName: "Your School Name",
  systemVersion: "5.0",  // Updated for Phase 7
  
  branding: {
    schoolName: "Your School Name",
    shortName: "",
    tagline: "Innovate. Educate. Empower.",
    logoUrl: "",
    primaryColor: "#B8E6DC",
    headerGradientStart: "#4A90E2",
    headerGradientEnd: "#357ABD",
    accentColor: "#4A90A4"
  },
  
  features: {
    // ═══════════════════════════════════════════════════════════════════════════
    // EXISTING PHASE 4 FLAGS (Keep as-is)
    // ═══════════════════════════════════════════════════════════════════════════
    mixedGradeSupport: false,
    coachingDashboard: false,
    tutoringSystem: false,
    grantReporting: false,
    growthHighlighter: false,
    adminImport: false,
    unenrollmentAutomation: false,
    
    // ═══════════════════════════════════════════════════════════════════════════
    // NEW PHASE 7 FLAGS - PROGRESS TRACKING ENHANCEMENTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * DYNAMIC BRANDING
     * Enables sheet logo insertion and custom color schemes
     * Required for: Schools with strong brand identity (Adelante, CHAW)
     * Adds: loadSchoolBranding(), insertSheetLogo(), applySheetBranding()
     * Dependencies: Branding configuration in SITE_CONFIG.branding
     */
    dynamicBranding: false,
    
    /**
     * SKILL AVERAGES ANALYTICS
     * Adds skill-based performance metrics to dashboard
     * Required for: Schools tracking skill mastery (CCA)
     * Adds: calculateSkillAverages(), renderSkillAveragesRow()
     * Dashboard: Additional "Skill Averages" row on School Summary
     */
    skillAveragesAnalytics: false,
    
    /**
     * DIAGNOSTIC TOOLS
     * Testing and validation utilities for troubleshooting
     * Required for: Schools needing advanced diagnostics
     * Adds: testGroupSheetStructure(), validation utilities
     * Menu: "System Tools" > "Run Diagnostics"
     */
    diagnosticTools: false,
    
    /**
     * LESSON ARRAY TRACKING
     * Tracks lessons as arrays for batch operations
     * Required for: Most schools (default: ON)
     * Adds: updateGroupArrayByLessonName()
     * Performance: Optimizes multi-lesson updates
     */
    lessonArrayTracking: true,
    
    /**
     * STUDENT NORMALIZATION
     * Auto-normalize student name fields (capitalization, spacing)
     * Required for: Schools with data quality needs (Adelante)
     * Adds: normalizeStudent() validation
     */
    studentNormalization: false,
    
    // ═══════════════════════════════════════════════════════════════════════════
    // NEW PHASE 7 FLAGS - SETUP & SYNC ENHANCEMENTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * UFLI MAP QUEUE PROCESSING
     * Enables queue-based lesson data processing with targeted updates
     * Required for: Most schools (default: ON)
     * Adds: UFLI MAP queue, targeted updates, deferred sync
     * Menu: "Sync & Performance" submenu
     */
    ufliMapQueue: true,
    
    /**
     * NIGHTLY SYNC AUTOMATION
     * Automated nightly statistics recalculation
     * Required for: Schools with large rosters
     * Adds: setupNightlySyncTrigger(), removeNightlySyncTrigger()
     * Automation: Triggers at 2 AM daily
     */
    nightlySyncAutomation: true,
    
    /**
     * SYNC STATUS MONITORING
     * View queue status and sync progress
     * Required for: Schools needing visibility (Adelante, CHAW)
     * Adds: showSyncStatus() dialog
     * Menu: "Sync & Performance" > "Show Sync Queue Status"
     */
    syncStatusMonitoring: false,
    
    /**
     * TRIGGER MANAGEMENT
     * View and manage time-based triggers
     * Required for: Most schools (default: ON)
     * Adds: showTriggerStatus() dialog
     * Menu: "System Tools" > "Show Trigger Status"
     */
    triggerManagement: true,
    
    /**
     * FORMULA REPAIR TOOLS
     * Dedicated formula repair and refresh utilities
     * Required for: Schools with complex formulas (CCA)
     * Adds: refreshGradeSummaryFormulas(), updateFormulasForNewStudents()
     * Menu: "Repair Tools" submenu
     */
    formulaRepairTools: false,
    
    /**
     * STUDENT EDIT CAPABILITY
     * Allow editing existing student records (vs add/delete only)
     * Required for: Schools needing roster flexibility (Allegiant, GlobalPrep, CCA)
     * Adds: updateStudentInSheet() in student management dialog
     */
    studentEditCapability: false,
    
    // ═══════════════════════════════════════════════════════════════════════════
    // NEW PHASE 7 FLAGS - MIXED GRADE SUB-FEATURES
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * SC CLASSROOM GROUPS
     * Special needs classroom with wide grade range
     * Required for: Schools with SC programs (Adelante, Sankofa)
     * Adds: SC Classroom sheet generation and tracking
     * Configuration: MIXED_GRADE_CONFIG.scClassroom
     */
    scClassroomGroups: false,
    
    /**
     * CO-TEACHING SUPPORT
     * Partner group tracking for co-taught classes
     * Required for: Schools with co-teaching model (Sankofa)
     * Adds: getPartnerGroup(), isCoTeachingGroup(), co-teaching pair management
     * Configuration: MIXED_GRADE_CONFIG.coTeaching
     */
    coTeachingSupport: false,
    
    // ═══════════════════════════════════════════════════════════════════════════
    // NEW PHASE 7 FLAGS - SECURITY & DIAGNOSTICS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * ENHANCED SECURITY
     * Input sanitization and formula injection prevention
     * Required for: All schools (default: ON)
     * Adds: sanitizeCellValue() for all user inputs
     * Security: Prevents formula injection, null bytes, excessive length
     */
    enhancedSecurity: true,
    
    /**
     * STRUCTURED LOGGING
     * Detailed logging for troubleshooting and auditing
     * Required for: Schools needing audit trails (Allegiant)
     * Adds: log(func, msg, lvl) structured logging
     * Output: Logged to execution transcript
     */
    structuredLogging: false
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// PHASE 7 CONFIGURATION OBJECTS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mixed Grade Support Configuration (Enhanced)
 * Only used if features.mixedGradeSupport = true
 */
const MIXED_GRADE_CONFIG = {
  enabled: false,
  sheetFormat: "STANDARD",  // "STANDARD" or "SANKOFA"
  groupNamingPattern: "NUMBERED_TEACHER",  // "NUMBERED_TEACHER", "NUMBERED", or "ALPHA"
  
  // Mixed grade combinations
  // Set enabled: true for combinations your school uses
  combinations: [
    {
      grades: ["KG", "G1"],
      sheetName: "KG-G1 Mixed",
      enabled: false
    },
    {
      grades: ["G2", "G3"],
      sheetName: "G2-G3 Mixed",
      enabled: false
    },
    {
      grades: ["G4", "G5", "G6"],
      sheetName: "G4-G6 Mixed",
      enabled: false
    },
    {
      grades: ["G6", "G7", "G8"],
      sheetName: "G6-G8 Mixed",
      enabled: false
    }
  ],
  
  // SC (Special Classroom) Configuration
  // Only used if features.scClassroomGroups = true
  scClassroom: {
    enabled: false,
    gradeRange: ["G1", "G2", "G3", "G4"],  // Sankofa: G1-G4, Adelante: G1-G5
    hasSubGroups: true,  // true = multiple groups within SC, false = single group
    sheetName: "SC Classroom"
  },
  
  // Co-Teaching Configuration
  // Only used if features.coTeachingSupport = true
  coTeaching: {
    enabled: false,
    partnerGroupColumn: 3,  // Column index in Group Config sheet for partner group
    pairingStrategy: "manual"  // "manual" = teacher defines pairs, "automatic" = system suggests
  }
};

/**
 * Progress Tracking Configuration (New)
 * Controls progress tracking behavior
 */
const PROGRESS_TRACKING_CONFIG = {
  // Statistics calculation method
  statsCalculationMethod: "standard",  // "standard" or "custom" (Sankofa uses "custom")
  
  // Skill tracking
  enableSkillAverages: false,  // Set true for CCA-style skill analytics
  
  // Lesson array tracking
  useLessonArrays: true,  // Recommended: true for performance
  
  // Pacing report settings
  pacingReportFrequency: "weekly",  // "daily", "weekly", "monthly"
  pacingThresholds: {
    onTrack: 1.0,     // Lessons per week
    falling: 0.5,
    concern: 0.25
  }
};

/**
 * Sync & Queue Configuration (New)
 * Controls sync queue and automation behavior
 */
const SYNC_CONFIG = {
  // Queue processing
  enableQueue: true,  // Enable UFLI MAP queue system
  queueBatchSize: 50,  // Process N entries per batch
  
  // Nightly automation
  nightlySyncEnabled: true,
  nightlySyncHour: 2,  // 24-hour format (2 = 2 AM)
  
  // Targeted updates
  useTargetedUpdates: true,  // Recommended: true for performance
  timestampTracking: true,   // Track last update times
  
  // Deferred sync
  deferredSyncDelay: 5  // Seconds to wait before full sync
};

/**
 * Branding Configuration (Enhanced)
 * Extended branding options for dynamicBranding feature
 */
const BRANDING_CONFIG = {
  // Sheet branding
  insertLogosOnSheets: false,  // Insert logo on generated sheets
  logoPosition: "A1",  // Cell position for logo
  logoHeight: 50,  // Logo height in pixels
  
  // Color customization
  useCustomColors: false,  // Apply custom colors to sheets
  colorScheme: {
    headerBackground: "#4A90E2",
    headerText: "#FFFFFF",
    alternateRowBackground: "#F5F5F5",
    highlightColor: "#B8E6DC"
  },
  
  // Caching
  enableBrandingCache: true  // Cache branding data for performance
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS (Updated)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Gets the configuration object for a specific feature
 * @param {string} featureName - Name of the feature
 * @returns {Object} Configuration object for the feature
 */
function getFeatureConfig(featureName) {
  const configMap = {
    mixedGradeSupport: MIXED_GRADE_CONFIG,
    coachingDashboard: COACHING_CONFIG,
    tutoringSystem: TUTORING_CONFIG,
    grantReporting: GRANT_CONFIG,
    growthHighlighter: GROWTH_CONFIG,
    adminImport: IMPORT_CONFIG,
    unenrollmentAutomation: UNENROLLMENT_CONFIG,
    // Phase 7 additions
    progressTracking: PROGRESS_TRACKING_CONFIG,
    syncQueue: SYNC_CONFIG,
    dynamicBranding: BRANDING_CONFIG
  };
  
  return configMap[featureName] || {};
}
```

---

## 5. Recommended Consolidation Order

Based on complexity, dependencies, and risk, here is the recommended order for Phase 7b–7g:

### Phase 7b: AdminImport Consolidation (Complexity: LOW)
**Duration:** 1-2 days  
**Risk:** Low  
**Dependencies:** None (self-contained module)

**Tasks:**
1. Create `AdminImport_Unified.gs` by merging Adelante and Allegiant versions
2. Adopt Adelante's security sanitization (`sanitizeCellValue()`)
3. Include Allegiant's structured logging (`log()`)
4. Add feature flags: `enhancedSecurity`, `structuredLogging`
5. Test with both Adelante and Allegiant configurations
6. Deprecate school-specific files

**Why first:** 
- Simplest consolidation (2 near-identical files)
- No dependencies on other modules
- High value (security improvements benefit all schools)
- Good warm-up for more complex consolidations

---

### Phase 7c: MixedGradeSupport Consolidation (Complexity: MEDIUM)
**Duration:** 3-5 days  
**Risk:** Medium  
**Dependencies:** Phase2_ProgressTracking (for data sync)

**Tasks:**
1. Create `MixedGradeSupport_Unified.gs` from 3 versions
2. Parameterize grade combinations via `MIXED_GRADE_CONFIG`
3. Make SC Classroom configurable (grade range, sub-groups)
4. Extract Sankofa's co-teaching functions to conditional module
5. Add feature flags: `scClassroomGroups`, `coTeachingSupport`
6. Test all 3 school configurations thoroughly
7. Deprecate school-specific files

**Why second:**
- Moderate complexity (3 files with 95% shared code)
- Clear parameterization path (config-driven)
- Limited dependencies (mostly self-contained)
- Co-teaching is optional extension, not core requirement

---

### Phase 7d: Phase2_ProgressTracking Consolidation (Complexity: HIGH)
**Duration:** 5-7 days  
**Risk:** High  
**Dependencies:** Mixed from Phase 7c (if enabled), SharedConstants

**Tasks:**
1. Create `Phase2_ProgressTracking_Unified.gs` from 6 versions
2. Standardize function signatures (`renderGradeCard()`, `buildStudentLookups()`, etc.)
3. Add feature flags: `dynamicBranding`, `skillAveragesAnalytics`, `diagnosticTools`, `lessonArrayTracking`, `studentNormalization`
4. Extract school-specific extensions:
   - `AdelanteBrandingExtensions.gs`, `CHAWBrandingExtensions.gs`
   - `SankofaStatsExtensions.gs`
   - `CCASkillsExtensions.gs`
5. Create `PROGRESS_TRACKING_CONFIG` configuration object
6. Comprehensive testing across all 6 schools
7. Deprecate school-specific files

**Why third:**
- Most complex consolidation (6 files)
- Core system component (high risk if broken)
- Multiple feature variations to accommodate
- Benefits from lessons learned in 7b and 7c

---

### Phase 7e: SetupWizard Menu Unification (Complexity: MEDIUM)
**Duration:** 3-4 days  
**Risk:** Medium  
**Dependencies:** All previous phases (calls functions from other modules)

**Tasks:**
1. Extend existing `SetupWizard.gs` to support all feature combinations
2. Implement dynamic menu building (Phase 4 pattern)
3. Add feature flags: `ufliMapQueue`, `nightlySyncAutomation`, `syncStatusMonitoring`, `triggerManagement`, `formulaRepairTools`, `studentEditCapability`
4. Consolidate duplicated functions (especially GlobalPrep's `getGroupsFromConfiguration()`)
5. Unify `getExistingLessonData()` signatures
6. Test all menu combinations across schools
7. Deprecate school-specific SetupWizard files

**Why fourth:**
- Depends on consolidated modules from 7b-7d
- Menu system orchestrates other modules
- Less risky than 7d (mostly UI logic, not data processing)

---

### Phase 7f: Configuration Migration & Testing (Complexity: MEDIUM)
**Duration:** 3-4 days  
**Risk:** Medium  
**Dependencies:** All previous phases

**Tasks:**
1. Create school-specific configuration files:
   - `SiteConfig_Adelante.gs`
   - `SiteConfig_Allegiant.gs`
   - `SiteConfig_Sankofa.gs`
   - `SiteConfig_GlobalPrep.gs`
   - `SiteConfig_CCA.gs`
   - `SiteConfig_CHAW.gs`
2. Populate with correct feature flags and configurations
3. End-to-end testing for each school configuration
4. Validate all features work as expected
5. Performance testing (especially sync operations)
6. Create migration guide for deployment

**Why fifth:**
- Requires all modules to be consolidated first
- Critical validation step before production
- Ensures no regressions for any school

---

### Phase 7g: Documentation & Cleanup (Complexity: LOW)
**Duration:** 2-3 days  
**Risk:** Low  
**Dependencies:** All previous phases

**Tasks:**
1. Update `ARCHITECTURE.md` with Phase 7 consolidation
2. Create `PHASE7_MIGRATION_GUIDE.md`
3. Update `SiteConfig_TEMPLATE.gs` documentation
4. Create `PHASE7_FEATURE_FLAG_REFERENCE.md`
5. Update `QA_CHECKLIST.md` with Phase 7 tests
6. Archive deprecated school-specific files (don't delete yet)
7. Create deployment checklist
8. Update README.md

**Why last:**
- Documentation after implementation is most accurate
- Cleanup is safest after all testing is complete
- Provides comprehensive guide for future maintenance

---

### Consolidation Timeline Summary

| Phase | Module | Complexity | Duration | Cumulative |
|-------|--------|------------|----------|------------|
| 7b | AdminImport | LOW | 1-2 days | 1-2 days |
| 7c | MixedGradeSupport | MEDIUM | 3-5 days | 4-7 days |
| 7d | Phase2_ProgressTracking | HIGH | 5-7 days | 9-14 days |
| 7e | SetupWizard | MEDIUM | 3-4 days | 12-18 days |
| 7f | Configuration & Testing | MEDIUM | 3-4 days | 15-22 days |
| 7g | Documentation & Cleanup | LOW | 2-3 days | 17-25 days |

**Total Estimated Duration:** 17-25 days (3.5-5 weeks)

---

## Appendices

### Appendix A: Cross-Reference Matrix

| File Group | Schools | Total Functions | Shared Functions | Shared % | Feature Variations |
|------------|---------|-----------------|------------------|----------|-------------------|
| Phase2_ProgressTracking | 6 | ~60-70 | ~55 | 90% | 5 major variations |
| SetupWizard | 6 | ~70-80 | ~60 | 85% | 4 architectural patterns |
| MixedGradeSupport | 3 | ~45 | ~40 | 95% | 3 configuration sets |
| AdminImport | 2 | 26 | 26 | 100% | Security only |

### Appendix B: Existing Shared Files Reference

**For comparison and consistency:**
- `SharedConstants.gs` - System-wide constants (grades, statuses, colors)
- `SharedEngine.gs` - Core engine functions (if exists)
- `SiteConfig_TEMPLATE.gs` - Feature flag template
- `modules/ModuleLoader.gs` - Dynamic menu builder (Phase 4)
- `modules/*.gs` - 7 feature modules from Phase 4

**Consolidation should follow established patterns from:**
- Phase 4 (module extraction and feature flags)
- Phase 5 (UI unification with server-side templating)
- Phase 6 (backporting best practices)

### Appendix C: Risk Mitigation Strategies

**High-Risk Areas:**
1. **Phase2_ProgressTracking consolidation** - Core data processing
   - Mitigation: Extensive unit tests, parallel deployment, gradual rollout
   
2. **Function signature changes** - Breaking changes
   - Mitigation: Maintain backwards compatibility wrappers initially
   
3. **Feature flag complexity** - Too many flags
   - Mitigation: Group related flags, provide presets for common configurations
   
4. **Performance degradation** - Conditional logic overhead
   - Mitigation: Performance benchmarking before/after, optimize hot paths
   
5. **School-specific regressions** - Features break for specific schools
   - Mitigation: Per-school QA checklist, shadow deployment period

---

## Conclusion

This audit demonstrates that **Phase 7 consolidation is highly feasible** with proper planning and execution. The analysis reveals:

✅ **High code similarity** across school versions (65-75% shared)  
✅ **Clear parameterization opportunities** via feature flags and configuration  
✅ **Well-defined extension points** for school-specific customizations  
✅ **Existing patterns** from Phase 4-6 to follow  
✅ **Manageable risk** with incremental consolidation approach  

The recommended consolidation order (7b → 7c → 7d → 7e → 7f → 7g) balances complexity, dependencies, and risk while maximizing learning from early phases.

**Expected Benefits:**
- **Maintainability:** Single source of truth for core logic
- **Consistency:** No version drift between schools
- **Scalability:** Easy to onboard new schools with configuration
- **Quality:** Unified testing and security improvements
- **Agility:** Feature updates deploy to all schools simultaneously

This audit report serves as the specification for implementing Phase 7b–7g.

---

**Report prepared by:** GitHub Copilot Workspace Agent  
**Review required:** @ckelley-adira  
**Next step:** Phase 7b implementation (AdminImport consolidation)
