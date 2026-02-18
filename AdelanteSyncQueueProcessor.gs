// ═══════════════════════════════════════════════════════════════════════════
// UFLI MASTER SYSTEM - SYNC QUEUE PROCESSOR
// Deferred UFLI MAP updates for improved teacher experience
// ═══════════════════════════════════════════════════════════════════════════
// Version: 1.0
// Last Updated: January 2026
//
// PURPOSE:
// - Queue UFLI MAP updates instead of running them synchronously
// - Process queue every 30 minutes via time-based trigger
// - Batch updates for efficiency
// - Reduce teacher wait time from ~16s to ~3-4s
//
// ARCHITECTURE:
// 1. Teacher submits → Small Group Progress + Group Sheet (immediate)
// 2. UFLI MAP update → added to Sync Queue (instant)
// 3. Every 30 min → processSyncQueue() batch updates UFLI MAP
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const SYNC_QUEUE_CONFIG = {
  SHEET_NAME: "Sync Queue",
  TRIGGER_INTERVAL_MINUTES: 30,
  TRIGGER_FUNCTION: "processSyncQueue",
  COLUMNS: {
    TIMESTAMP: 1,
    GROUP_NAME: 2,
    LESSON_NAME: 3,
    LESSON_NUM: 4,
    STUDENT_DATA: 5,  // JSON string of [{name, status}, ...]
    PROCESSED: 6
  },
  HEADERS: ["Timestamp", "Group Name", "Lesson Name", "Lesson #", "Student Data (JSON)", "Processed"]
};

// ═══════════════════════════════════════════════════════════════════════════
// QUEUE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Adds a lesson update to the sync queue for deferred UFLI MAP processing
 * Called from saveLessonData() instead of direct UFLI MAP update
 *
 * @param {string} groupName - The group name
 * @param {string} lessonName - The lesson name (e.g., "UFLI L42")
 * @param {number} lessonNum - The extracted lesson number
 * @param {Array} studentStatuses - Array of {name, status} objects
 */
function addToSyncQueue(groupName, lessonName, lessonNum, studentStatuses) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const queueSheet = getOrCreateSyncQueueSheet(ss);

  const timestamp = new Date();
  const studentDataJson = JSON.stringify(studentStatuses);

  // Append single row - very fast operation
  queueSheet.appendRow([
    timestamp,
    groupName,
    lessonName,
    lessonNum,
    studentDataJson,
    ""  // Not processed yet
  ]);

  Logger.log(`[SyncQueue] Added: ${groupName} - ${lessonName} (${studentStatuses.length} students)`);
}

/**
 * Gets or creates the Sync Queue sheet
 * @param {Spreadsheet} ss - The active spreadsheet
 * @returns {Sheet} The Sync Queue sheet
 */
function getOrCreateSyncQueueSheet(ss) {
  let sheet = ss.getSheetByName(SYNC_QUEUE_CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SYNC_QUEUE_CONFIG.SHEET_NAME);

    // Set up headers
    const headers = SYNC_QUEUE_CONFIG.HEADERS;
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setFontWeight("bold")
      .setBackground("#4a86e8")
      .setFontColor("white");

    // Set column widths
    sheet.setColumnWidth(1, 150);  // Timestamp
    sheet.setColumnWidth(2, 150);  // Group Name
    sheet.setColumnWidth(3, 120);  // Lesson Name
    sheet.setColumnWidth(4, 80);   // Lesson #
    sheet.setColumnWidth(5, 400);  // Student Data JSON
    sheet.setColumnWidth(6, 100);  // Processed

    // Hide the sheet from teachers (optional - keeps UI clean)
    // sheet.hideSheet();

    Logger.log("[SyncQueue] Created Sync Queue sheet");
  }

  return sheet;
}

// ═══════════════════════════════════════════════════════════════════════════
// QUEUE PROCESSOR (Runs every 30 minutes)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Processes all pending entries in the Sync Queue
 * Updates UFLI MAP in batches for efficiency
 * Called by time-based trigger every 30 minutes
 */
function processSyncQueue() {
  const functionName = "processSyncQueue";
  const startTime = new Date();
  Logger.log(`[${functionName}] Starting queue processing...`);

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const queueSheet = ss.getSheetByName(SYNC_QUEUE_CONFIG.SHEET_NAME);

  if (!queueSheet) {
    Logger.log(`[${functionName}] No Sync Queue sheet found - nothing to process`);
    return;
  }

  const mapSheet = ss.getSheetByName("UFLI MAP");
  if (!mapSheet) {
    Logger.log(`[${functionName}] UFLI MAP sheet not found`);
    return;
  }

  // Read all queue data
  const lastRow = queueSheet.getLastRow();
  if (lastRow < 2) {
    Logger.log(`[${functionName}] Queue is empty`);
    return;
  }

  const queueData = queueSheet.getRange(2, 1, lastRow - 1, 6).getValues();

  // Filter to unprocessed entries
  const pendingEntries = [];
  const pendingRowIndices = [];

  for (let i = 0; i < queueData.length; i++) {
    const processed = queueData[i][SYNC_QUEUE_CONFIG.COLUMNS.PROCESSED - 1];
    if (!processed || processed === "") {
      pendingEntries.push(queueData[i]);
      pendingRowIndices.push(i + 2);  // +2 for 1-based index and header row
    }
  }

  if (pendingEntries.length === 0) {
    Logger.log(`[${functionName}] No pending entries to process`);
    return;
  }

  Logger.log(`[${functionName}] Processing ${pendingEntries.length} pending entries`);

  // ═══════════════════════════════════════════════════════════════
  // BATCH PROCESSING: Aggregate all student updates
  // ═══════════════════════════════════════════════════════════════

  // Map: studentName -> { lessonNum -> status, currentLesson: lessonLabel }
  // We take the LATEST entry for each student/lesson combo
  const studentUpdates = new Map();

  for (const entry of pendingEntries) {
    const lessonNum = entry[SYNC_QUEUE_CONFIG.COLUMNS.LESSON_NUM - 1];
    const lessonName = entry[SYNC_QUEUE_CONFIG.COLUMNS.LESSON_NAME - 1];
    const studentDataJson = entry[SYNC_QUEUE_CONFIG.COLUMNS.STUDENT_DATA - 1];

    let studentStatuses;
    try {
      studentStatuses = JSON.parse(studentDataJson);
    } catch (e) {
      Logger.log(`[${functionName}] Invalid JSON in queue entry: ${studentDataJson}`);
      continue;
    }

    for (const student of studentStatuses) {
      const upperName = student.name.toString().trim().toUpperCase();

      if (!studentUpdates.has(upperName)) {
        studentUpdates.set(upperName, { lessons: {}, currentLesson: null, currentLessonNum: 0 });
      }

      const record = studentUpdates.get(upperName);
      record.lessons[lessonNum] = student.status;

      // Track the highest lesson number as "current"
      if (lessonNum > record.currentLessonNum) {
        record.currentLessonNum = lessonNum;
        record.currentLesson = lessonName;
      }
    }
  }

  Logger.log(`[${functionName}] Aggregated updates for ${studentUpdates.size} unique students`);

  // ═══════════════════════════════════════════════════════════════
  // READ UFLI MAP DATA
  // ═══════════════════════════════════════════════════════════════

  const mapLastRow = mapSheet.getLastRow();
  if (mapLastRow < LAYOUT.DATA_START_ROW) {
    Logger.log(`[${functionName}] UFLI MAP has no data rows`);
    return;
  }

  const numRows = mapLastRow - LAYOUT.DATA_START_ROW + 1;

  // Read student names (Column A)
  const nameData = mapSheet.getRange(LAYOUT.DATA_START_ROW, 1, numRows, 1).getValues();

  // Build name -> row index map
  const nameToRowIndex = new Map();
  for (let i = 0; i < nameData.length; i++) {
    const name = nameData[i][0] ? nameData[i][0].toString().trim().toUpperCase() : "";
    if (name) {
      nameToRowIndex.set(name, i);
    }
  }

  // Determine which lesson columns we need to update
  const lessonColsToUpdate = new Set();
  for (const [, record] of studentUpdates) {
    for (const lessonNum of Object.keys(record.lessons)) {
      lessonColsToUpdate.add(parseInt(lessonNum));
    }
  }

  if (lessonColsToUpdate.size === 0) {
    Logger.log(`[${functionName}] No lesson columns to update`);
    markQueueEntriesProcessed(queueSheet, pendingRowIndices);
    return;
  }

  // ═══════════════════════════════════════════════════════════════
  // READ AND UPDATE LESSON COLUMNS
  // ═══════════════════════════════════════════════════════════════

  // Read current lesson column (Column E)
  const currentLessonRange = mapSheet.getRange(LAYOUT.DATA_START_ROW, LAYOUT.COL_CURRENT_LESSON, numRows, 1);
  const currentLessonValues = currentLessonRange.getValues();

  // Process each lesson column that needs updating
  const sortedLessonNums = Array.from(lessonColsToUpdate).sort((a, b) => a - b);

  for (const lessonNum of sortedLessonNums) {
    const colIdx = LAYOUT.COL_FIRST_LESSON + lessonNum - 1;
    const lessonRange = mapSheet.getRange(LAYOUT.DATA_START_ROW, colIdx, numRows, 1);
    const lessonValues = lessonRange.getValues();

    let updatesInColumn = 0;

    for (const [studentName, record] of studentUpdates) {
      if (!record.lessons[lessonNum]) continue;

      const rowIdx = nameToRowIndex.get(studentName);
      if (rowIdx === undefined) continue;

      lessonValues[rowIdx][0] = record.lessons[lessonNum];
      updatesInColumn++;
    }

    if (updatesInColumn > 0) {
      lessonRange.setValues(lessonValues);
      Logger.log(`[${functionName}] Updated L${lessonNum}: ${updatesInColumn} students`);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // UPDATE CURRENT LESSON COLUMN
  // ═══════════════════════════════════════════════════════════════

  let currentLessonUpdates = 0;
  for (const [studentName, record] of studentUpdates) {
    if (!record.currentLesson) continue;

    const rowIdx = nameToRowIndex.get(studentName);
    if (rowIdx === undefined) continue;

    currentLessonValues[rowIdx][0] = record.currentLesson;
    currentLessonUpdates++;
  }

  if (currentLessonUpdates > 0) {
    currentLessonRange.setValues(currentLessonValues);
    Logger.log(`[${functionName}] Updated current lesson for ${currentLessonUpdates} students`);
  }

  // ═══════════════════════════════════════════════════════════════
  // MARK QUEUE ENTRIES AS PROCESSED
  // ═══════════════════════════════════════════════════════════════

  markQueueEntriesProcessed(queueSheet, pendingRowIndices);

  // ═══════════════════════════════════════════════════════════════
  // CLEANUP: Remove old processed entries (older than 7 days)
  // ═══════════════════════════════════════════════════════════════

  cleanupOldQueueEntries(queueSheet);

  const elapsed = (new Date() - startTime) / 1000;
  Logger.log(`[${functionName}] Complete: ${pendingEntries.length} entries, ${studentUpdates.size} students, ${elapsed.toFixed(2)}s`);
}

/**
 * Marks queue entries as processed
 * @param {Sheet} queueSheet - The Sync Queue sheet
 * @param {Array} rowIndices - Array of row indices to mark
 */
function markQueueEntriesProcessed(queueSheet, rowIndices) {
  const processedTimestamp = new Date().toISOString();

  for (const rowIdx of rowIndices) {
    queueSheet.getRange(rowIdx, SYNC_QUEUE_CONFIG.COLUMNS.PROCESSED).setValue(processedTimestamp);
  }
}

/**
 * Removes processed queue entries older than 7 days
 * @param {Sheet} queueSheet - The Sync Queue sheet
 */
function cleanupOldQueueEntries(queueSheet) {
  const lastRow = queueSheet.getLastRow();
  if (lastRow < 2) return;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 7);

  const data = queueSheet.getRange(2, 1, lastRow - 1, 6).getValues();
  const rowsToDelete = [];

  for (let i = data.length - 1; i >= 0; i--) {
    const timestamp = data[i][0];
    const processed = data[i][SYNC_QUEUE_CONFIG.COLUMNS.PROCESSED - 1];

    if (processed && timestamp instanceof Date && timestamp < cutoffDate) {
      rowsToDelete.push(i + 2);  // +2 for 1-based and header
    }
  }

  // Delete from bottom to top to preserve row indices
  for (const rowIdx of rowsToDelete) {
    queueSheet.deleteRow(rowIdx);
  }

  if (rowsToDelete.length > 0) {
    Logger.log(`[SyncQueue] Cleaned up ${rowsToDelete.length} old entries`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRIGGER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sets up the 30-minute trigger for queue processing
 * Call this once from the menu or manually
 */
function setupSyncQueueTrigger() {
  // Remove any existing triggers for this function
  removeSyncQueueTrigger();

  // Create new trigger
  ScriptApp.newTrigger(SYNC_QUEUE_CONFIG.TRIGGER_FUNCTION)
    .timeBased()
    .everyMinutes(SYNC_QUEUE_CONFIG.TRIGGER_INTERVAL_MINUTES)
    .create();

  Logger.log(`[SyncQueue] Created ${SYNC_QUEUE_CONFIG.TRIGGER_INTERVAL_MINUTES}-minute trigger for ${SYNC_QUEUE_CONFIG.TRIGGER_FUNCTION}`);

  SpreadsheetApp.getUi().alert(
    'Sync Queue Trigger Enabled',
    `UFLI MAP will now update automatically every ${SYNC_QUEUE_CONFIG.TRIGGER_INTERVAL_MINUTES} minutes.\n\nTeachers will see faster save times (~3-4 seconds instead of ~16 seconds).`,
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Removes the sync queue trigger
 */
function removeSyncQueueTrigger() {
  const triggers = ScriptApp.getProjectTriggers();

  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === SYNC_QUEUE_CONFIG.TRIGGER_FUNCTION) {
      ScriptApp.deleteTrigger(trigger);
      Logger.log(`[SyncQueue] Removed existing trigger for ${SYNC_QUEUE_CONFIG.TRIGGER_FUNCTION}`);
    }
  }
}

/**
 * Disables the sync queue trigger
 * Call from menu to stop automatic processing
 */
function disableSyncQueueTrigger() {
  removeSyncQueueTrigger();

  SpreadsheetApp.getUi().alert(
    'Sync Queue Trigger Disabled',
    'Automatic UFLI MAP updates have been disabled.\n\nYou can manually run "Process Sync Queue Now" from the menu, or re-enable the trigger.',
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Checks if the sync queue trigger is active
 * @returns {Object} Status object with isActive and interval
 */
function getSyncQueueTriggerStatus() {
  const triggers = ScriptApp.getProjectTriggers();

  for (const trigger of triggers) {
    if (trigger.getHandlerFunction() === SYNC_QUEUE_CONFIG.TRIGGER_FUNCTION) {
      return {
        isActive: true,
        interval: SYNC_QUEUE_CONFIG.TRIGGER_INTERVAL_MINUTES,
        nextRun: "Within the next 30 minutes"
      };
    }
  }

  return { isActive: false };
}

/**
 * Shows the sync queue status to the user
 */
function showSyncQueueStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const queueSheet = ss.getSheetByName(SYNC_QUEUE_CONFIG.SHEET_NAME);
  const triggerStatus = getSyncQueueTriggerStatus();

  let pendingCount = 0;
  if (queueSheet) {
    const lastRow = queueSheet.getLastRow();
    if (lastRow > 1) {
      const processedCol = queueSheet.getRange(2, SYNC_QUEUE_CONFIG.COLUMNS.PROCESSED, lastRow - 1, 1).getValues();
      pendingCount = processedCol.filter(row => !row[0] || row[0] === "").length;
    }
  }

  const statusMessage = `
SYNC QUEUE STATUS
═══════════════════════════════════

Trigger: ${triggerStatus.isActive ? '✅ ACTIVE' : '❌ INACTIVE'}
Interval: Every ${SYNC_QUEUE_CONFIG.TRIGGER_INTERVAL_MINUTES} minutes
Pending Updates: ${pendingCount}

${triggerStatus.isActive ? 'UFLI MAP updates are being processed automatically.' : 'Enable the trigger to start automatic processing.'}
  `.trim();

  SpreadsheetApp.getUi().alert('Sync Queue Status', statusMessage, SpreadsheetApp.getUi().ButtonSet.OK);
}

/**
 * Manually triggers queue processing (for testing or on-demand)
 */
function processSyncQueueManual() {
  const ui = SpreadsheetApp.getUi();

  ui.alert('Processing Queue', 'Processing sync queue now. This may take a moment...', ui.ButtonSet.OK);

  processSyncQueue();

  ui.alert('Queue Processed', 'Sync queue has been processed. UFLI MAP is now up to date.', ui.ButtonSet.OK);
}
