function generateExceptionReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ================= CONFIGURATION =================
  const groupSheetNames = [
    "KG Groups", "G1 Groups", "G2 Groups", "G3 Groups", 
    "G4 Groups", "G5 Groups", "G6 to G8 Groups", "SC Classroom"
  ];
  
  // 1. Group Configuration (UPDATED NAME)
  const CONFIG_SHEET = "Group Configuration";
  const CONFIG_START_ROW = 8;
  const CONFIG_NAME_COL = 1;  // Col A
  const CONFIG_GRADE_COL = 2; // Col B
  const CONFIG_COUNT_COL = 4; // Col D

  // 2. School Summary
  const SCHOOL_SUM_SHEET = "School Summary";
  const SCHOOL_SUM_START_ROW = 143;
  const SCHOOL_SUM_NAME_COL = 1;  // Col A
  const SCHOOL_SUM_COUNT_COL = 3; // Col C
  
  // 3. Grade Summary
  const GRADE_SUM_SHEET = "Grade Summary"; 
  const GRADE_SUM_START_ROW = 6;
  const GRADE_SUM_STUDENT_COL = 1; // Col A
  const GRADE_SUM_GRADE_COL = 2;   // Col B
  const GRADE_SUM_GROUP_COL = 4;   // Col D

  const gradeOrder = ["KG", "G1", "G2", "G3", "G4", "G5", "G6 to G8 Groups", "SC Classroom"];
  // =================================================

  let exceptions = [];
  
  // --- MAPS ---
  let groupGradeMap = {};
  let configSheet = ss.getSheetByName(CONFIG_SHEET);
  if (configSheet) {
    let configData = configSheet.getDataRange().getValues();
    for (let i = CONFIG_START_ROW - 1; i < configData.length; i++) {
      let gName = String(configData[i][CONFIG_NAME_COL - 1]).trim();
      let gGrade = String(configData[i][CONFIG_GRADE_COL - 1]).trim();
      if (gName) groupGradeMap[gName] = gGrade;
    }
  }

  let studentGradeMap = {};
  let gradeSummaryMap = {};
  
  let gradeSheet = ss.getSheetByName(GRADE_SUM_SHEET);
  if (gradeSheet) {
    let gradeData = gradeSheet.getDataRange().getValues();
    for (let i = GRADE_SUM_START_ROW - 1; i < gradeData.length; i++) {
      let studentName = String(gradeData[i][GRADE_SUM_STUDENT_COL - 1]).trim();
      let studentGrade = String(gradeData[i][GRADE_SUM_GRADE_COL - 1]).trim();
      let groupName = String(gradeData[i][GRADE_SUM_GROUP_COL - 1]).trim();
      
      if (studentName) {
        studentGradeMap[studentName] = studentGrade;
        if (groupName) {
          if (!gradeSummaryMap[groupName]) gradeSummaryMap[groupName] = [];
          gradeSummaryMap[groupName].push(studentName);
        }
      }
    }
  }

  // --- MAP ACTUAL STUDENTS ---
  let groupSheetMap = {}; 
  groupSheetNames.forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) return; 
    let data = sheet.getDataRange().getValues();
    let currentGroup = "";
    
    for (let i = 0; i < data.length; i++) {
      let cellVal = String(data[i][0]).trim(); 
      if (cellVal.toLowerCase().includes("group") && cellVal.length < 80) {
        currentGroup = cellVal;
        if (!groupSheetMap[currentGroup]) groupSheetMap[currentGroup] = [];
      } else if (currentGroup !== "" && cellVal !== "" && cellVal !== "Student Name") {
        groupSheetMap[currentGroup].push(cellVal);
      }
    }
  });

  // --- CHECKS ---
  // A. VS CONFIG
  if(configSheet) {
    let configData = configSheet.getDataRange().getValues();
    for (let i = CONFIG_START_ROW - 1; i < configData.length; i++) {
      let groupName = String(configData[i][CONFIG_NAME_COL - 1]).trim();
      let expected = configData[i][CONFIG_COUNT_COL - 1];
      let grade = groupGradeMap[groupName] || "Unknown"; 
      
      if (!groupName || typeof expected !== 'number') continue;
      
      let actualList = groupSheetMap[groupName];
      let actualCount = actualList ? actualList.length : 0;
      
      if (!actualList) {
         if(expected > 0) exceptions.push([grade, groupName, "vs. Config", 0, expected, "MISSING GROUP", "Group not found in Group Sheets"]);
      } else if (actualCount !== expected) {
        exceptions.push([grade, groupName, "vs. Config", actualCount, expected, "Count Mismatch", `Config says ${expected}, found ${actualCount}`]);
      }
    }
  }

  // B. VS SCHOOL SUMMARY
  let schoolSheet = ss.getSheetByName(SCHOOL_SUM_SHEET);
  if (schoolSheet) {
    let schoolData = schoolSheet.getDataRange().getValues();
    for (let i = SCHOOL_SUM_START_ROW - 1; i < schoolData.length; i++) {
      let groupName = String(schoolData[i][SCHOOL_SUM_NAME_COL - 1]).trim();
      let expected = schoolData[i][SCHOOL_SUM_COUNT_COL - 1];
      let grade = groupGradeMap[groupName] || "Unknown";
      
      if (!groupName || typeof expected !== 'number') continue;
      let actualList = groupSheetMap[groupName];
      let actualCount = actualList ? actualList.length : 0;
      
      if (actualList && actualCount !== expected) {
         exceptions.push([grade, groupName, "vs. School Summary", actualCount, expected, "Count Mismatch", `Summary says ${expected}, found ${actualCount}`]);
      }
    }
  }

  // C. VS GRADE SUMMARY (Student Level)
  for (let groupName in gradeSummaryMap) {
    let summaryStudents = gradeSummaryMap[groupName];
    let sheetStudents = groupSheetMap[groupName] || [];

    summaryStudents.forEach(student => {
      if (!sheetStudents.includes(student)) {
        let grade = studentGradeMap[student] || groupGradeMap[groupName] || "Unknown";
        exceptions.push([grade, groupName, "Student Missing", sheetStudents.length, summaryStudents.length, student, "In Grade Summary but NOT on Group Sheet"]);
      }
    });

    sheetStudents.forEach(student => {
      if (!gradeSummaryMap[groupName] || !gradeSummaryMap[groupName].includes(student)) {
        let grade = studentGradeMap[student] || groupGradeMap[groupName] || "Unknown";
        exceptions.push([grade, groupName, "Extra Student", sheetStudents.length, summaryStudents ? summaryStudents.length : 0, student, "On Group Sheet but NOT in Grade Summary for this group"]);
      }
    });
  }

  // --- REPORT ---
  let reportSheet = ss.getSheetByName("Exception Report");
  if (!reportSheet) { reportSheet = ss.insertSheet("Exception Report"); } else { reportSheet.clear(); }
  
  let header = ["Grade", "Group Name", "Issue Type", "Sheet Count", "Target Count", "Student Name / Diff", "Details"];
  reportSheet.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight("bold").setBackground("#4a86e8").setFontColor("white");

  if (exceptions.length > 0) {
    exceptions.sort((a, b) => {
      let gradeA = gradeOrder.indexOf(a[0]); let gradeB = gradeOrder.indexOf(b[0]);
      if (gradeA === -1) gradeA = 99; if (gradeB === -1) gradeB = 99;
      if (gradeA !== gradeB) return gradeA - gradeB;
      return a[1].localeCompare(b[1]);
    });
    reportSheet.getRange(2, 1, exceptions.length, header.length).setValues(exceptions);
    reportSheet.autoResizeColumns(1, header.length);
  } else {
    reportSheet.getRange("A2").setValue("Success! No discrepancies found.");
  }
}
function updateGroupConfigurationCounts() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ================= CONFIGURATION =================
  const groupSheetNames = [
    "KG Groups", "G1 Groups", "G2 Groups", "G3 Groups", 
    "G4 Groups", "G5 Groups", "G6 Groups", "G7 Groups", "G8 Groups"
  ];
  
  // UPDATED NAME HERE:
  const CONFIG_SHEET = "Group Configuration";
  const CONFIG_START_ROW = 8;
  const CONFIG_NAME_COL = 1;  // Col A
  const CONFIG_COUNT_COL = 4; // Col D
  // =================================================

  // --- COUNT ACTUAL STUDENTS ---
  let actualCounts = {};
  
  groupSheetNames.forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) return; 
    let data = sheet.getDataRange().getValues();
    let currentGroup = "";
    let count = 0;
    
    for (let i = 0; i < data.length; i++) {
      let cellVal = String(data[i][0]).trim(); 
      if (cellVal.toLowerCase().includes("group") && cellVal.length < 80) {
        if (currentGroup !== "") actualCounts[currentGroup] = count;
        currentGroup = cellVal;
        count = 0; 
      } else if (currentGroup !== "" && cellVal !== "" && cellVal !== "Student Name") {
        count++;
      }
    }
    if (currentGroup !== "") actualCounts[currentGroup] = count;
  });

  // --- UPDATE CONFIG SHEET ---
  let configSheet = ss.getSheetByName(CONFIG_SHEET);
  if (!configSheet) {
    SpreadsheetApp.getUi().alert("Error: Sheet 'Group Configuration' not found!");
    return;
  }

  let lastRow = configSheet.getLastRow();
  let numRows = lastRow - CONFIG_START_ROW + 1;
  if (numRows < 1) return;

  let range = configSheet.getRange(CONFIG_START_ROW, 1, numRows, CONFIG_COUNT_COL);
  let configData = range.getValues();
  let updatesMade = 0;

  for (let i = 0; i < configData.length; i++) {
    let groupName = String(configData[i][CONFIG_NAME_COL - 1]).trim();
    if (groupName && actualCounts.hasOwnProperty(groupName)) {
      let newCount = actualCounts[groupName];
      if (configData[i][CONFIG_COUNT_COL - 1] !== newCount) {
        configData[i][CONFIG_COUNT_COL - 1] = newCount; 
        updatesMade++;
      }
    }
  }

  if (updatesMade > 0) {
    range.setValues(configData);
    SpreadsheetApp.getUi().alert(`Success! Updated ${updatesMade} groups in 'Group Configuration'.`);
  } else {
    SpreadsheetApp.getUi().alert("All counts are already up to date.");
  }
}
function highlightDuplicates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // ================= CONFIGURATION =================
  const groupSheetNames = [
    "KG Groups", "G1 Groups", "G2 Groups", "G3 Groups", 
    "G4 Groups", "G5 Groups", "G6 Groups", "G7 Groups", "G8 Groups"
  ];
  
  const HIGHLIGHT_COLOR = "#ffff00"; // Yellow
  // =================================================

  // Store location of every student: { "John Doe": [ {sheet: "KG Groups", row: 5, col: 1}, ... ] }
  let studentLocations = {};
  
  // --- STEP 1: SCAN ALL SHEETS AND MAP STUDENTS ---
  groupSheetNames.forEach(sheetName => {
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) return;
    
    // Clear previous highlights first (optional, but keeps things clean)
    // We assume names are in Column A (index 1)
    let lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      sheet.getRange(1, 1, lastRow, 1).setBackground(null); 
    }

    let data = sheet.getDataRange().getValues();
    
    for (let i = 0; i < data.length; i++) {
      let cellVal = String(data[i][0]).trim(); // Column A
      
      // Skip headers ("Group..."), labels ("Student Name"), and blanks
      if (cellVal !== "" && 
          !cellVal.toLowerCase().includes("group") && 
          cellVal !== "Student Name" && 
          !cellVal.toLowerCase().includes("lesson")) {
        
        // If this student isn't in our list yet, add them
        if (!studentLocations[cellVal]) {
          studentLocations[cellVal] = [];
        }
        
        // Record the location
        studentLocations[cellVal].push({
          sheetName: sheetName,
          rowIndex: i + 1, // 1-based index for getRange
          colIndex: 1
        });
      }
    }
  });

  // --- STEP 2: HIGHLIGHT DUPLICATES ---
  let duplicateCount = 0;

  for (let studentName in studentLocations) {
    let locations = studentLocations[studentName];
    
    // If the student appears in more than 1 location...
    if (locations.length > 1) {
      duplicateCount++;
      
      // Loop through all the places this student was found
      locations.forEach(loc => {
        let sheet = ss.getSheetByName(loc.sheetName);
        // Highlight the cell yellow
        sheet.getRange(loc.rowIndex, loc.colIndex).setBackground(HIGHLIGHT_COLOR);
      });
    }
  }

  // --- STEP 3: REPORT ---
  if (duplicateCount > 0) {
    SpreadsheetApp.getUi().alert(`Found and highlighted ${duplicateCount} students who appear more than once.`);
  } else {
    SpreadsheetApp.getUi().alert("Clean sweep! No duplicate students found.");
  }
}
