/**
 * =============================================================================
 * UFLI MASTER SYSTEM — ASSESSMENT ENGINE
 * =============================================================================
 * File: AssessmentEngine.gs
 *
 * Processes assessment form submissions and writes results to the
 * Initial Assessment sheet, UFLI MAP, and Component Analysis.
 *
 * SELF-CONTAINED: This file includes safe fallbacks so it works whether
 * or not the full Master System files (_SiteConfig.gs, _Constants.gs)
 * are present. If they exist, it uses them. If not, it uses defaults.
 *
 * WRITES TO:
 *   - Initial Assessment sheet (frozen baseline)
 *   - UFLI MAP (living document — copies baseline as starting point)
 *   - Component Analysis (diagnostic error log)
 *
 * =============================================================================
 */


// =================================================================
// --- SAFE CONFIG & CONSTANTS (fallbacks if Master System not present) ---
// =================================================================

/**
 * Safe config getter — uses Master System getSiteConfig() if available,
 * otherwise falls back to sensible defaults.
 * @returns {Object} Configuration with sheet names
 */
function getAssessmentConfig_() {
  try {
    if (typeof getSiteConfig === 'function') {
      return getSiteConfig();
    }
  } catch (e) { /* fall through to defaults */ }

  return {
    sheetNames: {
      studentRoster: 'Student Roster',
      configuration: 'Configuration',
      initialAssessment: 'Initial Assessment',
      ufliMap: 'UFLI MAP',
      componentAnalysis: 'Component Analysis'
    }
  };
}

/**
 * Safe REVIEW_LESSONS getter — uses _Constants.gs if available.
 */
function getReviewLessons_() {
  try {
    if (typeof REVIEW_LESSONS !== 'undefined' && typeof REVIEW_LESSONS.has === 'function') {
      return REVIEW_LESSONS;
    }
  } catch(e) {}
  // Return an object with a .has() method for compatibility
  var lessons = {5:1, 10:1, 19:1, 49:1, 53:1, 59:1, 62:1, 71:1, 76:1, 79:1, 83:1, 88:1, 92:1, 97:1, 106:1, 128:1};
  return {
    has: function(n) { return lessons[n] === 1; }
  };
}

/**
 * Safe GRADE_SKILL_CONFIG getter — uses _Constants.gs if available.
 */
function getGradeSkillConfig_() {
  if (typeof GRADE_SKILL_CONFIG !== 'undefined') return GRADE_SKILL_CONFIG;

  var rl = getReviewLessons_();
  return {
    foundational: {
      name: 'Foundational Skills',
      isLessonIncluded: function(n) { return n >= 1 && n <= 34 && !rl.has(n); }
    },
    kindergarten_grade: {
      name: 'KG Skills',
      isLessonIncluded: function(n) {
        var ex = new Set([38, 60, 61]);
        return n >= 1 && n <= 68 && !ex.has(n) && !rl.has(n);
      }
    },
    first_grade: {
      name: '1st Grade Skills',
      isLessonIncluded: function(n) { return n >= 35 && n <= 110 && !rl.has(n); }
    },
    second_grade: {
      name: '2nd Grade Skills',
      isLessonIncluded: function(n) { return n >= 38 && n <= 127 && !rl.has(n); }
    }
  };
}


// =================================================================
// --- DATA PROVIDERS (called by the HTML form) ---
// =================================================================

/**
 * Returns the student list for the assessment form dropdown.
 * Pulls from the Student Roster sheet.
 *
 * @returns {Array<Object>} Array of { name, grade, id, teacher }
 */
function getAssessmentStudentList() {
  try {
    var config = getAssessmentConfig_();
    var sheetName = (config.sheetNames && config.sheetNames.studentRoster) || 'Student Roster';
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

    if (!sheet || sheet.getLastRow() < 2) return [];

    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
    return data
      .filter(function(row) { return row[0] && row[0].toString().trim(); })
      .map(function(row) {
        return {
          name: row[0].toString().trim(),
          grade: row[1] !== '' ? row[1].toString() : '',
          id: row[2] || '',
          teacher: row[3] || ''
        };
      })
      .sort(function(a, b) { return a.name.localeCompare(b.name); });

  } catch (error) {
    console.error('Error getting assessment student list:', error);
    return [];
  }
}


/**
 * Returns the scorer list for the assessment form dropdown.
 * Pulls from the Configuration sheet.
 *
 * @returns {Array<string>} Array of scorer names
 */
function getAssessmentScorerList() {
  try {
    var config = getAssessmentConfig_();
    var sheetName = (config.sheetNames && config.sheetNames.configuration) || 'Configuration';
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);

    if (!sheet || sheet.getLastRow() < 2) return ['Default Scorer'];

    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
    var scorers = data.flat().filter(function(s) { return s && s.toString().trim(); });

    return scorers.length > 0 ? scorers : ['Default Scorer'];

  } catch (error) {
    console.error('Error getting scorer list:', error);
    return ['Default Scorer'];
  }
}


// =================================================================
// --- CORE SUBMISSION PROCESSING ---
// =================================================================

/**
 * Main entry point for assessment form submission.
 * Maps component-level results to lesson-level Y/N values and writes
 * to the Initial Assessment sheet, UFLI MAP, and Component Analysis.
 *
 * @param {Object} formData - The assessment form data
 * @returns {Object} { success: boolean, message: string, summary?: Object }
 */
function submitInitialAssessment(formData) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    // ─── Validate required fields ───────────────────────────────
    if (!formData.studentName || !formData.date || !formData.scorer) {
      return {
        success: false,
        message: 'Missing required fields: Student Name, Date, or Scorer.'
      };
    }

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var config = getAssessmentConfig_();
    var grade = parseInt(formData.grade);
    var rl = getReviewLessons_();

    // ─── Get target sheets ──────────────────────────────────────
    var initialAssessmentSheet = ss.getSheetByName(
      (config.sheetNames && config.sheetNames.initialAssessment) || 'Initial Assessment'
    );
    var ufliMapSheet = ss.getSheetByName(
      (config.sheetNames && config.sheetNames.ufliMap) || 'UFLI MAP'
    );
    var componentSheet = ss.getSheetByName(
      (config.sheetNames && config.sheetNames.componentAnalysis) || 'Component Analysis'
    );

    if (!initialAssessmentSheet) {
      return {
        success: false,
        message: 'Initial Assessment sheet not found. Please run Setup first.'
      };
    }

    // ─── Map components to lesson results ───────────────────────
    var mapped = mapComponentsToLessons_(formData.sections, formData, rl);
    var lessonResults = mapped.lessonResults;
    var componentErrors = mapped.componentErrors;

    // ─── Log component-level errors (diagnostic detail) ────────
    if (componentErrors.length > 0 && componentSheet) {
      var startRow = componentSheet.getLastRow() + 1;
      componentSheet.getRange(
        startRow, 1, componentErrors.length, 6
      ).setValues(componentErrors);
    }

    // ─── Calculate assessment metrics ───────────────────────────
    var metrics = calculateAssessmentMetrics_(lessonResults, grade, rl);

    // ─── Build and write Initial Assessment row ─────────────────
    var iaRow = buildInitialAssessmentRow_(formData, lessonResults, metrics, rl);
    var iaHeaders = initialAssessmentSheet.getRange(
      1, 1, 1, initialAssessmentSheet.getLastColumn()
    ).getValues()[0];

    // Check if student already has an initial assessment
    var existingRow = findStudentRow_(initialAssessmentSheet, formData.studentName, iaHeaders);

    if (existingRow > 0) {
      initialAssessmentSheet.getRange(existingRow, 1, 1, iaRow.length).setValues([iaRow]);
    } else {
      initialAssessmentSheet.appendRow(iaRow);
    }

    // ─── Copy to UFLI MAP (baseline starting point) ────────────
    if (ufliMapSheet) {
      copyToUfliMap_(ufliMapSheet, formData, lessonResults, rl);
    }

    // ─── Format percentage columns ─────────────────────────────
    formatPercentageColumns_(initialAssessmentSheet, iaHeaders);

    // ─── Build response ─────────────────────────────────────────
    var overallPct = (metrics.overall * 100).toFixed(1);
    var sectionSummary = buildSectionSummary_(formData.sections);

    return {
      success: true,
      message: 'Assessment for ' + formData.studentName + ' submitted successfully!',
      summary: {
        overall: overallPct + '%',
        foundational: (metrics.foundational * 100).toFixed(1) + '%',
        sectionsAssessed: sectionSummary.sectionsAssessed,
        totalComponents: sectionSummary.totalComponents,
        correctComponents: sectionSummary.correctComponents,
        missedComponents: sectionSummary.missedComponents
      }
    };

  } catch (error) {
    console.error('Assessment submission error:', error);
    return {
      success: false,
      message: 'Submission failed: ' + error.message
    };
  } finally {
    lock.releaseLock();
  }
}


// =================================================================
// --- COMPONENT → LESSON MAPPING ---
// =================================================================

/**
 * Maps component-level assessment results to lesson-level Y/N values.
 *
 * Rules:
 *   - If a component is correct → all mapped lessons get 'Y'
 *   - If a component is incorrect → all mapped lessons get 'N'
 *   - N overrides Y (if ANY component mapping to a lesson is wrong, lesson = N)
 *   - Unassessed components don't change the lesson value
 */
function mapComponentsToLessons_(sections, formData, reviewLessons) {
  var lessonResults = {};
  for (var i = 1; i <= 128; i++) {
    if (!reviewLessons.has(i)) {
      lessonResults[i] = '';
    }
  }

  var componentErrors = [];

  sections.forEach(function(section) {
    section.words.forEach(function(wordData) {
      var componentsCorrect = [];
      var componentsMissed = [];

      wordData.components.forEach(function(comp) {
        var lessonNumbers = comp.lessons || [];

        if (comp.correct === true) {
          componentsCorrect.push(comp.name);
          lessonNumbers.forEach(function(lesson) {
            if (lesson && !reviewLessons.has(lesson)) {
              if (lessonResults[lesson] !== 'N') {
                lessonResults[lesson] = 'Y';
              }
            }
          });

        } else if (comp.correct === false) {
          componentsMissed.push(comp.name);
          lessonNumbers.forEach(function(lesson) {
            if (lesson && !reviewLessons.has(lesson)) {
              lessonResults[lesson] = 'N';
            }
          });
        }
        // Unassessed (null/undefined): Leave lesson as-is
      });

      if (componentsMissed.length > 0) {
        componentErrors.push([
          formData.date,
          formData.studentName,
          wordData.word,
          componentsCorrect.join(', '),
          componentsMissed.join(', '),
          'Section: ' + (section.name || 'Unknown')
        ]);
      }
    });
  });

  return { lessonResults: lessonResults, componentErrors: componentErrors };
}


// =================================================================
// --- ROW BUILDERS ---
// =================================================================

/**
 * Builds a row for the Initial Assessment sheet.
 */
function buildInitialAssessmentRow_(formData, lessonResults, metrics, reviewLessons) {
  var teacher = formData.teacher || getStudentTeacher_(formData.studentName) || '';

  var row = [
    formData.studentName,
    formData.grade,
    teacher,
    formData.date,
    formData.scorer,
    formData.isKindergartenEndOfYear ? 'KG End of Year' : 'Standard'
  ];

  // Lesson columns (skip review lessons)
  for (var i = 1; i <= 128; i++) {
    if (!reviewLessons.has(i)) {
      row.push(lessonResults[i] || '');
    }
  }

  // Metric columns
  row.push(
    metrics.foundational,
    metrics.kindergarten,
    metrics.firstGrade,
    metrics.secondGrade,
    metrics.overall,
    formData.notes || ''
  );

  return row;
}


/**
 * Copies initial assessment data to the UFLI MAP as the starting baseline.
 */
function copyToUfliMap_(ufliMapSheet, formData, lessonResults, reviewLessons) {
  try {
    var headers = ufliMapSheet.getRange(
      1, 1, 1, ufliMapSheet.getLastColumn()
    ).getValues()[0];

    var nameIndex = headers.indexOf('Student Name');
    if (nameIndex === -1) return;

    var existingRow = findStudentRow_(ufliMapSheet, formData.studentName, headers);

    if (existingRow > 0) {
      // Update lesson columns only (don't overwrite Group, Current Lesson, etc.)
      for (var i = 1; i <= 128; i++) {
        if (!reviewLessons.has(i)) {
          var headerName = 'L' + i;
          var colIndex = headers.indexOf(headerName);

          if (colIndex !== -1 && lessonResults[i]) {
            ufliMapSheet.getRange(existingRow, colIndex + 1).setValue(lessonResults[i]);
          }
        }
      }
    } else {
      // Student not yet on UFLI MAP — create a row
      var teacher = formData.teacher || getStudentTeacher_(formData.studentName) || '';
      var newRow = new Array(headers.length).fill('');

      var setCol = function(name, value) {
        var idx = headers.indexOf(name);
        if (idx !== -1) newRow[idx] = value;
      };

      setCol('Student Name', formData.studentName);
      setCol('Grade', formData.grade);
      setCol('Teacher', teacher);

      for (var j = 1; j <= 128; j++) {
        if (!reviewLessons.has(j) && lessonResults[j]) {
          var idx = headers.indexOf('L' + j);
          if (idx !== -1) newRow[idx] = lessonResults[j];
        }
      }

      ufliMapSheet.appendRow(newRow);
    }

  } catch (error) {
    console.error('Error copying to UFLI MAP:', error);
    // Non-fatal: Initial Assessment was already written successfully
  }
}


// =================================================================
// --- CALCULATIONS ---
// =================================================================

/**
 * Calculates all assessment percentage metrics.
 */
function calculateAssessmentMetrics_(lessonResults, grade, reviewLessons) {
  var gradeConfig = getGradeSkillConfig_();

  var calculate = function(config) {
    var mastered = 0, tested = 0;
    for (var i = 1; i <= 128; i++) {
      if (config.isLessonIncluded(i)) {
        if (lessonResults[i] === 'Y') { mastered++; tested++; }
        else if (lessonResults[i] === 'N') { tested++; }
      }
    }
    return tested > 0 ? (mastered / tested) : 0;
  };

  // Overall: mastered / tested across ALL assessed lessons
  var totalMastered = 0, totalTested = 0;
  for (var key in lessonResults) {
    if (lessonResults[key] === 'Y') { totalMastered++; totalTested++; }
    else if (lessonResults[key] === 'N') { totalTested++; }
  }

  return {
    foundational: calculate(gradeConfig.foundational),
    kindergarten: (grade === 0) ? calculate(gradeConfig.kindergarten_grade) : 0,
    firstGrade: calculate(gradeConfig.first_grade),
    secondGrade: calculate(gradeConfig.second_grade),
    overall: totalTested > 0 ? (totalMastered / totalTested) : 0
  };
}


// =================================================================
// --- REPORT HELPERS ---
// =================================================================

/**
 * Gets the initial assessment data for a specific student.
 * Used by ReportEngine for growth calculations.
 */
function getInitialAssessmentData(studentName) {
  try {
    var config = getAssessmentConfig_();
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      (config.sheetNames && config.sheetNames.initialAssessment) || 'Initial Assessment'
    );

    if (!sheet || sheet.getLastRow() < 2) return null;

    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var nameIndex = headers.indexOf('Student Name');

    for (var i = 1; i < data.length; i++) {
      if (data[i][nameIndex] === studentName) {
        var result = {};
        headers.forEach(function(header, idx) {
          result[header] = data[i][idx];
        });
        return result;
      }
    }

    return null;

  } catch (error) {
    console.error('Error getting initial assessment data:', error);
    return null;
  }
}


/**
 * Compares a student's initial assessment to their current UFLI MAP data.
 */
function getAssessmentComparison(studentName) {
  try {
    var config = getAssessmentConfig_();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var rl = getReviewLessons_();

    var iaSheet = ss.getSheetByName(
      (config.sheetNames && config.sheetNames.initialAssessment) || 'Initial Assessment'
    );
    var mapSheet = ss.getSheetByName(
      (config.sheetNames && config.sheetNames.ufliMap) || 'UFLI MAP'
    );

    if (!iaSheet || !mapSheet) return null;

    var iaData = iaSheet.getDataRange().getValues();
    var mapData = mapSheet.getDataRange().getValues();
    var iaHeaders = iaData[0];
    var mapHeaders = mapData[0];

    var iaNameIdx = iaHeaders.indexOf('Student Name');
    var mapNameIdx = mapHeaders.indexOf('Student Name');

    var iaRow = null, mapRow = null;

    for (var i = 1; i < iaData.length; i++) {
      if (iaData[i][iaNameIdx] === studentName) { iaRow = iaData[i]; break; }
    }
    for (var j = 1; j < mapData.length; j++) {
      if (mapData[j][mapNameIdx] === studentName) { mapRow = mapData[j]; break; }
    }

    if (!iaRow || !mapRow) return null;

    var comparison = {
      studentName: studentName,
      lessonsImproved: [],
      lessonsRegressed: [],
      lessonsUnchanged: 0,
      initialOverall: 0,
      currentOverall: 0,
      growth: 0
    };

    var iaTotal = 0, iaMastered = 0, mapTotal = 0, mapMastered = 0;

    for (var k = 1; k <= 128; k++) {
      if (rl.has(k)) continue;

      var headerName = 'L' + k;
      var iaIdx = iaHeaders.indexOf(headerName);
      var mapIdx = mapHeaders.indexOf(headerName);

      if (iaIdx === -1 || mapIdx === -1) continue;

      var iaVal = iaRow[iaIdx];
      var mapVal = mapRow[mapIdx];

      if (iaVal === 'Y' || iaVal === 'N') {
        iaTotal++;
        if (iaVal === 'Y') iaMastered++;
      }
      if (mapVal === 'Y' || mapVal === 'N') {
        mapTotal++;
        if (mapVal === 'Y') mapMastered++;
      }

      if (iaVal === 'N' && mapVal === 'Y') {
        comparison.lessonsImproved.push(k);
      } else if (iaVal === 'Y' && mapVal === 'N') {
        comparison.lessonsRegressed.push(k);
      } else {
        comparison.lessonsUnchanged++;
      }
    }

    comparison.initialOverall = iaTotal > 0 ? iaMastered / iaTotal : 0;
    comparison.currentOverall = mapTotal > 0 ? mapMastered / mapTotal : 0;
    comparison.growth = comparison.currentOverall - comparison.initialOverall;

    return comparison;

  } catch (error) {
    console.error('Error getting assessment comparison:', error);
    return null;
  }
}


/**
 * Generates a class-wide initial assessment summary report.
 */
function generateAssessmentSummaryReport() {
  try {
    var config = getAssessmentConfig_();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var ui = SpreadsheetApp.getUi();
    var rl = getReviewLessons_();

    var iaSheet = ss.getSheetByName(
      (config.sheetNames && config.sheetNames.initialAssessment) || 'Initial Assessment'
    );
    if (!iaSheet || iaSheet.getLastRow() < 2) {
      ui.alert('No initial assessment data available.');
      return null;
    }

    var reportName = 'Assessment Summary';
    var reportSheet = ss.getSheetByName(reportName);
    if (reportSheet) {
      reportSheet.clear();
    } else {
      reportSheet = ss.insertSheet(reportName);
    }

    var iaData = iaSheet.getDataRange().getValues();
    var headers = iaData.shift();

    var nameIdx = headers.indexOf('Student Name');
    var gradeIdx = headers.indexOf('Grade');
    var overallIdx = headers.indexOf('Overall %');
    var foundIdx = headers.indexOf('Foundational Skills %');

    // ─── Report Header ──────────────────────────────────────────
    var row = 1;
    reportSheet.getRange(row, 1, 1, 8).merge()
      .setValue('UFLI Initial Assessment Summary')
      .setFontSize(18)
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
    row += 2;

    reportSheet.getRange(row, 1, 1, 8).merge()
      .setValue('Generated: ' + new Date().toLocaleDateString() + ' | Students Assessed: ' + iaData.length)
      .setHorizontalAlignment('center')
      .setFontStyle('italic');
    row += 2;

    // ─── Student Overview Table ─────────────────────────────────
    var overviewHeaders = ['Student', 'Grade', 'Overall %', 'Foundational %', 'Status'];
    reportSheet.getRange(row, 1, 1, overviewHeaders.length).setValues([overviewHeaders]);
    reportSheet.getRange(row, 1, 1, overviewHeaders.length)
      .setFontWeight('bold')
      .setBackground('#4285F4')
      .setFontColor('#FFFFFF');
    row++;

    var overviewRows = [];

    iaData.forEach(function(studentRow) {
      var overall = studentRow[overallIdx];

      var status = 'Needs Support';
      if (overall >= 0.9) status = 'Mastered';
      else if (overall >= 0.8) status = 'Proficient';
      else if (overall >= 0.6) status = 'Developing';

      overviewRows.push([
        studentRow[nameIdx],
        studentRow[gradeIdx],
        overall,
        studentRow[foundIdx],
        status
      ]);
    });

    overviewRows.sort(function(a, b) { return (a[2] || 0) - (b[2] || 0); });

    if (overviewRows.length > 0) {
      reportSheet.getRange(row, 1, overviewRows.length, overviewHeaders.length)
        .setValues(overviewRows);

      reportSheet.getRange(row, 3, overviewRows.length, 2).setNumberFormat('0.0%');

      overviewRows.forEach(function(r, i) {
        var statusCell = reportSheet.getRange(row + i, 5);
        if (r[4] === 'Mastered') statusCell.setBackground('#d9ead3');
        else if (r[4] === 'Proficient') statusCell.setBackground('#b7e1cd');
        else if (r[4] === 'Developing') statusCell.setBackground('#fff2cc');
        else statusCell.setBackground('#f4cccc');
      });

      row += overviewRows.length;
    }

    // ─── Grouping Recommendations ───────────────────────────────
    row += 2;
    reportSheet.getRange(row, 1, 1, 8).merge()
      .setValue('GROUPING RECOMMENDATIONS')
      .setFontSize(14)
      .setFontWeight('bold');
    row++;

    var recommendations = generateGroupingRecommendations_(iaData, headers);
    recommendations.forEach(function(rec) {
      reportSheet.getRange(row, 1, 1, 8).merge()
        .setValue(rec)
        .setWrap(true);
      row++;
    });

    reportSheet.autoResizeColumns(1, overviewHeaders.length);
    ss.setActiveSheet(reportSheet);

    ui.alert('Assessment Summary report has been generated.');
    return { success: true };

  } catch (error) {
    console.error('Error generating assessment summary:', error);
    SpreadsheetApp.getUi().alert('Error: ' + error.message);
    return null;
  }
}


// =================================================================
// --- UTILITY FUNCTIONS ---
// =================================================================

/**
 * Finds a student's row number in a sheet by name match.
 */
function findStudentRow_(sheet, studentName, headers) {
  var nameIndex = headers.indexOf('Student Name');
  if (nameIndex === -1) return 0;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;

  var names = sheet.getRange(2, nameIndex + 1, lastRow - 1, 1).getValues();
  for (var i = 0; i < names.length; i++) {
    if (names[i][0] && names[i][0].toString().trim().toLowerCase()
        === studentName.trim().toLowerCase()) {
      return i + 2;
    }
  }

  return 0;
}


/**
 * Gets a student's teacher from the Student Roster.
 */
function getStudentTeacher_(studentName) {
  try {
    var config = getAssessmentConfig_();
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      (config.sheetNames && config.sheetNames.studentRoster) || 'Student Roster'
    );
    if (!sheet || sheet.getLastRow() < 2) return '';

    var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
    for (var i = 0; i < data.length; i++) {
      if (data[i][0] && data[i][0].toString().trim().toLowerCase()
          === studentName.trim().toLowerCase()) {
        return data[i][3] ? data[i][3].toString().trim() : '';
      }
    }

    return '';

  } catch (error) {
    return '';
  }
}


/**
 * Formats percentage columns in a sheet.
 */
function formatPercentageColumns_(sheet, headers) {
  var percentCols = [
    'Foundational Skills %', 'KG Skills %', '1st Grade Skills %',
    '2nd Grade Skills %', 'Overall %'
  ];

  var lastRow = sheet.getLastRow();
  percentCols.forEach(function(colName) {
    var colIndex = headers.indexOf(colName) + 1;
    if (colIndex > 0 && lastRow >= 2) {
      sheet.getRange(lastRow, colIndex).setNumberFormat('0.0%');
    }
  });
}


/**
 * Builds a quick summary of the assessment for the success modal.
 */
function buildSectionSummary_(sections) {
  var totalComponents = 0, correctComponents = 0, missedComponents = 0;

  sections.forEach(function(section) {
    section.words.forEach(function(word) {
      word.components.forEach(function(comp) {
        totalComponents++;
        if (comp.correct === true) correctComponents++;
        else if (comp.correct === false) missedComponents++;
      });
    });
  });

  return {
    sectionsAssessed: sections.length,
    totalComponents: totalComponents,
    correctComponents: correctComponents,
    missedComponents: missedComponents,
    unassessedComponents: totalComponents - correctComponents - missedComponents
  };
}


/**
 * Generates grouping recommendations based on initial assessment patterns.
 */
function generateGroupingRecommendations_(studentData, headers) {
  var recommendations = [];
  var overallIdx = headers.indexOf('Overall %');

  var critical = 0, moderate = 0, developing = 0, mastered = 0;

  studentData.forEach(function(row) {
    var overall = row[overallIdx];
    if (overall >= 0.9) mastered++;
    else if (overall >= 0.7) developing++;
    else if (overall >= 0.5) moderate++;
    else critical++;
  });

  if (critical > 0) {
    recommendations.push(
      '❗ ' + critical + ' student(s) scored below 50% — these students need intensive, small-group intervention starting with their earliest gap areas.'
    );
  }
  if (moderate > 0) {
    recommendations.push(
      '⚠️ ' + moderate + ' student(s) scored 50-69% — group these students by their shared gap patterns for targeted instruction.'
    );
  }
  if (developing > 0) {
    recommendations.push(
      '📈 ' + developing + ' student(s) scored 70-89% — these students are approaching mastery and may benefit from mixed grouping with periodic review.'
    );
  }
  if (mastered > 0) {
    recommendations.push(
      '✅ ' + mastered + ' student(s) scored 90%+ — consider enrichment activities or peer tutoring roles.'
    );
  }

  if (studentData.length >= 4) {
    recommendations.push(
      '💡 TIP: Look at the Section Heatmap above to identify students with similar gap patterns — they make natural groups for instruction.'
    );
  }

  return recommendations;
}


/**
 * Adds a new student to the roster from the assessment form.
 *
 * @param {Object} studentData - { name, grade }
 * @returns {Object} { success, message, students? }
 */
function addAssessmentStudent(studentData) {
  try {
    var name = studentData.name;
    var grade = studentData.grade;

    if (!name || grade === '' || grade === null || grade === undefined) {
      return { success: false, message: 'Student Name and Grade are required.' };
    }

    var config = getAssessmentConfig_();
    var rosterSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
      (config.sheetNames && config.sheetNames.studentRoster) || 'Student Roster'
    );

    if (!rosterSheet) {
      return { success: false, message: 'Student Roster sheet not found. Run Setup first.' };
    }

    // Check for duplicates
    var existingData = rosterSheet.getDataRange().getValues();
    for (var i = 1; i < existingData.length; i++) {
      if (existingData[i][0] &&
          existingData[i][0].toString().toLowerCase() === name.toLowerCase()) {
        return { success: false, message: 'Student "' + name + '" already exists.' };
      }
    }

    // Add to roster
    rosterSheet.appendRow([
      name, grade, '', '', 'Added via Assessment ' + new Date().toLocaleDateString()
    ]);

    // Return updated list
    var updatedList = getAssessmentStudentList();
    return {
      success: true,
      message: name + ' has been added to the roster.',
      students: updatedList
    };

  } catch (error) {
    console.error('Error adding student:', error);
    return { success: false, message: 'Error: ' + error.message };
  }
}
