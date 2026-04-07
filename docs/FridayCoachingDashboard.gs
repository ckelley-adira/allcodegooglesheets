// ═══════════════════════════════════════════════════════════════════════════
// FRIDAY COACHING DASHBOARD — "Big Four" UFLI/MTSS Metrics
// Portable / Self-Contained Version — no shared constants required.
//
// Drop into any school site. Reads existing data sheets to compute:
//   A. Lesson Reteach Frequency (the "Sticky" Factor)
//   B. Group Pass Rate — % of students at 80%+ Total section mastery
//   C. Student Growth vs. Expected Slope (2 lessons/week aimline)
//   D. Chronic Absenteeism Filter
//
// Plus:
//   - Coaching Priority Matrix (cross-referencing all four metrics)
//   - Monday Digest Email (fires Sunday morning via trigger)
//
// v2.1 — Section Bridge Detection:
//   - Dynamic min-lesson thresholds before mastery flags fire
//     Sections ≤ 3 lessons: must attempt ALL before flagging
//     Sections 4+ lessons: must attempt at least 3
//   - Section completion highlights when groups finish a section
//   - "Establishing Baseline" status for groups entering new sections
//
// v2.2 — Bridging Section Resolution + Metric C Absence Handling:
//   - Blends (L25, L27) resolves to SCV for dashboard purposes
//   - Previous-section lookup skips bridging sections
//   - Effective section lessons include bridged children for counting
//   - Metric C: Y > N > A status priority; all-absent weeks excluded
//
// Add to menu:
//   .addItem('Friday Dashboard', 'generateFridayDashboard')
//   .addItem('Send Monday Digest (Preview)', 'sendMondayDigestPreview')
//   .addItem('Setup Sunday Email Trigger', 'setupSundayDigestTrigger')
//
// DEPENDS ON: Small Group Progress, Grade Summary, UFLI MAP, Site Configuration
// ═══════════════════════════════════════════════════════════════════════════


// ─────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────

var FCD_CONFIG = {
  SHEET_NAME: "Friday Dashboard",
  SGP_SHEET: "Small Group Progress",
  GRADE_SUMMARY_SHEET: "Grade Summary",
  UFLI_MAP_SHEET: "UFLI MAP",
  SITE_CONFIG_SHEET: "Site Configuration",

  // Small Group Progress layout
  SGP_DATA_ROW: 4,
  SGP_COLS: { DATE: 0, TEACHER: 1, GROUP: 2, STUDENT: 3, LESSON: 4, STATUS: 5 },

  // Grade Summary layout (after static cols: Name, Grade, Teacher, Group, Found, Min, Full, Benchmark)
  GS_DATA_ROW: 4,
  GS_COLS: { NAME: 0, GRADE: 1, TEACHER: 2, GROUP: 3, FOUND: 4, MIN: 5, FULL: 6, BENCHMARK: 7 },
  GS_SKILL_DETAIL_START: 8,

  // Aimline: UFLI 2-day teach + Day 5 assessment = 2 lessons/week for all grades
  AIMLINE_LESSONS_PER_WEEK: 2,

  // Thresholds
  RETEACH_WARNING: 1,
  RETEACH_CRITICAL: 2,
  ABSENCE_WARNING: 0.30,
  ABSENCE_CRITICAL: 0.40,
  MASTERY_THRESHOLD: 0.80,
  GROWTH_CONCERN_WEEKS: 2,
  GROWTH_CONCERN_RATIO: 0.50,

  // Section bridge: default min lessons before mastery flags fire (for sections 4+)
  BRIDGE_MIN_DEFAULT: 3,

  // Lookback windows
  CURRENT_WEEK_DAYS: 7,
  ROLLING_WEEKS: 4,

  // Colors
  COLORS: {
    HEADER_BG: '#1a3c5e',
    HEADER_TEXT: '#ffffff',
    BLUE: '#1a73e8',
    LIGHT_BLUE: '#E8F0FE',
    GREEN: '#34A853',
    GREEN_BG: '#E6F4EA',
    YELLOW: '#B06000',
    YELLOW_BG: '#FEF7E0',
    RED: '#EA4335',
    RED_BG: '#FCE8E6',
    GRAY: '#5F6368',
    GRAY_BG: '#E8EAED',
    GRAY_ALT: '#F8F9FA',
    WHITE: '#FFFFFF',
    SECTION_BG: '#d9e2f3',
    PURPLE: '#7B1FA2',
    PURPLE_BG: '#F3E5F5',
    PRIORITY_COACHING: '#4285F4',
    PRIORITY_SYSTEMIC: '#EA4335',
    PRIORITY_FASTTRACK: '#34A853',
    PRIORITY_FIDELITY: '#B06000'
  }
};

// Skill sections — same as Student History
var FCD_SKILL_SECTIONS = {
  'Single Consonants & Vowels': [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,26,28,29,30,31,32,33,34],
  'Blends': [25,27],
  'Alphabet Review & Longer Words': [35,36,37,38,39,40,41],
  'Digraphs': [42,43,44,45,46,47,48,49,50,51,52,53],
  'VCE': [54,55,56,57,58,59,60,61,62],
  'Reading Longer Words': [63,64,65,66,67,68],
  'Ending Spelling Patterns': [69,70,71,72,73,74,75,76],
  'R-Controlled Vowels': [77,78,79,80,81,82,83],
  'Long Vowel Teams': [84,85,86,87,88],
  'Other Vowel Teams': [89,90,91,92,93,94],
  'Diphthongs': [95,96,97],
  'Silent Letters': [98],
  'Suffixes & Prefixes': [99,100,101,102,103,104,105,106],
  'Suffix Spelling Changes': [107,108,109,110],
  'Low Frequency Spellings': [111,112,113,114,115,116,117,118],
  'Additional Affixes': [119,120,121,122,123,124,125,126,127,128]
};

// Ordered section names for bridge detection (previous/next section lookup)
var FCD_SECTION_ORDER = [
  'Single Consonants & Vowels',
  'Blends',
  'Alphabet Review & Longer Words',
  'Digraphs',
  'VCE',
  'Reading Longer Words',
  'Ending Spelling Patterns',
  'R-Controlled Vowels',
  'Long Vowel Teams',
  'Other Vowel Teams',
  'Diphthongs',
  'Silent Letters',
  'Suffixes & Prefixes',
  'Suffix Spelling Changes',
  'Low Frequency Spellings',
  'Additional Affixes'
];

/**
 * v2.2: Bridging section configuration.
 * Some UFLI skill sections are tiny (1–3 lessons) and embedded inside the
 * instructional flow of a larger parent section.  For dashboard purposes these
 * "bridging" sections resolve to their parent so that:
 *   - Students on bridging lessons are measured against the parent's GS column
 *   - Group section labels don't oscillate week-to-week
 *   - Previous-section lookups skip bridging sections
 *   - Lesson counts include bridged children
 *
 * Key: raw section name → parent section name
 * The canonical FCD_SKILL_SECTIONS is left untouched so that the UFLI Map
 * and Grade Summary column alignment are unaffected.
 */
var FCD_BRIDGING_SECTIONS = {
  'Blends': 'Single Consonants & Vowels'
};


// ─────────────────────────────────────────────────────────────────────────
// UTILITIES
// ─────────────────────────────────────────────────────────────────────────

function fcdLog_(fn, msg) { console.log("[FCD] [" + fn + "] " + msg); }

function fcdGetMonday_(date) {
  var d = new Date(date);
  var day = d.getDay() || 7;
  d.setDate(d.getDate() - day + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

function fcdGetSunday_(monday) {
  var d = new Date(monday);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

function fcdDateStr_(d) {
  return (d.getMonth() + 1) + "/" + d.getDate() + "/" + d.getFullYear();
}

function fcdGetOrCreateSheet_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (sheet) {
    sheet.clear();
    sheet.clearConditionalFormatRules();
    try { sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).breakApart(); } catch (e) {}
    return sheet;
  }
  return ss.insertSheet(name);
}

function fcdParseLessonNum_(str) {
  if (!str) return null;
  var m = str.toString().match(/L?(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * v2.2: Resolves a raw section name through the bridging map.
 * Blends → "Single Consonants & Vowels".  All other sections pass through unchanged.
 */
function fcdResolveBridgingSection_(section) {
  return FCD_BRIDGING_SECTIONS[section] || section;
}

/**
 * Returns true if the given section name is a bridging section (maps to a parent).
 */
function fcdIsBridgingSection_(section) {
  return !!FCD_BRIDGING_SECTIONS[section];
}

/**
 * Finds the skill section for a lesson number, resolving bridging sections.
 * L25 → Blends → resolved to "Single Consonants & Vowels"
 */
function fcdFindSectionForLesson_(lessonNum) {
  var sections = Object.keys(FCD_SKILL_SECTIONS);
  for (var i = 0; i < sections.length; i++) {
    if (FCD_SKILL_SECTIONS[sections[i]].indexOf(lessonNum) >= 0) {
      return fcdResolveBridgingSection_(sections[i]);
    }
  }
  return null;
}

function fcdGetSchoolName_(ss) {
  var cfg = ss.getSheetByName(FCD_CONFIG.SITE_CONFIG_SHEET);
  if (cfg && cfg.getLastRow() > 1) return cfg.getRange(2, 2).getValue().toString().trim();
  return "School";
}

function fcdGetEmailRecipients_(ss) {
  var cfg = ss.getSheetByName(FCD_CONFIG.SITE_CONFIG_SHEET);
  if (!cfg) return [];
  var lastRow = cfg.getLastRow();
  for (var r = 1; r <= lastRow; r++) {
    var label = cfg.getRange(r, 1).getValue().toString().trim().toLowerCase();
    if (label.indexOf("digest") >= 0 || label.indexOf("email") >= 0 || label.indexOf("coach") >= 0) {
      var val = cfg.getRange(r, 2).getValue().toString().trim();
      if (val) return val.split(",").map(function(e) { return e.trim(); }).filter(function(e) { return e.indexOf("@") > 0; });
    }
  }
  return [];
}


// ─────────────────────────────────────────────────────────────────────────
// SECTION BRIDGE HELPERS (v2.1 + v2.2 bridging awareness)
// ─────────────────────────────────────────────────────────────────────────

/**
 * v2.2: Returns the EFFECTIVE lesson list for a section, including any
 * bridging children that resolve to it.
 * "Single Consonants & Vowels" → SCV lessons + Blends lessons [25, 27]
 * All other sections → their own lessons unchanged.
 */
function fcdGetEffectiveSectionLessons_(sectionName) {
  if (!sectionName || !FCD_SKILL_SECTIONS[sectionName]) return [];
  var lessons = FCD_SKILL_SECTIONS[sectionName].slice(); // copy
  // Add lessons from any bridging section that resolves to this parent
  Object.keys(FCD_BRIDGING_SECTIONS).forEach(function(bridged) {
    if (FCD_BRIDGING_SECTIONS[bridged] === sectionName && FCD_SKILL_SECTIONS[bridged]) {
      FCD_SKILL_SECTIONS[bridged].forEach(function(ln) {
        if (lessons.indexOf(ln) < 0) lessons.push(ln);
      });
    }
  });
  return lessons;
}

/** Returns the number of EFFECTIVE lessons in a given skill section (including bridged children). */
function fcdGetSectionSize_(sectionName) {
  return fcdGetEffectiveSectionLessons_(sectionName).length;
}

/**
 * Returns the minimum lessons a group must attempt before mastery flags fire.
 *   Sections ≤ 3 effective lessons → ALL
 *   Sections 4+ effective lessons → 3
 */
function fcdGetSectionMinThreshold_(sectionName) {
  var size = fcdGetSectionSize_(sectionName);
  if (size === 0) return FCD_CONFIG.BRIDGE_MIN_DEFAULT;
  return (size <= 3) ? size : FCD_CONFIG.BRIDGE_MIN_DEFAULT;
}

/**
 * v2.2: Returns the section immediately BEFORE the given one, SKIPPING bridging sections.
 * "Alphabet Review & Longer Words" → skips "Blends" → returns "Single Consonants & Vowels"
 */
function fcdGetPreviousSection_(sectionName) {
  var idx = FCD_SECTION_ORDER.indexOf(sectionName);
  if (idx <= 0) return null;
  // Walk backward, skipping bridging sections
  for (var i = idx - 1; i >= 0; i--) {
    if (!fcdIsBridgingSection_(FCD_SECTION_ORDER[i])) {
      return FCD_SECTION_ORDER[i];
    }
  }
  return null;
}

/** Returns the last (highest) lesson number in a section's EFFECTIVE lesson list. */
function fcdGetLastLessonInSection_(sectionName) {
  var lessons = fcdGetEffectiveSectionLessons_(sectionName);
  if (lessons.length === 0) return null;
  return Math.max.apply(null, lessons);
}

/** Returns the first (lowest) lesson number in a section's EFFECTIVE lesson list. */
function fcdGetFirstLessonInSection_(sectionName) {
  var lessons = fcdGetEffectiveSectionLessons_(sectionName);
  if (lessons.length === 0) return null;
  return Math.min.apply(null, lessons);
}


// ─────────────────────────────────────────────────────────────────────────
// DATA COLLECTION
// ─────────────────────────────────────────────────────────────────────────

function fcdReadSGP_(ss) {
  var sheet = ss.getSheetByName(FCD_CONFIG.SGP_SHEET);
  if (!sheet || sheet.getLastRow() < FCD_CONFIG.SGP_DATA_ROW) return [];

  var data = sheet.getRange(FCD_CONFIG.SGP_DATA_ROW, 1,
    sheet.getLastRow() - FCD_CONFIG.SGP_DATA_ROW + 1, 7).getValues();

  var records = [];
  for (var i = 0; i < data.length; i++) {
    var row = data[i];
    var dateVal = row[FCD_CONFIG.SGP_COLS.DATE];
    if (!dateVal) continue;
    var d = new Date(dateVal);
    if (isNaN(d.getTime())) continue;

    var student = row[FCD_CONFIG.SGP_COLS.STUDENT] ? row[FCD_CONFIG.SGP_COLS.STUDENT].toString().trim() : "";
    var status = row[FCD_CONFIG.SGP_COLS.STATUS] ? row[FCD_CONFIG.SGP_COLS.STATUS].toString().trim().toUpperCase() : "";
    if (!student || !status) continue;

    records.push({
      date: d,
      dateKey: fcdDateStr_(d),
      teacher: row[FCD_CONFIG.SGP_COLS.TEACHER] ? row[FCD_CONFIG.SGP_COLS.TEACHER].toString().trim() : "",
      group: row[FCD_CONFIG.SGP_COLS.GROUP] ? row[FCD_CONFIG.SGP_COLS.GROUP].toString().trim() : "",
      student: student,
      lesson: row[FCD_CONFIG.SGP_COLS.LESSON] ? row[FCD_CONFIG.SGP_COLS.LESSON].toString().trim() : "",
      lessonNum: fcdParseLessonNum_(row[FCD_CONFIG.SGP_COLS.LESSON]),
      status: status
    });
  }
  return records;
}

function fcdReadGradeSummary_(ss) {
  var map = new Map();
  var sheet = ss.getSheetByName(FCD_CONFIG.GRADE_SUMMARY_SHEET);
  if (!sheet) return map;

  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2 || lastCol < 5) return map;

  var headerRow = -1;
  var scanRows = Math.min(10, lastRow);
  var colA = sheet.getRange(1, 1, scanRows, 1).getValues();
  for (var i = 0; i < colA.length; i++) {
    var val = colA[i][0] ? colA[i][0].toString().trim().toLowerCase() : "";
    if (val === "student name" || val === "student" || val === "name") {
      headerRow = i + 1;
      break;
    }
  }
  if (headerRow === -1) headerRow = FCD_CONFIG.GS_DATA_ROW - 1;

  var dataStartRow = headerRow + 1;
  if (lastRow < dataStartRow) return map;

  var data = sheet.getRange(dataStartRow, 1, lastRow - dataStartRow + 1, lastCol).getValues();
  for (var i = 0; i < data.length; i++) {
    var name = data[i][0] ? data[i][0].toString().trim() : "";
    if (name) map.set(name, data[i]);
  }
  return map;
}


// ─────────────────────────────────────────────────────────────────────────
// METRIC A: LESSON RETEACH FREQUENCY
// ─────────────────────────────────────────────────────────────────────────

function fcdNormalizeLesson_(lessonStr) {
  if (!lessonStr) return { base: lessonStr, reteachNum: 0 };
  var s = String(lessonStr).trim();
  var match = s.match(/\s+(re-?teach|reatech)\s*(\d*)\s*$/i);
  if (match) {
    var base = s.substring(0, match.index).trim();
    var num = match[2] ? parseInt(match[2], 10) : 1;
    return { base: base, reteachNum: num };
  }
  return { base: s, reteachNum: 0 };
}

function fcdCalcReteach_(records, startDate, endDate) {
  var groups = {};

  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    if (r.date < startDate || r.date > endDate) continue;
    if (r.status === "A") continue;
    if (!r.group || !r.lesson) continue;

    var norm = fcdNormalizeLesson_(r.lesson);
    var baseLesson = norm.base;

    if (!groups[r.group]) groups[r.group] = {};
    if (!groups[r.group][baseLesson]) {
      groups[r.group][baseLesson] = {
        dates: new Set(),
        lessonNum: r.lessonNum,
        students: new Set(),
        maxNameReteach: 0,
        variants: new Set()
      };
    }
    groups[r.group][baseLesson].dates.add(r.dateKey);
    groups[r.group][baseLesson].students.add(r.student);
    groups[r.group][baseLesson].variants.add(r.lesson);
    if (norm.reteachNum > groups[r.group][baseLesson].maxNameReteach) {
      groups[r.group][baseLesson].maxNameReteach = norm.reteachNum;
    }
  }

  var result = {};
  Object.keys(groups).forEach(function(grp) {
    var lessons = groups[grp];
    var maxReteach = 0;
    var maxLesson = "";
    var allReteaches = [];
    var uniqueBaseLessons = Object.keys(lessons).length;

    Object.keys(lessons).forEach(function(baseLesson) {
      var info = lessons[baseLesson];
      var dateCount = info.dates.size;
      var dateBasedReteach = Math.max(0, dateCount - 2);
      var reteachCount = Math.max(dateBasedReteach, info.maxNameReteach);

      if (reteachCount >= 1) {
        allReteaches.push({
          lesson: baseLesson,
          lessonNum: info.lessonNum,
          dateCount: dateCount,
          reteachCount: reteachCount,
          students: info.students.size,
          variants: Array.from(info.variants)
        });
      }
      if (reteachCount > maxReteach) {
        maxReteach = reteachCount;
        maxLesson = baseLesson;
      }
    });

    allReteaches.sort(function(a, b) { return b.reteachCount - a.reteachCount; });
    var stickyDateCount = maxLesson && lessons[maxLesson] ? lessons[maxLesson].dates.size : 0;

    result[grp] = {
      maxReteachCount: maxReteach,
      maxReteachLesson: maxLesson,
      maxReteachDates: stickyDateCount,
      totalLessonsTaught: uniqueBaseLessons,
      reteaches: allReteaches
    };
  });

  return result;
}


// ─────────────────────────────────────────────────────────────────────────
// METRIC B: GROUP PASS RATE
// v2.1: Section Bridge Detection
//   - Tracks unique lessons attempted per group in their current section
//   - Detects when a group has recently completed a prior section
//   - Suppresses mastery flags when data is insufficient (bridge period)
// v2.2: Bridging section resolution
//   - Uses effective section lessons (parent + bridged children) for counting
//   - Blends lessons count toward SCV totals
// ─────────────────────────────────────────────────────────────────────────

function fcdCalcGroupMastery_(gradeSummary, records, startDate, endDate) {
  var sectionNames = Object.keys(FCD_SKILL_SECTIONS);

  // Build group → student mapping from recent SGP activity
  var groupStudents = {};
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    if (r.date < startDate || r.date > endDate) continue;
    if (!r.group || !r.student) continue;
    if (!groupStudents[r.group]) groupStudents[r.group] = new Set();
    groupStudents[r.group].add(r.student);
  }

  // Build group → set of unique lesson numbers attempted in window
  var groupLessonNums = {};
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    if (r.date < startDate || r.date > endDate) continue;
    if (!r.group || !r.lessonNum) continue;
    if (r.status === "A") continue;
    if (!groupLessonNums[r.group]) groupLessonNums[r.group] = new Set();
    groupLessonNums[r.group].add(r.lessonNum);
  }

  var result = {};

  Object.keys(groupStudents).forEach(function(grp) {
    var students = Array.from(groupStudents[grp]);
    var masteryCount = 0;
    var studentDetails = [];
    var sectionVotes = {};

    students.forEach(function(name) {
      var gsRow = gradeSummary.get(name);
      if (!gsRow) {
        studentDetails.push({ name: name, section: "—", totalPct: null, atMastery: false });
        return;
      }

      // v2.2: fcdGetStudentCurrentSection_ now returns resolved sections (Blends → SCV)
      var studentSection = fcdGetStudentCurrentSection_(name, records, startDate, endDate, sectionNames);
      if (studentSection) {
        sectionVotes[studentSection] = (sectionVotes[studentSection] || 0) + 1;
      }

      var totalPct = null;
      if (studentSection) {
        var secIdx = sectionNames.indexOf(studentSection);
        if (secIdx >= 0) {
          var totalCol = FCD_CONFIG.GS_SKILL_DETAIL_START + secIdx * 3 + 2;
          totalPct = (totalCol < gsRow.length) ? gsRow[totalCol] : null;
          if (typeof totalPct === 'number' && !isNaN(totalPct)) totalPct = totalPct;
          else if (totalPct !== null && totalPct !== "") {
            totalPct = parseFloat(totalPct.toString().replace('%', ''));
            if (isNaN(totalPct)) totalPct = null;
          } else totalPct = null;
        }
      }

      var atMastery = (totalPct !== null && totalPct >= FCD_CONFIG.MASTERY_THRESHOLD * 100);
      if (atMastery) masteryCount++;

      studentDetails.push({
        name: name,
        section: studentSection || "—",
        totalPct: totalPct,
        atMastery: atMastery
      });
    });

    // Determine group's primary section
    var primarySection = "—";
    var maxVotes = 0;
    Object.keys(sectionVotes).forEach(function(sec) {
      if (sectionVotes[sec] > maxVotes) { maxVotes = sectionVotes[sec]; primarySection = sec; }
    });

    // === v2.1 + v2.2: Section bridge detection using EFFECTIVE lessons ===
    var sectionSize = fcdGetSectionSize_(primarySection);
    var minThreshold = fcdGetSectionMinThreshold_(primarySection);

    // v2.2: Count unique lessons attempted using EFFECTIVE section lessons
    // (includes bridged children — L25/L27 count toward SCV total)
    var lessonsAttempted = 0;
    if (primarySection !== "—" && groupLessonNums[grp]) {
      var effectiveLessons = fcdGetEffectiveSectionLessons_(primarySection);
      groupLessonNums[grp].forEach(function(ln) {
        if (effectiveLessons.indexOf(ln) >= 0) lessonsAttempted++;
      });
    }

    var isBridging = (primarySection !== "—" && lessonsAttempted < minThreshold);

    // Detect if the group recently completed the PREVIOUS section
    // v2.2: fcdGetPreviousSection_ now skips bridging sections
    var completedPrevSection = null;
    var prevSectionMasteryPct = null;

    if (primarySection !== "—") {
      var prevSection = fcdGetPreviousSection_(primarySection);
      if (prevSection && groupLessonNums[grp]) {
        var lastLessonOfPrev = fcdGetLastLessonInSection_(prevSection);
        if (lastLessonOfPrev && groupLessonNums[grp].has(lastLessonOfPrev)) {
          completedPrevSection = prevSection;

          // Calculate mastery on the completed section
          var prevSecIdx = sectionNames.indexOf(prevSection);
          if (prevSecIdx >= 0) {
            var prevMasteryCount = 0;
            var prevTotalStudents = 0;
            students.forEach(function(name) {
              var gsRow = gradeSummary.get(name);
              if (!gsRow) return;
              prevTotalStudents++;
              var totalCol = FCD_CONFIG.GS_SKILL_DETAIL_START + prevSecIdx * 3 + 2;
              var totalPct = (totalCol < gsRow.length) ? gsRow[totalCol] : null;
              if (typeof totalPct === 'number' && !isNaN(totalPct) && totalPct >= FCD_CONFIG.MASTERY_THRESHOLD * 100) {
                prevMasteryCount++;
              } else if (totalPct !== null && totalPct !== "") {
                var parsed = parseFloat(totalPct.toString().replace('%', ''));
                if (!isNaN(parsed) && parsed >= FCD_CONFIG.MASTERY_THRESHOLD * 100) prevMasteryCount++;
              }
            });
            prevSectionMasteryPct = prevTotalStudents > 0 ? Math.round(prevMasteryCount / prevTotalStudents * 100) : null;
          }
        }
      }
    }

    result[grp] = {
      section: primarySection,
      totalStudents: students.length,
      masteryCount: masteryCount,
      masteryPct: students.length > 0 ? Math.round(masteryCount / students.length * 100) : 0,
      avgTotalPct: 0,
      students: studentDetails,
      // v2.1 bridge fields
      sectionSize: sectionSize,
      minThreshold: minThreshold,
      lessonsAttempted: lessonsAttempted,
      isBridging: isBridging,
      completedPrevSection: completedPrevSection,
      prevSectionMasteryPct: prevSectionMasteryPct
    };

    // Calculate average Total%
    var totalPctSum = 0;
    var totalPctCount = 0;
    studentDetails.forEach(function(sd) {
      if (sd.totalPct !== null && sd.totalPct !== undefined && !isNaN(sd.totalPct)) {
        totalPctSum += sd.totalPct;
        totalPctCount++;
      }
    });
    result[grp].avgTotalPct = totalPctCount > 0 ? Math.round(totalPctSum / totalPctCount) : 0;
  });

  return result;
}

function fcdGetStudentCurrentSection_(studentName, records, startDate, endDate, sectionNames) {
  var lastDate = null;
  var lastLesson = null;

  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    if (r.student !== studentName) continue;
    if (r.date < startDate || r.date > endDate) continue;
    if (r.status === "A") continue;
    if (!r.lessonNum) continue;
    if (!lastDate || r.date >= lastDate) {
      lastDate = r.date;
      lastLesson = r.lessonNum;
    }
  }

  if (!lastLesson) return null;
  return fcdFindSectionForLesson_(lastLesson);  // v2.2: already resolves bridging
}


// ─────────────────────────────────────────────────────────────────────────
// METRIC C: STUDENT GROWTH VS EXPECTED SLOPE
// Aimline: 2 new lessons passed per week (UFLI 2-day teach + Day 5 assess)
// Calculates actual lessons passed per week over rolling window.
//
// v2.2: Absence handling
//   - Status priority: Y > N > A (Y always wins; N beats A; A only sets if no record)
//   - All-absent weeks excluded from weeksActive and consecutive-below streak
// ─────────────────────────────────────────────────────────────────────────

/**
 * Returns: { studentName: { grade, group, weeksTracked, totalPassed,
 *            avgPerWeek, aimline, ratio, belowAimlineWeeks, tier3Flag,
 *            weeklyDetail: [{weekLabel, passed}] } }
 */
function fcdCalcGrowthSlope_(records, rollingWeeks) {
  var today = new Date();
  var monday = fcdGetMonday_(today);

  // Build week boundaries going back N weeks
  var weeks = [];
  for (var w = 0; w < rollingWeeks; w++) {
    var wkStart = new Date(monday);
    wkStart.setDate(wkStart.getDate() - (w * 7));
    var wkEnd = fcdGetSunday_(wkStart);
    weeks.push({ start: wkStart, end: wkEnd, label: fcdDateStr_(wkStart) });
  }
  weeks.reverse(); // chronological order

  // Build student → group/grade mapping (most recent)
  var studentInfo = {};
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    if (!r.student) continue;
    if (!studentInfo[r.student] || r.date > studentInfo[r.student].lastDate) {
      studentInfo[r.student] = { group: r.group, grade: "", lastDate: r.date };
    }
  }

  // Count unique lessons passed (Y) per student per week
  // Deduplicate: same lesson in same week counts once; priority Y > N > A
  var studentWeeks = {}; // student → weekIdx → { lesson → bestStatus }

  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    if (!r.student || !r.lesson) continue;

    for (var w = 0; w < weeks.length; w++) {
      if (r.date >= weeks[w].start && r.date <= weeks[w].end) {
        if (!studentWeeks[r.student]) studentWeeks[r.student] = {};
        if (!studentWeeks[r.student][w]) studentWeeks[r.student][w] = {};
        var current = studentWeeks[r.student][w][r.lesson];
        // v2.2: Priority Y > N > A.  Y always wins; N beats A; A only sets if no record yet.
        if (!current) {
          studentWeeks[r.student][w][r.lesson] = r.status;
        } else if (r.status === "Y" && current !== "Y") {
          studentWeeks[r.student][w][r.lesson] = "Y";
        } else if (r.status === "N" && current === "A") {
          studentWeeks[r.student][w][r.lesson] = "N";
        }
        break;
      }
    }
  }

  // Calculate per-student metrics
  var result = {};
  var aimline = FCD_CONFIG.AIMLINE_LESSONS_PER_WEEK;

  Object.keys(studentWeeks).forEach(function(name) {
    var weekData = studentWeeks[name];
    var weeklyDetail = [];
    var totalPassed = 0;
    var weeksActive = 0;
    var consecutiveBelowAimline = 0;
    var maxConsecutiveBelow = 0;

    for (var w = 0; w < weeks.length; w++) {
      var lessons = weekData[w] || {};
      var passed = 0;
      var hasNonAbsent = false;
      Object.keys(lessons).forEach(function(l) {
        if (lessons[l] === "Y") passed++;
        if (lessons[l] !== "A") hasNonAbsent = true;
      });

      weeklyDetail.push({ weekLabel: weeks[w].label, passed: passed });

      // v2.2: Only count weeks where student was present for at least one lesson
      if (Object.keys(lessons).length > 0 && hasNonAbsent) {
        weeksActive++;
        totalPassed += passed;

        if (passed < aimline * FCD_CONFIG.GROWTH_CONCERN_RATIO) {
          consecutiveBelowAimline++;
          if (consecutiveBelowAimline > maxConsecutiveBelow) {
            maxConsecutiveBelow = consecutiveBelowAimline;
          }
        } else {
          consecutiveBelowAimline = 0;
        }
      }
      // All-absent weeks: don't increment weeksActive, don't affect consecutive streak
    }

    var avgPerWeek = weeksActive > 0 ? totalPassed / weeksActive : 0;
    var ratio = avgPerWeek / aimline;

    result[name] = {
      group: studentInfo[name] ? studentInfo[name].group : "",
      weeksTracked: weeksActive,
      totalPassed: totalPassed,
      avgPerWeek: Math.round(avgPerWeek * 10) / 10,
      aimline: aimline,
      ratio: Math.round(ratio * 100),
      belowAimlineWeeks: maxConsecutiveBelow,
      tier3Flag: maxConsecutiveBelow >= FCD_CONFIG.GROWTH_CONCERN_WEEKS,
      weeklyDetail: weeklyDetail
    };
  });

  return result;
}


// ─────────────────────────────────────────────────────────────────────────
// METRIC D: CHRONIC ABSENTEEISM
// % of group sessions missed per student.
// ─────────────────────────────────────────────────────────────────────────

/**
 * Returns: { studentName: { group, totalSessions, absences, absencePct, flag } }
 */
function fcdCalcAbsenteeism_(records, startDate, endDate) {
  var groupDates = {};
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    if (r.date < startDate || r.date > endDate) continue;
    if (!r.group) continue;
    if (!groupDates[r.group]) groupDates[r.group] = new Set();
    groupDates[r.group].add(r.dateKey);
  }

  var studentData = {};
  for (var i = 0; i < records.length; i++) {
    var r = records[i];
    if (r.date < startDate || r.date > endDate) continue;
    if (!r.student || !r.group) continue;

    if (!studentData[r.student]) {
      studentData[r.student] = { group: r.group, present: new Set(), absent: new Set() };
    }

    if (r.status === "A") {
      studentData[r.student].absent.add(r.dateKey);
    } else {
      studentData[r.student].present.add(r.dateKey);
    }
  }

  var result = {};
  Object.keys(studentData).forEach(function(name) {
    var sd = studentData[name];
    var groupSessionCount = groupDates[sd.group] ? groupDates[sd.group].size : 0;
    var absences = sd.absent.size;
    var absencePct = groupSessionCount > 0 ? absences / groupSessionCount : 0;

    result[name] = {
      group: sd.group,
      totalSessions: groupSessionCount,
      attended: sd.present.size,
      absences: absences,
      absencePct: Math.round(absencePct * 100),
      flag: absencePct >= FCD_CONFIG.ABSENCE_CRITICAL ? "critical" :
            absencePct >= FCD_CONFIG.ABSENCE_WARNING ? "warning" : "ok"
    };
  });

  return result;
}


// ─────────────────────────────────────────────────────────────────────────
// COACHING PRIORITY MATRIX
// v2.1: Bridge awareness — suppresses false flags during section transitions,
//       adds section completion celebrations
// v2.2: Bridging section resolution flows through automatically
// ─────────────────────────────────────────────────────────────────────────

function fcdBuildPriorityMatrix_(reteach, mastery, growth, absence, records, startDate, endDate) {
  var priorities = [];

  var allGroups = {};
  Object.keys(reteach).forEach(function(g) { allGroups[g] = true; });
  Object.keys(mastery).forEach(function(g) { allGroups[g] = true; });

  Object.keys(allGroups).forEach(function(grp) {
    var rt = reteach[grp] || { maxReteachCount: 0, maxReteachLesson: "" };
    var ms = mastery[grp] || { masteryPct: 0, section: "—", totalStudents: 0, isBridging: false, completedPrevSection: null };

    // Get group-level absence average
    var grpAbsAvg = 0;
    var grpAbsCount = 0;
    Object.keys(absence).forEach(function(name) {
      if (absence[name].group === grp) {
        grpAbsAvg += absence[name].absencePct;
        grpAbsCount++;
      }
    });
    grpAbsAvg = grpAbsCount > 0 ? grpAbsAvg / grpAbsCount : 0;

    var grpGrowthAvg = 0;
    var grpGrowthCount = 0;
    Object.keys(growth).forEach(function(name) {
      if (growth[name].group === grp) {
        grpGrowthAvg += growth[name].ratio;
        grpGrowthCount++;
      }
    });
    grpGrowthAvg = grpGrowthCount > 0 ? grpGrowthAvg / grpGrowthCount : 0;

    var maxLessonInGroup = 0;
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (r.group === grp && r.date >= startDate && r.date <= endDate && r.lessonNum) {
        if (r.lessonNum > maxLessonInGroup) maxLessonInGroup = r.lessonNum;
      }
    }

    var highReteach = rt.maxReteachCount >= FCD_CONFIG.RETEACH_WARNING;
    var lowAbsence = grpAbsAvg < FCD_CONFIG.ABSENCE_WARNING * 100;
    var highAbsence = grpAbsAvg >= FCD_CONFIG.ABSENCE_WARNING * 100;
    var highPassRate = ms.masteryPct >= 80;
    var lowPassRate = ms.masteryPct < 50;
    var lowLessonNum = maxLessonInGroup > 0 && maxLessonInGroup <= 40;
    var lowReteach = rt.maxReteachCount === 0;
    var lowGrowth = grpGrowthAvg < 75;

    // v2.1: Bridge awareness
    var groupIsBridging = ms.isBridging || false;

    // === v2.1: Section Completion Celebration ===
    if (ms.completedPrevSection && ms.prevSectionMasteryPct !== null) {
      if (ms.prevSectionMasteryPct >= 80) {
        priorities.push({
          type: "celebration",
          icon: "🎉",
          label: "Section Complete!",
          group: grp,
          detail: "Completed " + ms.completedPrevSection + " with " + ms.prevSectionMasteryPct + "% at mastery — now entering " + ms.section,
          action: "Celebrate this group! Strong section finish. Monitor first few lessons in " + ms.section + " for transition support.",
          urgency: 1
        });
      } else {
        priorities.push({
          type: "fidelity",
          icon: "🟡",
          label: "Weak Section Close",
          group: grp,
          detail: "Moved past " + ms.completedPrevSection + " with only " + ms.prevSectionMasteryPct + "% at mastery — gaps may carry forward into " + ms.section,
          action: "Review whether " + ms.completedPrevSection + " skills are solid enough to support " + ms.section + ". Consider targeted reteach.",
          urgency: 4
        });
      }
    }

    // RULE 1: High Reteach + Low Absenteeism → Coaching Focus
    if (highReteach && lowAbsence) {
      priorities.push({
        type: "coaching",
        icon: "🔵",
        label: "Coaching Focus",
        group: grp,
        detail: rt.maxReteachLesson + " retaught " + rt.maxReteachCount + "x — " + ms.totalStudents + " students present",
        action: "Visit this group. Check UFLI Step 5 (Word Work) scaffolding and corrective feedback timing.",
        urgency: 3 + rt.maxReteachCount
      });
    }

    // RULE 2: Low Growth + High Absenteeism → Systemic Focus
    if (lowGrowth && highAbsence) {
      priorities.push({
        type: "systemic",
        icon: "🔴",
        label: "Systemic: Attendance",
        group: grp,
        detail: "Avg growth at " + Math.round(grpGrowthAvg) + "% of aimline with " + Math.round(grpAbsAvg) + "% avg absence rate",
        action: "Contact families/MTSS attendance lead. This is a presence problem, not a reading problem.",
        urgency: 5 + Math.round(grpAbsAvg / 10)
      });
    }

    // RULE 3: High Pass Rate + Low Lesson # → Section Complete (skip if bridging)
    if (highPassRate && lowLessonNum && !groupIsBridging) {
      priorities.push({
        type: "fasttrack",
        icon: "🟢",
        label: "Section Complete",
        group: grp,
        detail: ms.masteryPct + "% at mastery on " + ms.section + " (Lesson " + maxLessonInGroup + ") — group is under-challenged",
        action: "Skip ahead. This group is ready to accelerate past current sequence.",
        urgency: 2
      });
    }

    // RULE 4: Low Pass Rate + Low Reteach → Fidelity Check
    // v2.1: SKIP if group is bridging — insufficient data to judge
    if (lowPassRate && lowReteach && ms.totalStudents > 0 && !groupIsBridging) {
      priorities.push({
        type: "fidelity",
        icon: "🟡",
        label: "Fidelity Check",
        group: grp,
        detail: "Only " + ms.masteryPct + "% at mastery but max " + rt.maxReteachCount + " reteaches — curriculum is being covered, not taught",
        action: "Observe lesson delivery. Is teacher teaching to mastery or just moving through the scope?",
        urgency: 4
      });
    }
  });

  // Add individual Tier 3 flags
  Object.keys(growth).forEach(function(name) {
    var g = growth[name];
    if (g.tier3Flag) {
      var abs = absence[name] || { absencePct: 0 };
      if (abs.absencePct < FCD_CONFIG.ABSENCE_WARNING * 100) {
        // Low growth + good attendance = true Tier 3 candidate
        priorities.push({
          type: "tier3",
          icon: "🚨",
          label: "MTSS Escalation",
          group: g.group,
          detail: name + " — " + g.belowAimlineWeeks + " consecutive weeks below aimline, " + g.avgPerWeek + " lessons/wk (aimline: " + g.aimline + ")",
          action: "Schedule Tier 3 data review. Consider Phonemic Awareness assessment (UFLI Step 3) before continuing Grapheme work.",
          urgency: 8
        });
      }
    }
  });

  priorities.sort(function(a, b) { return b.urgency - a.urgency; });
  return priorities;
}


// ─────────────────────────────────────────────────────────────────────────
// MONDAY DIGEST BUILDER
// v2.1: Adds Celebrations bucket
// ─────────────────────────────────────────────────────────────────────────

function fcdBuildMondayDigest_(priorities, reteach, mastery, growth, absence, schoolName, weekLabel) {
  var speedUp = [];
  var holdHelp = [];
  var escalation = [];
  var fidelity = [];
  var celebrations = [];

  priorities.forEach(function(p) {
    switch (p.type) {
      case "fasttrack": speedUp.push(p); break;
      case "coaching": holdHelp.push(p); break;
      case "tier3": case "systemic": escalation.push(p); break;
      case "fidelity": fidelity.push(p); break;
      case "celebration": celebrations.push(p); break;
    }
  });

  var totalGroups = Object.keys(reteach).length;
  var groupsWithReteach = 0;
  Object.keys(reteach).forEach(function(g) { if (reteach[g].maxReteachCount >= FCD_CONFIG.RETEACH_WARNING) groupsWithReteach++; });
  var tier3Count = priorities.filter(function(p) { return p.type === "tier3"; }).length;
  var totalAbsenceSessions = 0;
  Object.keys(absence).forEach(function(n) { totalAbsenceSessions += absence[n].absences; });

  var html = [];
  html.push('<div style="font-family: Calibri, Arial, sans-serif; max-width: 650px; margin: 0 auto;">');

  html.push('<div style="background: #1a3c5e; color: white; padding: 20px; border-radius: 8px 8px 0 0;">');
  html.push('<h1 style="margin: 0; font-size: 22px;">📋 Monday Coaching Digest</h1>');
  html.push('<p style="margin: 4px 0 0; opacity: 0.85; font-size: 14px;">' + schoolName + ' — Week of ' + weekLabel + '</p>');
  html.push('</div>');

  html.push('<div style="background: #E8F0FE; padding: 12px 20px; display: flex; border-bottom: 1px solid #d0d0d0;">');
  html.push('<span style="font-size: 13px; color: #333;">');
  html.push('<strong>' + totalGroups + '</strong> groups tracked &nbsp;•&nbsp; ');
  html.push('<strong>' + groupsWithReteach + '</strong> with reteaches &nbsp;•&nbsp; ');
  html.push('<strong>' + tier3Count + '</strong> Tier 3 flags &nbsp;•&nbsp; ');
  html.push('<strong>' + totalAbsenceSessions + '</strong> missed sessions');
  html.push('</span></div>');

  if (priorities.length > 0) {
    html.push('<div style="background: #FEF7E0; padding: 10px 20px; border-bottom: 1px solid #d0d0d0;">');
    html.push('<strong style="color: #B06000;">⚡ ' + priorities.length + ' action items this week</strong>');
    html.push('</div>');
  }

  // === CELEBRATIONS === (v2.1)
  html.push(fcdDigestSection_("🎉 Celebrations", "#7B1FA2", "#F3E5F5",
    "Groups that completed a skill section with strong mastery. Recognize the work!",
    celebrations, "No section completions this week."));

  html.push(fcdDigestSection_("🟢 Speed Up", "#34A853", "#E6F4EA",
    "These groups are ready to accelerate. Students are at mastery — move them forward.",
    speedUp, "No groups flagged for acceleration this week."));

  html.push(fcdDigestSection_("🔵 Hold & Help", "#1a73e8", "#E8F0FE",
    "High reteach counts signal instructional breakdown. Visit these groups Monday.",
    holdHelp, "No coaching interventions needed this week."));

  html.push(fcdDigestSection_("🚨 MTSS Escalation", "#EA4335", "#FCE8E6",
    "Students or groups needing Tier 3 review or systemic intervention.",
    escalation, "No escalations this week — all students tracking within expected range."));

  html.push(fcdDigestSection_("🟡 Fidelity Check", "#B06000", "#FEF7E0",
    "Low mastery with low reteach = curriculum is being covered, not taught to mastery.",
    fidelity, "No fidelity concerns this week."));

  html.push('<div style="padding: 16px 20px; background: #f8f9fa; border-top: 1px solid #d0d0d0; border-radius: 0 0 8px 8px;">');
  html.push('<p style="font-size: 11px; color: #999; margin: 0;">');
  html.push('Generated from UFLI Master System • Friday Dashboard v2.2<br>');
  html.push('Data: Small Group Progress + Grade Summary + UFLI MAP<br>');
  html.push('Aimline: ' + FCD_CONFIG.AIMLINE_LESSONS_PER_WEEK + ' lessons/week (UFLI 2-day teach + Day 5 assessment cycle)<br>');
  html.push('Section bridge detection: flags suppressed until min lessons attempted per section size.<br>');
  html.push('Bridging sections (Blends) resolved to parent scope for stable measurement.<br>');
  html.push('Questions? Share this digest with your Literacy Cadre advisor or We Are Lit coach for collaborative planning.');
  html.push('</p></div>');

  html.push('</div>');
  return html.join('\n');
}

function fcdDigestSection_(title, titleColor, bgColor, description, items, emptyMsg) {
  var html = [];
  html.push('<div style="padding: 16px 20px; border-bottom: 1px solid #eee;">');
  html.push('<h2 style="color: ' + titleColor + '; font-size: 16px; margin: 0 0 4px;">' + title + '</h2>');
  html.push('<p style="font-size: 12px; color: #666; margin: 0 0 10px;">' + description + '</p>');

  if (items.length === 0) {
    html.push('<p style="font-size: 13px; color: #999; font-style: italic; margin: 8px 0;">✓ ' + emptyMsg + '</p>');
  } else {
    items.forEach(function(item) {
      html.push('<div style="background: ' + bgColor + '; padding: 10px 14px; border-radius: 6px; margin: 6px 0; border-left: 4px solid ' + titleColor + ';">');
      html.push('<div style="font-weight: bold; font-size: 13px; color: #333;">' + item.group + '</div>');
      html.push('<div style="font-size: 12px; color: #555; margin: 3px 0;">' + item.detail + '</div>');
      html.push('<div style="font-size: 12px; color: ' + titleColor + '; font-weight: bold; margin-top: 4px;">→ ' + item.action + '</div>');
      html.push('</div>');
    });
  }

  html.push('</div>');
  return html.join('\n');
}


// ─────────────────────────────────────────────────────────────────────────
// DASHBOARD RENDERER
// ─────────────────────────────────────────────────────────────────────────

function generateFridayDashboard() {
  var fn = "generateFridayDashboard";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();

  var records = fcdReadSGP_(ss);
  if (records.length === 0) {
    ui.alert("No Data", "No Small Group Progress data found.", ui.ButtonSet.OK);
    return;
  }

  var gradeSummary = fcdReadGradeSummary_(ss);
  var schoolName = fcdGetSchoolName_(ss);

  var today = new Date();
  var monday = fcdGetMonday_(today);
  var sunday = fcdGetSunday_(monday);
  var weekLabel = fcdDateStr_(monday);

  var twoWeeksAgo = new Date(monday);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  fcdLog_(fn, "Calculating Metric A: Reteach Frequency...");
  var reteach = fcdCalcReteach_(records, twoWeeksAgo, sunday);

  fcdLog_(fn, "Calculating Metric B: Group Mastery Rate...");
  var mastery = fcdCalcGroupMastery_(gradeSummary, records, twoWeeksAgo, sunday);

  fcdLog_(fn, "Calculating Metric C: Growth Slope...");
  var growth = fcdCalcGrowthSlope_(records, FCD_CONFIG.ROLLING_WEEKS);

  // For reteach + absence, use a wider window (rolling 2 weeks for better signal)
  fcdLog_(fn, "Calculating Metric D: Absenteeism...");
  var absence = fcdCalcAbsenteeism_(records, twoWeeksAgo, sunday);

  fcdLog_(fn, "Building Priority Matrix...");
  var priorities = fcdBuildPriorityMatrix_(reteach, mastery, growth, absence, records, twoWeeksAgo, sunday);

  var sheet = fcdGetOrCreateSheet_(ss, FCD_CONFIG.SHEET_NAME);
  sheet.setTabColor('#1a3c5e');
  fcdRenderDashboard_(sheet, schoolName, weekLabel, reteach, mastery, growth, absence, priorities);
  ss.setActiveSheet(sheet);

  ui.alert("Friday Dashboard Ready",
    "Dashboard generated for " + Object.keys(reteach).length + " groups.\n" +
    priorities.length + " coaching priorities identified.\n\n" +
    "See the \"Friday Dashboard\" tab.",
    ui.ButtonSet.OK);
}


function fcdRenderDashboard_(sheet, schoolName, weekLabel, reteach, mastery, growth, absence, priorities) {
  var C = FCD_CONFIG.COLORS;
  var cols = 10;
  sheet.getRange(1, 1, 1000, cols).setFontFamily("Calibri");

  [200, 180, 120, 100, 100, 100, 120, 100, 100, 180].forEach(function(w, i) {
    sheet.setColumnWidth(i + 1, w);
  });

  var row = 1;

  sheet.getRange(row, 1, 1, cols).merge()
    .setValue("📋 FRIDAY COACHING DASHBOARD — " + schoolName)
    .setBackground(C.HEADER_BG).setFontColor(C.HEADER_TEXT)
    .setFontSize(16).setFontWeight("bold")
    .setVerticalAlignment("middle").setHorizontalAlignment("center");
  sheet.setRowHeight(row, 44);
  row++;

  sheet.getRange(row, 1, 1, cols).merge()
    .setValue("Week of " + weekLabel + "  •  \"Big Four\" UFLI/MTSS Metrics  •  Aimline: " + FCD_CONFIG.AIMLINE_LESSONS_PER_WEEK + " lessons/week  •  Updated " + fcdDateStr_(new Date()))
    .setFontSize(10).setFontColor(C.GRAY).setFontStyle("italic").setHorizontalAlignment("center");
  sheet.setRowHeight(row, 24);
  row++;

  sheet.getRange(row, 1, 1, cols).setBorder(null, null, true, null, null, null, C.GRAY_BG, SpreadsheetApp.BorderStyle.SOLID);
  sheet.setRowHeight(row, 6);
  row++;

  row = fcdRenderPriorities_(sheet, row, priorities, cols, C);
  row = fcdRenderReteach_(sheet, row, reteach, cols, C);
  row = fcdRenderMastery_(sheet, row, mastery, cols, C);
  row = fcdRenderGrowthSlope_(sheet, row, growth, cols, C);
  row = fcdRenderAbsenteeism_(sheet, row, absence, cols, C);

  sheet.setFrozenRows(3);
}


// === Priority Matrix ===

function fcdRenderPriorities_(sheet, row, priorities, cols, C) {
  sheet.setRowHeight(row, 10); row++;

  sheet.getRange(row, 1, 1, cols).merge()
    .setValue("⚡ COACHING PRIORITY MATRIX — " + priorities.length + " Action Items")
    .setFontWeight("bold").setFontSize(13).setFontColor(C.HEADER_BG);
  row++;

  sheet.getRange(row, 1, 1, cols).merge()
    .setValue("Cross-referenced from all four metrics. Sorted by urgency. Start at the top Monday morning.")
    .setFontSize(9).setFontColor(C.GRAY).setFontStyle("italic");
  row++;

  if (priorities.length === 0) {
    sheet.getRange(row, 1, 1, cols).merge()
      .setValue("✅ No critical priorities this week — all groups within expected ranges.")
      .setFontColor(C.GREEN).setFontWeight("bold").setFontSize(11);
    row++;
    sheet.setRowHeight(row, 10); row++;
    return row;
  }

  var pHeaders = ["Priority", "Type", "Group", "Finding", "Monday Action"];
  [1, 2, 3, 4, 5].forEach(function(i) {
    var span = i <= 3 ? 1 : (i === 4 ? 3 : 3);
    var col = i <= 3 ? i : (i === 4 ? 4 : 7);
    sheet.getRange(row, col, 1, span).merge()
      .setValue(pHeaders[i - 1])
      .setBackground(C.HEADER_BG).setFontColor(C.HEADER_TEXT)
      .setFontWeight("bold").setFontSize(10).setHorizontalAlignment("center");
  });
  sheet.setRowHeight(row, 26);
  row++;

  var typeColors = {
    "coaching": { bg: C.LIGHT_BLUE, text: C.BLUE },
    "systemic": { bg: C.RED_BG, text: C.RED },
    "fasttrack": { bg: C.GREEN_BG, text: C.GREEN },
    "fidelity": { bg: C.YELLOW_BG, text: C.YELLOW },
    "tier3": { bg: C.RED_BG, text: C.RED },
    "celebration": { bg: C.PURPLE_BG, text: C.PURPLE }
  };

  priorities.forEach(function(p, idx) {
    var tc = typeColors[p.type] || { bg: C.GRAY_BG, text: C.GRAY };
    var bg = idx % 2 === 1 ? C.GRAY_ALT : C.WHITE;

    sheet.getRange(row, 1).setValue(p.icon + " " + (idx + 1)).setHorizontalAlignment("center").setBackground(bg);
    sheet.getRange(row, 2).setValue(p.label).setFontWeight("bold").setFontColor(tc.text).setBackground(tc.bg).setHorizontalAlignment("center");
    sheet.getRange(row, 3).setValue(p.group).setFontSize(10).setBackground(bg);
    sheet.getRange(row, 4, 1, 3).merge().setValue(p.detail).setFontSize(10).setWrap(true).setBackground(bg);
    sheet.getRange(row, 7, 1, 3).merge().setValue(p.action).setFontSize(10).setFontWeight("bold").setFontColor(tc.text).setWrap(true).setBackground(bg);

    sheet.setRowHeight(row, 40);
    row++;
  });

  sheet.setRowHeight(row, 12); row++;
  return row;
}


// === Metric A — Reteach ===

function fcdRenderReteach_(sheet, row, reteach, cols, C) {
  sheet.getRange(row, 1, 1, cols).merge()
    .setValue('🔁 METRIC A: Lesson Reteach Frequency — The "Sticky" Factor')
    .setFontWeight("bold").setFontSize(12).setFontColor(C.BLUE);
  row++;

  sheet.getRange(row, 1, 1, cols).merge()
    .setValue("Normalized lesson names (strips \"reteach\" suffixes). UFLI 2-day cycle: 2 dates = normal, 3+ dates or teacher-labeled reteach = flagged.")
    .setFontSize(9).setFontColor(C.GRAY).setFontStyle("italic");
  row++;

  var headers = ["Group", "Stickiest Lesson", "Times Taught", "Reteaches", "Total Lessons", "Signal"];
  headers.forEach(function(h, i) {
    sheet.getRange(row, i + 1).setValue(h)
      .setBackground(C.SECTION_BG).setFontWeight("bold").setFontSize(10).setHorizontalAlignment("center");
  });
  sheet.setRowHeight(row, 26);
  row++;

  var groups = Object.keys(reteach).sort(function(a, b) {
    return reteach[b].maxReteachCount - reteach[a].maxReteachCount;
  });

  groups.forEach(function(grp, idx) {
    var rt = reteach[grp];
    var bg = idx % 2 === 1 ? C.GRAY_ALT : C.WHITE;

    sheet.getRange(row, 1).setValue(grp).setFontSize(10).setBackground(bg);
    sheet.getRange(row, 2).setValue(rt.maxReteachLesson || "—").setHorizontalAlignment("center").setBackground(bg);
    sheet.getRange(row, 3).setValue(rt.maxReteachDates > 0 ? rt.maxReteachDates : "—").setHorizontalAlignment("center").setBackground(bg);
    sheet.getRange(row, 4).setValue(rt.maxReteachCount).setHorizontalAlignment("center").setFontWeight("bold").setBackground(bg);

    if (rt.maxReteachCount >= FCD_CONFIG.RETEACH_CRITICAL) {
      sheet.getRange(row, 4).setFontColor(C.RED).setBackground(C.RED_BG);
    } else if (rt.maxReteachCount >= FCD_CONFIG.RETEACH_WARNING) {
      sheet.getRange(row, 4).setFontColor(C.YELLOW).setBackground(C.YELLOW_BG);
    }

    sheet.getRange(row, 5).setValue(rt.totalLessonsTaught).setHorizontalAlignment("center").setBackground(bg);

    var signal = "✅ On Pace";
    if (rt.maxReteachCount >= FCD_CONFIG.RETEACH_CRITICAL) signal = "🔴 Coaching Visit";
    else if (rt.maxReteachCount >= FCD_CONFIG.RETEACH_WARNING) signal = "🟡 Monitor";

    sheet.getRange(row, 6).setValue(signal).setHorizontalAlignment("center").setBackground(bg);

    sheet.setRowHeight(row, 24);
    row++;
  });

  sheet.setRowHeight(row, 12); row++;
  return row;
}


// === Metric B — Group Mastery (v2.1: bridge-aware signals, v2.2: bridging resolution) ===

function fcdRenderMastery_(sheet, row, mastery, cols, C) {
  sheet.getRange(row, 1, 1, cols).merge()
    .setValue('📊 METRIC B: Group Pass Rate — % at 80%+ Total Section Mastery')
    .setFontWeight("bold").setFontSize(12).setFontColor(C.BLUE);
  row++;

  sheet.getRange(row, 1, 1, cols).merge()
    .setValue("What % of students have reached 80% Total mastery on their current section? Bridge detection: flags suppressed until min lessons attempted. Bridging sections (Blends) resolved to parent scope.")
    .setFontSize(9).setFontColor(C.GRAY).setFontStyle("italic");
  row++;

  var headers = ["Group", "Current Section", "Students", "At 80%+", "Mastery %", "Lessons In Sec", "Signal"];
  headers.forEach(function(h, i) {
    sheet.getRange(row, i + 1).setValue(h)
      .setBackground(C.SECTION_BG).setFontWeight("bold").setFontSize(10).setHorizontalAlignment("center");
  });
  sheet.setRowHeight(row, 26);
  row++;

  var groups = Object.keys(mastery).sort(function(a, b) {
    return mastery[a].masteryPct - mastery[b].masteryPct;
  });

  groups.forEach(function(grp, idx) {
    var ms = mastery[grp];
    var bg = idx % 2 === 1 ? C.GRAY_ALT : C.WHITE;

    sheet.getRange(row, 1).setValue(grp).setFontSize(10).setBackground(bg);
    sheet.getRange(row, 2).setValue(ms.section).setHorizontalAlignment("center").setBackground(bg);
    sheet.getRange(row, 3).setValue(ms.totalStudents).setHorizontalAlignment("center").setBackground(bg);
    sheet.getRange(row, 4).setValue(ms.masteryCount).setHorizontalAlignment("center").setBackground(bg);
    sheet.getRange(row, 5).setValue(ms.masteryPct + "%").setHorizontalAlignment("center")
      .setFontWeight("bold").setBackground(bg);

    // v2.1: Lessons attempted / section size
    var lessonDisplay = ms.lessonsAttempted + " / " + ms.sectionSize;
    sheet.getRange(row, 6).setValue(lessonDisplay).setHorizontalAlignment("center").setBackground(bg);

    // v2.1: Signal logic with bridge awareness
    var signal = "";

    if (ms.completedPrevSection && ms.prevSectionMasteryPct !== null && ms.prevSectionMasteryPct >= 80) {
      signal = "🎉 Completed " + ms.completedPrevSection;
      sheet.getRange(row, 5).setFontColor(C.PURPLE).setBackground(C.PURPLE_BG);
      sheet.getRange(row, 7).setFontColor(C.PURPLE);
    } else if (ms.isBridging) {
      signal = "📘 New Section — Establishing Baseline";
      sheet.getRange(row, 5).setFontColor(C.BLUE).setBackground(C.LIGHT_BLUE);
      sheet.getRange(row, 6).setFontColor(C.BLUE).setFontWeight("bold");
      sheet.getRange(row, 7).setFontColor(C.BLUE);
    } else if (ms.masteryPct >= 100) {
      signal = "⚡ Section Complete?";
      sheet.getRange(row, 5).setFontColor(C.GREEN).setBackground(C.GREEN_BG);
    } else if (ms.masteryPct >= 80) {
      signal = "🟢 Strong";
      sheet.getRange(row, 5).setFontColor(C.GREEN).setBackground(C.GREEN_BG);
    } else if (ms.masteryPct >= 50) {
      signal = "✅ Progressing";
      sheet.getRange(row, 5).setFontColor(C.YELLOW).setBackground(C.YELLOW_BG);
    } else if (ms.totalStudents > 0) {
      signal = "🔴 Needs Instruction";
      sheet.getRange(row, 5).setFontColor(C.RED).setBackground(C.RED_BG);
    } else {
      signal = "—";
    }

    sheet.getRange(row, 7).setValue(signal).setHorizontalAlignment("center").setBackground(bg).setWrap(true);

    sheet.setRowHeight(row, 28);
    row++;
  });

  sheet.setRowHeight(row, 12); row++;
  return row;
}


// === Metric C — Growth Slope ===

function fcdRenderGrowthSlope_(sheet, row, growth, cols, C) {
  sheet.getRange(row, 1, 1, cols).merge()
    .setValue('📈 METRIC C: Student Growth vs. Expected Slope — ' + FCD_CONFIG.ROLLING_WEEKS + '-Week Rolling')
    .setFontWeight("bold").setFontSize(12).setFontColor(C.BLUE);
  row++;

  sheet.getRange(row, 1, 1, cols).merge()
    .setValue("Aimline: " + FCD_CONFIG.AIMLINE_LESSONS_PER_WEEK + " lessons/week (2-day teach + Day 5 assessment). Students below 50% for 2+ weeks flagged for Tier 3. All-absent weeks excluded from calculation.")
    .setFontSize(9).setFontColor(C.GRAY).setFontStyle("italic");
  row++;

  var tier3 = [];
  var belowAimline = [];
  var onTrack = [];

  Object.keys(growth).forEach(function(name) {
    var g = growth[name];
    if (g.tier3Flag) tier3.push({ name: name, data: g });
    else if (g.ratio < 75) belowAimline.push({ name: name, data: g });
    else onTrack.push({ name: name, data: g });
  });

  var headers = ["Student", "Group", "Weeks Active", "Avg/Week", "Aimline", "% of Target", "Consecutive Below", "Flag"];
  headers.forEach(function(h, i) {
    sheet.getRange(row, i + 1).setValue(h)
      .setBackground(C.SECTION_BG).setFontWeight("bold").setFontSize(10).setHorizontalAlignment("center");
  });
  sheet.setRowHeight(row, 26);
  var headerRow = row;
  row++;

  var allStudents = tier3.concat(belowAimline).concat(onTrack);
  var dataStart = row;

  allStudents.forEach(function(s, idx) {
    var g = s.data;
    var bg = idx % 2 === 1 ? C.GRAY_ALT : C.WHITE;

    sheet.getRange(row, 1).setValue(s.name).setFontSize(10).setBackground(bg);
    sheet.getRange(row, 2).setValue(g.group).setFontSize(10).setBackground(bg);
    sheet.getRange(row, 3).setValue(g.weeksTracked).setHorizontalAlignment("center").setBackground(bg);
    sheet.getRange(row, 4).setValue(g.avgPerWeek).setHorizontalAlignment("center").setFontWeight("bold").setBackground(bg);
    sheet.getRange(row, 5).setValue(g.aimline).setHorizontalAlignment("center").setBackground(bg);
    sheet.getRange(row, 6).setValue(g.ratio + "%").setHorizontalAlignment("center").setFontWeight("bold").setBackground(bg);

    if (g.ratio >= 100) sheet.getRange(row, 6).setFontColor(C.GREEN).setBackground(C.GREEN_BG);
    else if (g.ratio >= 75) sheet.getRange(row, 6).setFontColor(C.GREEN);
    else if (g.ratio >= 50) sheet.getRange(row, 6).setFontColor(C.YELLOW).setBackground(C.YELLOW_BG);
    else sheet.getRange(row, 6).setFontColor(C.RED).setBackground(C.RED_BG);

    sheet.getRange(row, 7).setValue(g.belowAimlineWeeks).setHorizontalAlignment("center").setBackground(bg);
    if (g.belowAimlineWeeks >= 2) sheet.getRange(row, 7).setFontColor(C.RED).setFontWeight("bold");

    var flag = "✅ On Track";
    if (g.tier3Flag) flag = "🚨 Tier 3";
    else if (g.ratio < 50) flag = "⚠️ Below Aimline";
    else if (g.ratio < 75) flag = "📌 Monitor";

    sheet.getRange(row, 8).setValue(flag).setHorizontalAlignment("center").setBackground(bg);
    if (g.tier3Flag) sheet.getRange(row, 8).setFontColor(C.RED).setFontWeight("bold").setBackground(C.RED_BG);

    sheet.setRowHeight(row, 22);
    row++;
  });

  if (row - 1 >= dataStart) {
    sheet.getRange(headerRow, 1, row - headerRow, 8).createFilter();
  }

  sheet.setRowHeight(row, 12); row++;
  return row;
}


// === Metric D — Absenteeism ===

function fcdRenderAbsenteeism_(sheet, row, absence, cols, C) {
  sheet.getRange(row, 1, 1, cols).merge()
    .setValue("🏠 METRIC D: Chronic Absenteeism Filter")
    .setFontWeight("bold").setFontSize(12).setFontColor(C.BLUE);
  row++;

  sheet.getRange(row, 1, 1, cols).merge()
    .setValue("% of intervention sessions missed. " + (FCD_CONFIG.ABSENCE_WARNING * 100) + "%+ = warning, " + (FCD_CONFIG.ABSENCE_CRITICAL * 100) + "%+ = critical. Only showing flagged students.")
    .setFontSize(9).setFontColor(C.GRAY).setFontStyle("italic");
  row++;

  var flagged = [];
  Object.keys(absence).forEach(function(name) {
    if (absence[name].flag !== "ok") flagged.push({ name: name, data: absence[name] });
  });

  if (flagged.length === 0) {
    sheet.getRange(row, 1, 1, cols).merge()
      .setValue("✅ No students with chronic absenteeism this period.")
      .setFontColor(C.GREEN).setFontWeight("bold").setFontSize(11);
    row++;
    sheet.setRowHeight(row, 12); row++;
    return row;
  }

  flagged.sort(function(a, b) { return b.data.absencePct - a.data.absencePct; });

  var headers = ["Student", "Group", "Sessions", "Attended", "Missed", "Absence %", "Signal"];
  headers.forEach(function(h, i) {
    sheet.getRange(row, i + 1).setValue(h)
      .setBackground(C.SECTION_BG).setFontWeight("bold").setFontSize(10).setHorizontalAlignment("center");
  });
  sheet.setRowHeight(row, 26);
  row++;

  flagged.forEach(function(s, idx) {
    var d = s.data;
    var bg = idx % 2 === 1 ? C.GRAY_ALT : C.WHITE;

    sheet.getRange(row, 1).setValue(s.name).setFontSize(10).setBackground(bg);
    sheet.getRange(row, 2).setValue(d.group).setFontSize(10).setBackground(bg);
    sheet.getRange(row, 3).setValue(d.totalSessions).setHorizontalAlignment("center").setBackground(bg);
    sheet.getRange(row, 4).setValue(d.attended).setHorizontalAlignment("center").setBackground(bg);
    sheet.getRange(row, 5).setValue(d.absences).setHorizontalAlignment("center").setFontColor(C.RED).setBackground(bg);
    sheet.getRange(row, 6).setValue(d.absencePct + "%").setHorizontalAlignment("center").setFontWeight("bold").setBackground(bg);

    if (d.flag === "critical") {
      sheet.getRange(row, 6).setFontColor(C.RED).setBackground(C.RED_BG);
      sheet.getRange(row, 7).setValue("🔴 Contact Family").setHorizontalAlignment("center").setFontColor(C.RED).setBackground(C.RED_BG);
    } else {
      sheet.getRange(row, 6).setFontColor(C.YELLOW).setBackground(C.YELLOW_BG);
      sheet.getRange(row, 7).setValue("🟡 Monitor").setHorizontalAlignment("center").setBackground(bg);
    }

    sheet.setRowHeight(row, 22);
    row++;
  });

  sheet.setRowHeight(row, 12); row++;
  return row;
}


// ─────────────────────────────────────────────────────────────────────────
// MONDAY DIGEST EMAIL
// ─────────────────────────────────────────────────────────────────────────

function sendMondayDigest_() {
  var fn = "sendMondayDigest_";
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var schoolName = fcdGetSchoolName_(ss);
  var recipients = fcdGetEmailRecipients_(ss);

  if (recipients.length === 0) {
    fcdLog_(fn, "No email recipients configured. Add a 'Digest Email' row to Site Configuration.");
    return;
  }

  var records = fcdReadSGP_(ss);
  if (records.length === 0) {
    fcdLog_(fn, "No SGP data — skipping email.");
    return;
  }

  var gradeSummary = fcdReadGradeSummary_(ss);
  var today = new Date();
  var monday = fcdGetMonday_(today);
  var prevMonday = new Date(monday);
  prevMonday.setDate(prevMonday.getDate() - 7);
  var prevSunday = fcdGetSunday_(prevMonday);
  var weekLabel = fcdDateStr_(prevMonday);

  var twoWeeksBefore = new Date(prevMonday);
  twoWeeksBefore.setDate(twoWeeksBefore.getDate() - 7);

  var reteach = fcdCalcReteach_(records, twoWeeksBefore, prevSunday);
  var mastery = fcdCalcGroupMastery_(gradeSummary, records, twoWeeksBefore, prevSunday);
  var growth = fcdCalcGrowthSlope_(records, FCD_CONFIG.ROLLING_WEEKS);
  var absence = fcdCalcAbsenteeism_(records, twoWeeksBefore, prevSunday);
  var priorities = fcdBuildPriorityMatrix_(reteach, mastery, growth, absence, records, twoWeeksBefore, prevSunday);

  var htmlBody = fcdBuildMondayDigest_(priorities, reteach, mastery, growth, absence, schoolName, weekLabel);

  var subject = "📋 Monday Coaching Digest — " + schoolName + " (Week of " + weekLabel + ")";

  recipients.forEach(function(email) {
    try {
      MailApp.sendEmail({
        to: email,
        subject: subject,
        htmlBody: htmlBody,
        name: schoolName + " UFLI Dashboard"
      });
      fcdLog_(fn, "Digest sent to " + email);
    } catch (e) {
      fcdLog_(fn, "Failed to send to " + email + ": " + e.message);
    }
  });

  fcdLog_(fn, "Monday Digest sent to " + recipients.length + " recipients for week of " + weekLabel);
}

function sendMondayDigestPreview() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ui = SpreadsheetApp.getUi();
  var schoolName = fcdGetSchoolName_(ss);

  var records = fcdReadSGP_(ss);
  if (records.length === 0) {
    ui.alert("No Data", "No Small Group Progress data found.", ui.ButtonSet.OK);
    return;
  }

  var gradeSummary = fcdReadGradeSummary_(ss);
  var today = new Date();
  var monday = fcdGetMonday_(today);
  var sunday = fcdGetSunday_(monday);
  var weekLabel = fcdDateStr_(monday);

  var twoWeeksAgo = new Date(monday);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  var reteach = fcdCalcReteach_(records, twoWeeksAgo, sunday);
  var mastery = fcdCalcGroupMastery_(gradeSummary, records, twoWeeksAgo, sunday);
  var growth = fcdCalcGrowthSlope_(records, FCD_CONFIG.ROLLING_WEEKS);
  var absence = fcdCalcAbsenteeism_(records, twoWeeksAgo, sunday);
  var priorities = fcdBuildPriorityMatrix_(reteach, mastery, growth, absence, records, twoWeeksAgo, sunday);

  var htmlBody = fcdBuildMondayDigest_(priorities, reteach, mastery, growth, absence, schoolName, weekLabel);

  var myEmail = Session.getActiveUser().getEmail();
  MailApp.sendEmail({
    to: myEmail,
    subject: "📋 [PREVIEW] Monday Coaching Digest — " + schoolName,
    htmlBody: htmlBody,
    name: schoolName + " UFLI Dashboard"
  });

  ui.alert("Preview Sent", "Monday Digest preview sent to " + myEmail, ui.ButtonSet.OK);
}


// ─────────────────────────────────────────────────────────────────────────
// TRIGGERS
// ─────────────────────────────────────────────────────────────────────────

function setupSundayDigestTrigger() {
  var ui = SpreadsheetApp.getUi();

  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === "sendMondayDigest_") ScriptApp.deleteTrigger(t);
  });

  ScriptApp.newTrigger("sendMondayDigest_")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(7)
    .create();

  var recipients = fcdGetEmailRecipients_(SpreadsheetApp.getActiveSpreadsheet());

  ui.alert("Sunday Digest Trigger Enabled",
    "Monday Coaching Digest will be emailed every Sunday at 7 AM.\n\n" +
    "Recipients (" + recipients.length + "): " + (recipients.length > 0 ? recipients.join(", ") : "⚠ None configured — add a 'Digest Email' row to Site Configuration") + "\n\n" +
    "Use 'Send Monday Digest (Preview)' to test anytime.",
    ui.ButtonSet.OK);
}
