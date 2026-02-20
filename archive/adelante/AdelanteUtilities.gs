/**
 * UTILITY: Syncs Group Names from Grade Level Sheets to Summary Sheets
 * * SOURCE (Read-Only):
 * - KG Groups, G1 Groups, G2 Groups, ... G8 Groups
 * * TARGETS (Updates Column D):
 * - Grade Summary
 * - UFLI MAP
 * - Initial Assessment
 */
function syncGroupNamesFromSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ui = SpreadsheetApp.getUi();
  
  // 1. CONFIGURATION
  const sourceSheetNames = [
    'PreK Groups', 'KG Groups', 
    'G1 Groups', 'G2 Groups', 'G3 Groups', 'G4 Groups', 
    'G5 Groups', 'G6 Groups', 'G7 Groups', 'G8 Groups', 'SC Classroom', 'G6 to G8 Groups'
  ];
  
  const targetSheetNames = [
    'Grade Summary',
    'UFLI MAP',
    'Initial Assessment'
  ];

  // 2. BUILD STUDENT-TO-GROUP MAP
  // Scans all Grade Group sheets to find which group each student belongs to.
  const studentGroupMap = new Map(); // Key: Student Name (UPPER), Value: Group Name
  let studentsFound = 0;

  Logger.log('Scanning Grade Group sheets...');

  sourceSheetNames.forEach(sheetName => {
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;

    const data = sheet.getDataRange().getValues();
    let currentGroupName = "";

    for (let i = 0; i < data.length; i++) {
      const cellA = data[i][0] ? data[i][0].toString().trim() : "";

      // DETECT GROUP HEADER
      // Logic: Cell contains "Group" but is NOT the "Student Name" header
      if (cellA.includes("Group") && !cellA.includes("Student")) {
        currentGroupName = cellA;
        continue;
      }

      // IGNORE HEADERS & SPACERS
      if (!cellA || cellA === "Student Name" || cellA === "Instructional Sequence" || cellA === "(No students assigned)") {
        continue;
      }

      // CAPTURE STUDENT
      // If we have a current group and a valid name in Col A, map it.
      if (currentGroupName) {
        // Store as uppercase for case-insensitive matching
        studentGroupMap.set(cellA.toUpperCase(), currentGroupName);
        studentsFound++;
      }
    }
  });

  Logger.log(`Mapping complete. Found ${studentsFound} students across all groups.`);

  // 3. UPDATE TARGET SHEETS
  // Writes the found Group Name into Column D for each student.
  let totalUpdates = 0;

  targetSheetNames.forEach(targetName => {
    const sheet = ss.getSheetByName(targetName);
    if (!sheet) {
      Logger.log(`Target sheet not found: ${targetName}`);
      return;
    }

    // Read all data (Col A = Student, Col D = Group)
    // We read 4 columns to get both Name (index 0) and Group (index 3)
    const lastRow = sheet.getLastRow();
    if (lastRow < 6) return; // Skip if empty or just headers

    // Assuming data starts at Row 6 (based on your system standards)
    // Adjust '6' if your data starts earlier, but your previous files say Row 6.
    const startRow = 6; 
    const numRows = lastRow - startRow + 1;
    
    // Get Range: Row 6, Col 1 (A), to LastRow, Col 4 (D)
    const range = sheet.getRange(startRow, 1, numRows, 4);
    const values = range.getValues();
    let sheetUpdates = 0;

    for (let i = 0; i < values.length; i++) {
      const studentName = values[i][0] ? values[i][0].toString().trim() : "";
      
      if (studentName) {
        const key = studentName.toUpperCase();
        
        if (studentGroupMap.has(key)) {
          const correctGroup = studentGroupMap.get(key);
          const currentGroupInSheet = values[i][3] ? values[i][3].toString().trim() : "";

          // Only update if different to save processing time
          if (currentGroupInSheet !== correctGroup) {
             values[i][3] = correctGroup; // Update Column D (Index 3)
             sheetUpdates++;
          }
        }
      }
    }

    // Write back ONLY if changes were made
    if (sheetUpdates > 0) {
      range.setValues(values);
      totalUpdates += sheetUpdates;
      Logger.log(`Updated ${sheetUpdates} rows in ${targetName}`);
    } else {
      Logger.log(`No changes needed for ${targetName}`);
    }
  });

  // 4. REPORT RESULTS
  const message = `Sync Complete.\n\nScanned: ${studentsFound} students in groups.\nUpdated: ${totalUpdates} rows across ${targetSheetNames.length} sheets.`;
  Logger.log(message);
  ui.alert("Group Name Sync", message, ui.ButtonSet.OK);
}
