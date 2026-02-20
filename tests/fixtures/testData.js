/**
 * testData.js — Sample data fixtures for unit tests.
 *
 * Provides realistic row data, LAYOUT objects, and configuration objects
 * that mirror what the GAS runtime would see in a deployed spreadsheet.
 */

// Default LAYOUT matching the gold-standard-template defaults
const DEFAULT_LAYOUT = {
  LESSON_COLUMN_OFFSET: 5,   // Lessons start after Name, Grade, Teacher, Group, (reserved)
  COL_FIRST_LESSON: 6,       // 1-based column number (col F)
  TOTAL_LESSONS: 128,
  DATA_START_ROW: 6,
  HEADER_ROW_COUNT: 5,
};

/**
 * Build a student row array.
 * Index 0–3: Name, Grade, Teacher, Group
 * Index 4:   reserved
 * Index 5+:  lesson statuses (lesson 1 at index 5, lesson 2 at 6, etc.)
 *
 * @param {Object} opts
 * @param {string} opts.name
 * @param {string} opts.grade
 * @param {string} opts.teacher
 * @param {string} opts.group
 * @param {Object<number,string>} opts.lessons – { lessonNum: 'Y'|'N'|'' }
 * @returns {Array}
 */
function buildStudentRow({ name = 'Test Student', grade = 'G1', teacher = 'Smith', group = 'Group 1', lessons = {} } = {}) {
  // Create a row long enough to hold all 128 lessons
  const row = new Array(DEFAULT_LAYOUT.LESSON_COLUMN_OFFSET + 128).fill('');
  row[0] = name;
  row[1] = grade;
  row[2] = teacher;
  row[3] = group;
  // row[4] is reserved / blank

  for (const [num, status] of Object.entries(lessons)) {
    const idx = DEFAULT_LAYOUT.LESSON_COLUMN_OFFSET + parseInt(num, 10) - 1;
    row[idx] = status;
  }
  return row;
}

/**
 * Build a Pre-K data row with Name/Sound/Form columns
 */
function buildPreKRow({ name = 'PreK Student', headers, values = {} } = {}) {
  const row = new Array(headers.length).fill('');
  row[0] = name;
  for (const [colIdx, val] of Object.entries(values)) {
    row[parseInt(colIdx, 10)] = val;
  }
  return row;
}

const PREK_HEADERS = [
  'Name', 'Grade', 'Teacher', 'Group',
  'A Name', 'B Name', 'C Name',   // 3 Name columns
  'A Sound', 'B Sound', 'C Sound', // 3 Sound columns
  'A Form', 'B Form', 'C Form',   // 3 Form columns
];

const PREK_CONFIG = {
  FORM_DENOMINATOR: 26,
  NAME_SOUND_DENOMINATOR: 52,
  FULL_DENOMINATOR: 78,
  HEADER_ROW: 1,
  DATA_START_ROW: 2,
};

module.exports = {
  DEFAULT_LAYOUT,
  buildStudentRow,
  buildPreKRow,
  PREK_HEADERS,
  PREK_CONFIG,
};
