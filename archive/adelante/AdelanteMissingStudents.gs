/**
 * Highlights student names in group sheets (Column A) that do NOT exist
 * in "Initial Assessment" (Column A, starting at row 6),
 * AND creates an "Exception Report" sheet that includes Student Grade.
 *
 * Assumptions:
 * - Initial Assessment:
 *    - Names start at row 6, column A
 *    - Grade is in column B (same row as name)
 * - Group sheets:
 *    - Student names are in column A, but sub-headers appear throughout
 * - Group sheet names: "KG Groups", "G1 Groups", ..., "G8 Groups"
 */
function highlightAndCreateExceptionReport() {
  const ui = SpreadsheetApp.getUi();

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    const initialSheetName = "Initial Assessment";
    const groupSheetNames = [
      "KG Groups", "G1 Groups", "G2 Groups", "G3 Groups",
      "G4 Groups", "G5 Groups", "G6 Groups", "G7 Groups", "G8 Groups"
    ];

    const INITIAL_START_ROW = 6; // Initial Assessment data begins on row 6
    const NAME_COL = 1;          // Column A
    const GRADE_COL = 2;         // Column B (Initial Assessment grade)
    const missingColor = "#fff2cc";
    const reportSheetName = "Exception Report";

    const initialSheet = ss.getSheetByName(initialSheetName);
    if (!initialSheet) {
      ui.alert('Error', `Sheet not found: "${initialSheetName}". Please run the Setup Wizard first.`, ui.ButtonSet.OK);
      return;
    }

  // --- Build Initial Assessment map: normalizedName -> {displayName, grade} ---
  const initialLastRow = initialSheet.getLastRow();
  const initialNumRows = Math.max(0, initialLastRow - INITIAL_START_ROW + 1);

  /** @type {Map<string, {displayName:string, grade:string}>} */
  const initialMap = new Map();

  if (initialNumRows > 0) {
    const initialRange = initialSheet.getRange(INITIAL_START_ROW, NAME_COL, initialNumRows, 2); // A:B
    const initialValues = initialRange.getValues();

    for (const row of initialValues) {
      const displayName = (row[0] ?? "").toString().trim();
      const norm = normalizeName_(displayName);
      if (!norm) continue;

      const gradeRaw = (row[1] ?? "").toString().trim();
      const grade = gradeRaw || "Unknown";

      // If duplicates exist, keep the first occurrence (you can change this if you want)
      if (!initialMap.has(norm)) {
        initialMap.set(norm, { displayName, grade });
      }
    }
  }

  // We'll also build a Set of *all* student names found across group sheets (for reverse check)
  const groupNameSet = new Set();

  // Exceptions to report
  const exceptions = []; // rows: [IssueType, StudentName, Grade, SourceSheet]

  // --- Process each group sheet: highlight missing + collect names ---
  groupSheetNames.forEach(sheetName => {
    const sh = ss.getSheetByName(sheetName);
    if (!sh) return;

    const lastRow = sh.getLastRow();
    if (lastRow < 1) return;

    const rangeA = sh.getRange(1, NAME_COL, lastRow, 1);
    const values = rangeA.getValues().flat();
    const backgrounds = rangeA.getBackgrounds();

    const inferredGrade = inferGradeFromGroupSheetName_(sheetName);

    for (let i = 0; i < values.length; i++) {
      const raw = values[i];

      // Skip blanks/sub-headers
      if (shouldSkipGroupColumnAValue_(raw)) continue;

      const displayName = (raw ?? "").toString().trim();
      const norm = normalizeName_(displayName);
      if (!norm) continue;

      // record student appears in some group sheet
      groupNameSet.add(norm);

      const existsOnInitial = initialMap.has(norm);

      // highlight logic (only manage our highlight color)
      const currentBg = (backgrounds[i] && backgrounds[i][0]) ? backgrounds[i][0] : "";
      if (!existsOnInitial) {
        backgrounds[i][0] = missingColor;

        // Add to exceptions report: on group sheet but missing from Initial
        exceptions.push([
          "On Group Sheet, missing from Initial Assessment",
          displayName,
          inferredGrade,
          sheetName
        ]);
      } else if (sameColor_(currentBg, missingColor)) {
        backgrounds[i][0] = null; // clear only our prior highlight
      }
    }

    rangeA.setBackgrounds(backgrounds);
  });

  // --- Reverse check: names on Initial Assessment but not found on ANY group sheet ---
  for (const [norm, info] of initialMap.entries()) {
    if (!groupNameSet.has(norm)) {
      exceptions.push([
        "On Initial Assessment, missing from ALL Group Sheets",
        info.displayName,
        info.grade,
        initialSheetName
      ]);
    }
  }

  // --- Write Exception Report sheet ---
  let reportSheet = ss.getSheetByName(reportSheetName);
  if (!reportSheet) reportSheet = ss.insertSheet(reportSheetName);
  reportSheet.clear();

  const now = new Date();
  reportSheet.getRange(1, 1).setValue("Exception Report");
  reportSheet.getRange(2, 1).setValue("Generated:");
  reportSheet.getRange(2, 2).setValue(now);

  const header = ["Issue Type", "Student Name", "Grade", "Source Sheet"];
  reportSheet.getRange(4, 1, 1, header.length).setValues([header]).setFontWeight("bold");

  if (exceptions.length > 0) {
    // Optional: sort for readability
    exceptions.sort((a, b) => {
      // sort by Issue Type, then Grade, then Name
      const keyA = `${a[0]}|${a[2]}|${a[1]}`.toLowerCase();
      const keyB = `${b[0]}|${b[2]}|${b[1]}`.toLowerCase();
      return keyA.localeCompare(keyB);
    });

    reportSheet.getRange(5, 1, exceptions.length, 4).setValues(exceptions);
  } else {
    reportSheet.getRange(5, 1).setValue("No exceptions found ✅");
  }

  reportSheet.autoResizeColumns(1, 4);

  } catch (error) {
    Logger.log('highlightAndCreateExceptionReport Error: ' + error.toString());
    ui.alert('Error', 'An error occurred while generating the exception report:\n\n' + error.message, ui.ButtonSet.OK);
  }
}

/** Skip sub-headers / non-name rows on Group sheets (Column A). */
function shouldSkipGroupColumnAValue_(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === "number" || typeof value === "boolean") return true;

  const s = String(value).trim();
  if (!s) return true;

  const n = s.toLowerCase().replace(/\s+/g, " ");

  if (n === "student name") return true;
  if (n.includes("group")) return true; // e.g., "KG Group 1 - Garcia"
  if (n.includes("instructional sequence")) return true;
  if (n.includes("date taught")) return true;
  if (n.startsWith("lesson")) return true;

  return false;
}

/** Normalize names for matching (case/spacing). */
function normalizeName_(value) {
  if (value === null || value === undefined) return "";
  const s = String(value).trim();
  if (!s) return "";
  return s.replace(/\s+/g, " ").toLowerCase();
}

/** Compare two hex color strings. */
function sameColor_(a, b) {
  if (!a || !b) return false;
  return String(a).toLowerCase() === String(b).toLowerCase();
}

/** Infer grade label from sheet name like "KG Groups", "G1 Groups", etc. */
function inferGradeFromGroupSheetName_(sheetName) {
  const s = (sheetName || "").toUpperCase();
  if (s.includes("KG")) return "KG";
  const m = s.match(/\bG([1-8])\b/);
  if (m) return `G${m[1]}`;
  return "Unknown";
}
