// ============================================================================
// MAP GRADES FROM GRADE SUMMARY TO INITIAL ASSESSMENT
// Grade Summary is ground truth for grades
// ============================================================================

const GRADE_MAP_CONFIG = {
  gsSheetName: 'Grade Summary',
  iaSheetName: 'Initial Assessment',
  startRow: 6,
  nameCol: 1,    // Column A
  gradeCol: 2,   // Column B
  fuzzyThreshold: 0.65
};

// ============== MAIN FUNCTION ==============
function mapGradesToIA() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const gsSheet = ss.getSheetByName(GRADE_MAP_CONFIG.gsSheetName);
  const iaSheet = ss.getSheetByName(GRADE_MAP_CONFIG.iaSheetName);
  
  if (!gsSheet) {
    SpreadsheetApp.getUi().alert('Error: "Grade Summary" sheet not found.');
    return;
  }
  
  if (!iaSheet) {
    SpreadsheetApp.getUi().alert('Error: "Initial Assessment" sheet not found.');
    return;
  }
  
  // Get data from both sheets
  const gsData = getStudentGradesFromSheet(gsSheet);
  const iaData = getStudentGradesFromSheet(iaSheet);
  
  Logger.log(`Grade Summary: ${gsData.length} students`);
  Logger.log(`Initial Assessment: ${iaData.length} students`);
  
  // Match and prepare updates
  const { updates, fuzzyMatches, notFound } = matchStudentsForGradeMap(gsData, iaData);
  
  Logger.log(`Direct updates (exact match): ${updates.length}`);
  Logger.log(`Fuzzy matches needing validation: ${fuzzyMatches.length}`);
  Logger.log(`Not found on IA: ${notFound.length}`);
  
  // Apply exact match updates immediately
  let updatedCount = 0;
  updates.forEach(update => {
    iaSheet.getRange(update.iaRow, GRADE_MAP_CONFIG.gradeCol).setValue(update.grade);
    updatedCount++;
  });
  
  if (fuzzyMatches.length === 0) {
    SpreadsheetApp.getUi().alert(
      'Grade Mapping Complete',
      `• ${updatedCount} grades updated (exact matches)\n• ${notFound.length} students not found on Initial Assessment`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
    return;
  }
  
  // Store fuzzy matches for validation dialog
  const props = PropertiesService.getScriptProperties();
  props.setProperty('gradeMap_fuzzy', JSON.stringify(fuzzyMatches));
  props.setProperty('gradeMap_updatedCount', updatedCount.toString());
  props.setProperty('gradeMap_notFoundCount', notFound.length.toString());
  
  // Show validation dialog for fuzzy matches
  showGradeMapValidationDialog(fuzzyMatches.length, updatedCount, notFound.length);
}

// ============== GET STUDENT GRADES FROM SHEET ==============
function getStudentGradesFromSheet(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < GRADE_MAP_CONFIG.startRow) return [];
  
  const data = sheet.getRange(GRADE_MAP_CONFIG.startRow, 1, lastRow - GRADE_MAP_CONFIG.startRow + 1, 2).getValues();
  const students = [];
  
  for (let i = 0; i < data.length; i++) {
    const name = data[i][0];
    const grade = data[i][1];
    
    if (name && String(name).trim() !== '') {
      students.push({
        name: String(name).trim(),
        normalized: normalizeNameGradeMap(name),
        grade: grade !== null && grade !== undefined ? String(grade).trim() : '',
        row: i + GRADE_MAP_CONFIG.startRow
      });
    }
  }
  
  return students;
}

// ============== NAME NORMALIZATION ==============
function normalizeNameGradeMap(name) {
  if (!name) return '';
  
  let normalized = String(name).toLowerCase().trim();
  normalized = normalized.replace(/\s+/g, ' ');
  normalized = normalized.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()'"]/g, '');
  normalized = normalized.replace(/\b(jr|junior|sr|senior|ii|iii|iv)\b/g, '');
  
  if (normalized.includes(',')) {
    const parts = normalized.split(',').map(p => p.trim());
    if (parts.length === 2) {
      normalized = parts[1] + ' ' + parts[0];
    }
  }
  
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

// ============== MATCH STUDENTS ==============
function matchStudentsForGradeMap(gsData, iaData) {
  const updates = [];       // Exact matches - update immediately
  const fuzzyMatches = [];  // Need validation
  const notFound = [];      // Not found on IA
  
  // Build IA lookup map
  const iaNormalizedMap = new Map();
  iaData.forEach(ia => iaNormalizedMap.set(ia.normalized, ia));
  
  const matchedIANormalized = new Set();
  
  gsData.forEach(gs => {
    // Skip if no grade to map
    if (!gs.grade) return;
    
    // Exact match
    if (iaNormalizedMap.has(gs.normalized)) {
      const ia = iaNormalizedMap.get(gs.normalized);
      updates.push({
        iaRow: ia.row,
        grade: gs.grade
      });
      matchedIANormalized.add(gs.normalized);
      return;
    }
    
    // Fuzzy match
    let bestMatch = null;
    let bestSimilarity = 0;
    
    iaData.forEach(ia => {
      if (matchedIANormalized.has(ia.normalized)) return;
      
      const similarity = calculateSimilarityGradeMap(gs.normalized, ia.normalized);
      if (similarity >= GRADE_MAP_CONFIG.fuzzyThreshold && similarity > bestSimilarity) {
        bestMatch = ia;
        bestSimilarity = similarity;
      }
    });
    
    if (bestMatch) {
      fuzzyMatches.push({
        gsName: gs.name,
        gsGrade: gs.grade,
        iaName: bestMatch.name,
        iaRow: bestMatch.row,
        iaCurrentGrade: bestMatch.grade,
        sim: Math.round(bestSimilarity * 100)
      });
      matchedIANormalized.add(bestMatch.normalized);
    } else {
      notFound.push(gs);
    }
  });
  
  return { updates, fuzzyMatches, notFound };
}

// ============== STRING SIMILARITY ==============
function calculateSimilarityGradeMap(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistanceGradeMap(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistanceGradeMap(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

// ============== GET FUZZY DATA FOR DIALOG ==============
function getGradeMapFuzzyData() {
  const props = PropertiesService.getScriptProperties();
  return JSON.parse(props.getProperty('gradeMap_fuzzy') || '[]');
}

// ============== VALIDATION DIALOG ==============
function showGradeMapValidationDialog(fuzzyCount, updatedCount, notFoundCount) {
  const html = HtmlService.createHtmlOutput(`
    <style>
      body { font-family: Arial, sans-serif; padding: 15px; overflow-y: auto; }
      h3 { color: #1a73e8; margin-top: 20px; }
      .summary { background: #e8f0fe; padding: 15px; border-radius: 8px; margin-bottom: 15px; }
      .match-row { 
        background: #f8f9fa; 
        padding: 12px; 
        margin: 8px 0; 
        border-radius: 6px;
        border-left: 4px solid #fbbc04;
      }
      .gs-name { font-weight: bold; color: #1e8e3e; }
      .ia-name { color: #5f6368; }
      .grade-tag { background: #e8eaed; padding: 2px 8px; border-radius: 4px; font-size: 12px; margin-left: 5px; }
      .info { color: #80868b; font-size: 12px; }
      select { 
        padding: 6px 10px; 
        margin: 5px 0;
        border-radius: 4px;
        border: 1px solid #dadce0;
      }
      .btn { 
        padding: 10px 24px; 
        margin: 5px; 
        border: none; 
        border-radius: 4px; 
        cursor: pointer;
        font-size: 14px;
      }
      .btn-primary { background: #1a73e8; color: white; }
      .btn-primary:hover { background: #1557b0; }
      .btn-secondary { background: #f1f3f4; color: #3c4043; }
      .btn-secondary:hover { background: #e8eaed; }
      .actions { margin-top: 20px; text-align: right; border-top: 1px solid #dadce0; padding-top: 15px; position: sticky; bottom: 0; background: white; }
      .count { background: #e8f0fe; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
      #loading { text-align: center; padding: 50px; }
    </style>
    
    <div class="summary">
      <strong>Progress:</strong> ${updatedCount} grades already updated (exact matches)<br>
      <strong>Remaining:</strong> ${fuzzyCount} fuzzy matches to review, ${notFoundCount} not found
    </div>
    
    <div id="loading">Loading fuzzy matches...</div>
    <div id="content"></div>
    
    <div class="actions">
      <button class="btn btn-secondary" onclick="google.script.host.close()">Cancel</button>
      <button class="btn btn-primary" onclick="submitValidation()">Apply Grade Updates</button>
    </div>
    
    <script>
      let fuzzyMatches = [];
      
      function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
      }
      
      function loadData() {
        google.script.run
          .withSuccessHandler(function(data) {
            fuzzyMatches = data;
            buildContent();
          })
          .withFailureHandler(function(err) {
            document.getElementById('loading').innerHTML = 'Error loading data: ' + err;
          })
          .getGradeMapFuzzyData();
      }
      
      function buildContent() {
        let html = '';
        
        if (fuzzyMatches.length > 0) {
          html += '<h3>Fuzzy Matches <span class="count">' + fuzzyMatches.length + '</span></h3>';
          html += '<p style="color:#5f6368; font-size:13px;">Confirm grade mapping for these fuzzy name matches.</p>';
          
          fuzzyMatches.forEach(function(match, index) {
            html += '<div class="match-row">';
            html += '<div><span class="gs-name">GS: ' + escapeHtml(match.gsName) + '</span>';
            html += '<span class="grade-tag">Grade: ' + escapeHtml(match.gsGrade) + '</span></div>';
            html += '<div><span class="ia-name">IA: ' + escapeHtml(match.iaName) + '</span>';
            html += '<span class="grade-tag">Current: ' + (match.iaCurrentGrade || 'blank') + '</span>';
            html += ' <span class="info">(' + match.sim + '% match, Row ' + match.iaRow + ')</span></div>';
            html += '<select id="fuzzy_' + index + '" style="width: 100%; margin-top: 8px;">';
            html += '<option value="update" selected>Update to: ' + escapeHtml(match.gsGrade) + '</option>';
            html += '<option value="skip">Skip - Not same person</option>';
            html += '</select></div>';
          });
        }
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').innerHTML = html;
      }
      
      function submitValidation() {
        const decisions = [];
        
        fuzzyMatches.forEach(function(match, i) {
          const el = document.getElementById('fuzzy_' + i);
          if (el) {
            decisions.push({ 
              decision: el.value, 
              iaRow: match.iaRow, 
              grade: match.gsGrade 
            });
          }
        });
        
        document.getElementById('content').innerHTML = '<div id="loading">Applying grade updates...</div>';
        
        google.script.run
          .withSuccessHandler(function() {
            google.script.host.close();
          })
          .withFailureHandler(function(err) {
            alert('Error: ' + err);
          })
          .applyGradeMapDecisions(decisions);
      }
      
      loadData();
    </script>
  `)
    .setWidth(650)
    .setHeight(500)
    .setTitle('Map Grades to Initial Assessment');
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Map Grades from Grade Summary to Initial Assessment');
}

// ============== APPLY DECISIONS ==============
function applyGradeMapDecisions(decisions) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const iaSheet = ss.getSheetByName(GRADE_MAP_CONFIG.iaSheetName);
  
  const props = PropertiesService.getScriptProperties();
  const previousUpdates = parseInt(props.getProperty('gradeMap_updatedCount') || '0');
  const notFoundCount = parseInt(props.getProperty('gradeMap_notFoundCount') || '0');
  
  let updatedCount = 0;
  let skippedCount = 0;
  
  decisions.forEach(function(item) {
    if (item.decision === 'update') {
      iaSheet.getRange(item.iaRow, GRADE_MAP_CONFIG.gradeCol).setValue(item.grade);
      updatedCount++;
    } else {
      skippedCount++;
    }
  });
  
  // Clear stored properties
  props.deleteProperty('gradeMap_fuzzy');
  props.deleteProperty('gradeMap_updatedCount');
  props.deleteProperty('gradeMap_notFoundCount');
  
  SpreadsheetApp.getUi().alert(
    'Grade Mapping Complete',
    `• ${previousUpdates} grades updated (exact matches)\n• ${updatedCount} grades updated (fuzzy matches)\n• ${skippedCount} skipped\n• ${notFoundCount} students not found on IA`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

