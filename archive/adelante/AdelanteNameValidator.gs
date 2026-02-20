/**
 * SR vs Initial Assessment Name Validator
 * Compares names, allows validation of fuzzy matches, and syncs to SR as ground truth
 */

// ============== CONFIGURATION ==============
const VALIDATOR_CONFIG = {
  srSheetName: 'SR',
  iaSheetName: 'Initial Assessment',
  dataStartRow: 6,
  nameColumn: 1, // Column A
  fuzzyThreshold: 0.65
};

// Store exceptions globally for the dialog callback
let validatorExceptions = [];

// ============== MAIN COMPARISON FUNCTION ==============
function compareNamesForValidation() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const srSheet = ss.getSheetByName(VALIDATOR_CONFIG.srSheetName);
  const iaSheet = ss.getSheetByName(VALIDATOR_CONFIG.iaSheetName);
  
  if (!srSheet) {
    SpreadsheetApp.getUi().alert('Error: "SR" sheet not found.');
    return;
  }
  
  if (!iaSheet) {
    SpreadsheetApp.getUi().alert('Error: "Initial Assessment" sheet not found.');
    return;
  }
  
  // Get names from both sheets
  const srNames = getNamesFromSheetForValidator(srSheet);
  const iaNames = getNamesFromSheetForValidator(iaSheet);
  
  Logger.log(`SR: ${srNames.length} names`);
  Logger.log(`Initial Assessment: ${iaNames.length} names`);
  
  // Compare and find exceptions
  const { matched, fuzzyMatches, onlySR, onlyIA } = compareNamesForValidator(srNames, iaNames);
  
  Logger.log(`Exact matches: ${matched.length}`);
  Logger.log(`Fuzzy matches needing validation: ${fuzzyMatches.length}`);
  Logger.log(`Only on SR: ${onlySR.length}`);
  Logger.log(`Only on IA: ${onlyIA.length}`);
  
  // Store for later use
  const cache = CacheService.getScriptCache();
  cache.put('validatorFuzzyMatches', JSON.stringify(fuzzyMatches), 3600);
  cache.put('validatorOnlySR', JSON.stringify(onlySR), 3600);
  cache.put('validatorOnlyIA', JSON.stringify(onlyIA), 3600);
  
  if (fuzzyMatches.length === 0 && onlyIA.length === 0) {
    // No validation needed - just check if we need to append
    if (onlySR.length > 0) {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        'No Validation Needed',
        `All names match!\n\n${onlySR.length} name(s) are on SR but not on Initial Assessment.\n\nWould you like to append them now?`,
        ui.ButtonSet.YES_NO
      );
      
      if (response === ui.Button.YES) {
        appendMissingNames();
      }
    } else {
      SpreadsheetApp.getUi().alert('Perfect Match!', 'All names on SR match names on Initial Assessment.', SpreadsheetApp.getUi().ButtonSet.OK);
    }
    return;
  }
  
  // Show validation dialog
  showValidationDialog(fuzzyMatches, onlyIA);
}

// ============== GET NAMES FROM SHEET ==============
function getNamesFromSheetForValidator(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < VALIDATOR_CONFIG.dataStartRow) return [];
  
  const data = sheet.getRange(VALIDATOR_CONFIG.dataStartRow, VALIDATOR_CONFIG.nameColumn, lastRow - VALIDATOR_CONFIG.dataStartRow + 1, 1).getValues();
  const names = [];
  
  for (let i = 0; i < data.length; i++) {
    const name = data[i][0];
    if (name && String(name).trim() !== '') {
      names.push({
        original: String(name).trim(),
        normalized: normalizeNameForValidator(name),
        row: i + VALIDATOR_CONFIG.dataStartRow
      });
    }
  }
  
  return names;
}

// ============== NAME NORMALIZATION ==============
function normalizeNameForValidator(name) {
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

// ============== COMPARE NAMES ==============
function compareNamesForValidator(srNames, iaNames) {
  const matched = [];
  const fuzzyMatches = [];
  const onlySR = [];
  
  const iaNormalizedMap = new Map();
  iaNames.forEach(ia => iaNormalizedMap.set(ia.normalized, ia));
  
  const matchedIANormalized = new Set();
  
  srNames.forEach(sr => {
    // Exact match
    if (iaNormalizedMap.has(sr.normalized)) {
      matched.push({ sr: sr, ia: iaNormalizedMap.get(sr.normalized) });
      matchedIANormalized.add(sr.normalized);
      return;
    }
    
    // Fuzzy match
    let bestMatch = null;
    let bestSimilarity = 0;
    
    iaNames.forEach(ia => {
      if (matchedIANormalized.has(ia.normalized)) return;
      
      const similarity = calculateSimilarityForValidator(sr.normalized, ia.normalized);
      if (similarity >= VALIDATOR_CONFIG.fuzzyThreshold && similarity > bestSimilarity) {
        bestMatch = ia;
        bestSimilarity = similarity;
      }
    });
    
    if (bestMatch) {
      fuzzyMatches.push({
        sr: sr,
        ia: bestMatch,
        similarity: bestSimilarity
      });
      matchedIANormalized.add(bestMatch.normalized);
    } else {
      onlySR.push(sr);
    }
  });
  
  // Find IA names not matched
  const onlyIA = iaNames.filter(ia => !matchedIANormalized.has(ia.normalized));
  
  return { matched, fuzzyMatches, onlySR, onlyIA };
}

// ============== STRING SIMILARITY ==============
function calculateSimilarityForValidator(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistanceForValidator(longer, shorter);
  return (longer.length - distance) / longer.length;
}

function levenshteinDistanceForValidator(str1, str2) {
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

// ============== VALIDATION DIALOG ==============
function showValidationDialog(fuzzyMatches, onlyIA) {
  const html = HtmlService.createHtmlOutput(buildValidationHtml(fuzzyMatches, onlyIA))
    .setWidth(700)
    .setHeight(500)
    .setTitle('Name Validation');
  
  SpreadsheetApp.getUi().showModalDialog(html, 'Validate Name Matches');
}

function buildValidationHtml(fuzzyMatches, onlyIA) {
  let html = `
    <style>
      body { font-family: Arial, sans-serif; padding: 15px; }
      h3 { color: #1a73e8; margin-top: 20px; }
      .match-row { 
        background: #f8f9fa; 
        padding: 12px; 
        margin: 8px 0; 
        border-radius: 6px;
        border-left: 4px solid #fbbc04;
      }
      .only-ia-row {
        background: #fce8e6;
        padding: 12px;
        margin: 8px 0;
        border-radius: 6px;
        border-left: 4px solid #ea4335;
      }
      .sr-name { font-weight: bold; color: #1e8e3e; }
      .ia-name { color: #5f6368; }
      .similarity { color: #80868b; font-size: 12px; }
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
      .actions { margin-top: 20px; text-align: right; border-top: 1px solid #dadce0; padding-top: 15px; }
      .count { background: #e8f0fe; padding: 2px 8px; border-radius: 12px; font-size: 12px; }
    </style>
    
    <div id="content">
  `;
  
  // Fuzzy matches section
  if (fuzzyMatches.length > 0) {
    html += `<h3>Fuzzy Matches <span class="count">${fuzzyMatches.length}</span></h3>
             <p style="color:#5f6368; font-size:13px;">Select the correct name for each match. SR name (green) is ground truth.</p>`;
    
    fuzzyMatches.forEach((match, index) => {
      html += `
        <div class="match-row">
          <div>
            <span class="sr-name">SR: ${escapeHtml(match.sr.original)}</span>
            <span class="similarity">(Row ${match.sr.row})</span>
          </div>
          <div>
            <span class="ia-name">IA: ${escapeHtml(match.ia.original)}</span>
            <span class="similarity">(Row ${match.ia.row}, ${(match.similarity * 100).toFixed(0)}% match)</span>
          </div>
          <select id="fuzzy_${index}" style="width: 100%; margin-top: 8px;">
            <option value="sr" selected>Use SR: ${escapeHtml(match.sr.original)}</option>
            <option value="ia">Keep IA: ${escapeHtml(match.ia.original)}</option>
            <option value="skip">Skip - Not the same person</option>
          </select>
        </div>
      `;
    });
  }
  
  // Only on IA section (potential orphans)
  if (onlyIA.length > 0) {
    html += `<h3>Only on Initial Assessment <span class="count">${onlyIA.length}</span></h3>
             <p style="color:#5f6368; font-size:13px;">These names are on Initial Assessment but not found on SR. Select action:</p>`;
    
    onlyIA.forEach((ia, index) => {
      html += `
        <div class="only-ia-row">
          <div>
            <span class="ia-name">${escapeHtml(ia.original)}</span>
            <span class="similarity">(Row ${ia.row})</span>
          </div>
          <select id="onlyia_${index}" style="width: 100%; margin-top: 8px;">
            <option value="keep" selected>Keep as-is</option>
            <option value="delete">Delete from Initial Assessment</option>
          </select>
        </div>
      `;
    });
  }
  
  html += `
    </div>
    
    <div class="actions">
      <button class="btn btn-secondary" onclick="google.script.host.close()">Cancel</button>
      <button class="btn btn-primary" onclick="submitValidation()">Apply Changes</button>
    </div>
    
    <script>
      function submitValidation() {
        const fuzzyDecisions = [];
        const onlyIADecisions = [];
        
        // Collect fuzzy match decisions
        for (let i = 0; ; i++) {
          const el = document.getElementById('fuzzy_' + i);
          if (!el) break;
          fuzzyDecisions.push(el.value);
        }
        
        // Collect only-IA decisions
        for (let i = 0; ; i++) {
          const el = document.getElementById('onlyia_' + i);
          if (!el) break;
          onlyIADecisions.push(el.value);
        }
        
        google.script.run
          .withSuccessHandler(function() {
            google.script.host.close();
          })
          .withFailureHandler(function(err) {
            alert('Error: ' + err);
          })
          .applyValidationDecisions(fuzzyDecisions, onlyIADecisions);
      }
    </script>
  `;
  
  return html;
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============== APPLY VALIDATION DECISIONS ==============
function applyValidationDecisions(fuzzyDecisions, onlyIADecisions) {
  const cache = CacheService.getScriptCache();
  const fuzzyMatches = JSON.parse(cache.get('validatorFuzzyMatches') || '[]');
  const onlySR = JSON.parse(cache.get('validatorOnlySR') || '[]');
  const onlyIA = JSON.parse(cache.get('validatorOnlyIA') || '[]');
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const iaSheet = ss.getSheetByName(VALIDATOR_CONFIG.iaSheetName);
  
  let updatedCount = 0;
  let skippedCount = 0;
  let deletedCount = 0;
  
  // Track rows to delete (in reverse order to maintain row numbers)
  const rowsToDelete = [];
  
  // Apply fuzzy match decisions
  fuzzyDecisions.forEach((decision, index) => {
    const match = fuzzyMatches[index];
    if (!match) return;
    
    if (decision === 'sr') {
      // Update IA to match SR
      iaSheet.getRange(match.ia.row, VALIDATOR_CONFIG.nameColumn).setValue(match.sr.original);
      updatedCount++;
    } else if (decision === 'skip') {
      skippedCount++;
    }
    // 'ia' means keep as-is, do nothing
  });
  
  // Apply only-IA decisions
  onlyIADecisions.forEach((decision, index) => {
    const ia = onlyIA[index];
    if (!ia) return;
    
    if (decision === 'delete') {
      rowsToDelete.push(ia.row);
    }
  });
  
  // Delete rows in reverse order (so row numbers don't shift)
  rowsToDelete.sort((a, b) => b - a);
  rowsToDelete.forEach(row => {
    iaSheet.deleteRow(row);
    deletedCount++;
  });
  
  // Ask about appending missing names
  if (onlySR.length > 0) {
    const ui = SpreadsheetApp.getUi();
    const response = ui.alert(
      'Append Missing Names?',
      `Validation applied!\n\n• ${updatedCount} names updated\n• ${skippedCount} skipped (not same person)\n• ${deletedCount} deleted\n\n${onlySR.length} name(s) are on SR but not on Initial Assessment.\n\nWould you like to append them now?`,
      ui.ButtonSet.YES_NO
    );
    
    if (response === ui.Button.YES) {
      appendMissingNames();
    }
  } else {
    SpreadsheetApp.getUi().alert(
      'Validation Complete',
      `• ${updatedCount} names updated\n• ${skippedCount} skipped (not same person)\n• ${deletedCount} deleted`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

// ============== APPEND MISSING NAMES ==============
function appendMissingNames() {
  const cache = CacheService.getScriptCache();
  const onlySR = JSON.parse(cache.get('validatorOnlySR') || '[]');
  
  if (onlySR.length === 0) {
    SpreadsheetApp.getUi().alert('No names to append.');
    return;
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const iaSheet = ss.getSheetByName(VALIDATOR_CONFIG.iaSheetName);
  
  // Find next empty row
  const lastRow = iaSheet.getLastRow();
  let nextRow = lastRow + 1;
  
  // Append each name
  onlySR.forEach(sr => {
    iaSheet.getRange(nextRow, VALIDATOR_CONFIG.nameColumn).setValue(sr.original);
    nextRow++;
  });
  
  SpreadsheetApp.getUi().alert(
    'Names Appended',
    `${onlySR.length} name(s) from SR have been appended to Initial Assessment.`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
  
  // Clear cache
  cache.remove('validatorFuzzyMatches');
  cache.remove('validatorOnlySR');
  cache.remove('validatorOnlyIA');
}

