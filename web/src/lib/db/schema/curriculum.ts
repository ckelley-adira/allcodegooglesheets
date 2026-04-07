/**
 * @file curriculum.ts — Curriculum & Assessment domain tables
 *
 * Covers the 128-lesson UFLI sequence, lesson progress tracking, assessments,
 * sound inventory, and tutoring sessions.
 *
 * @see /Relational_Database_Model.html Section 3 — "CURRICULUM & ASSESSMENT"
 */

import {
  pgTable,
  serial,
  bigserial,
  varchar,
  text,
  boolean,
  timestamp,
  integer,
  date,
  smallint,
  numeric,
  unique,
  bigint,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  lessonStatusEnum,
  dataSourceEnum,
  sessionTypeEnum,
  sequenceStatusEnum,
  sequenceLessonStatusEnum,
  assessmentSnapshotTypeEnum,
} from "./enums";
import { students, instructionalGroups, academicYears, staff } from "./core";

// ---------------------------------------------------------------------------
// ufli_lessons — the 128-lesson reference table (seeded, not user-editable)
// Per D-016, this is seeded from day one as reference data.
// ---------------------------------------------------------------------------

export const ufliLessons = pgTable("ufli_lessons", {
  lessonId: serial("lesson_id").primaryKey(),
  lessonNumber: smallint("lesson_number").notNull().unique(),
  lessonName: varchar("lesson_name", { length: 150 }),
  skillSection: varchar("skill_section", { length: 50 }).notNull(),
  sortOrder: smallint("sort_order").notNull(),
  isReview: boolean("is_review").notNull().default(false),
});

// ---------------------------------------------------------------------------
// lesson_progress — the largest table; every student×lesson outcome
// Per D-012, status 'A' (absent) is excluded from slope, never zeroed.
// ---------------------------------------------------------------------------

export const lessonProgress = pgTable(
  "lesson_progress",
  {
    progressId: bigserial("progress_id", { mode: "number" }).primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.studentId),
    groupId: integer("group_id")
      .notNull()
      .references(() => instructionalGroups.groupId),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => ufliLessons.lessonId),
    yearId: integer("year_id")
      .notNull()
      .references(() => academicYears.yearId),
    status: lessonStatusEnum("status").notNull(),
    dateRecorded: date("date_recorded").notNull(),
    recordedBy: integer("recorded_by").references(() => staff.staffId),
    source: dataSourceEnum("source").notNull().default("form"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.studentId, t.lessonId, t.yearId, t.dateRecorded)],
);

export const lessonProgressRelations = relations(lessonProgress, ({ one }) => ({
  student: one(students, {
    fields: [lessonProgress.studentId],
    references: [students.studentId],
  }),
  group: one(instructionalGroups, {
    fields: [lessonProgress.groupId],
    references: [instructionalGroups.groupId],
  }),
  lesson: one(ufliLessons, {
    fields: [lessonProgress.lessonId],
    references: [ufliLessons.lessonId],
  }),
  academicYear: one(academicYears, {
    fields: [lessonProgress.yearId],
    references: [academicYears.yearId],
  }),
  recorder: one(staff, {
    fields: [lessonProgress.recordedBy],
    references: [staff.staffId],
  }),
}));

// ---------------------------------------------------------------------------
// assessment_sequences — defines the skill sequences per grade band
// ---------------------------------------------------------------------------

export const assessmentSequences = pgTable(
  "assessment_sequences",
  {
    sequenceId: serial("sequence_id").primaryKey(),
    gradeBand: varchar("grade_band", { length: 10 }).notNull(),
    version: varchar("version", { length: 10 }).notNull(),
    sequenceNumber: smallint("sequence_number").notNull(),
    lessonRangeStart: smallint("lesson_range_start").notNull(),
    lessonRangeEnd: smallint("lesson_range_end").notNull(),
  },
  (t) => [unique().on(t.gradeBand, t.version, t.sequenceNumber)],
);

// ---------------------------------------------------------------------------
// assessment_results — per-student, per-sequence outcomes
// ---------------------------------------------------------------------------

export const assessmentResults = pgTable(
  "assessment_results",
  {
    resultId: bigserial("result_id", { mode: "number" }).primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.studentId),
    sequenceId: integer("sequence_id")
      .notNull()
      .references(() => assessmentSequences.sequenceId),
    yearId: integer("year_id")
      .notNull()
      .references(() => academicYears.yearId),
    score: numeric("score", { precision: 5, scale: 2 }),
    passed: boolean("passed").notNull(),
    dateAssessed: date("date_assessed").notNull(),
    assessedBy: integer("assessed_by").references(() => staff.staffId),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.studentId, t.sequenceId, t.yearId, t.dateAssessed)],
);

// ---------------------------------------------------------------------------
// sounds_catalog — reference table of phonemes (CHAW K-1 specific, O-003)
// ---------------------------------------------------------------------------

export const soundsCatalog = pgTable("sounds_catalog", {
  soundId: serial("sound_id").primaryKey(),
  sound: varchar("sound", { length: 20 }).notNull().unique(),
  category: varchar("category", { length: 50 }),
  sortOrder: smallint("sort_order").notNull(),
});

// ---------------------------------------------------------------------------
// sound_inventory — per-student phoneme mastery records
// ---------------------------------------------------------------------------

export const soundInventory = pgTable(
  "sound_inventory",
  {
    inventoryId: bigserial("inventory_id", { mode: "number" }).primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.studentId),
    soundId: integer("sound_id")
      .notNull()
      .references(() => soundsCatalog.soundId),
    yearId: integer("year_id")
      .notNull()
      .references(() => academicYears.yearId),
    mastered: boolean("mastered").notNull().default(false),
    dateAssessed: date("date_assessed").notNull(),
    assessedBy: integer("assessed_by").references(() => staff.staffId),
  },
  (t) => [unique().on(t.studentId, t.soundId, t.yearId)],
);

// ---------------------------------------------------------------------------
// tutoring_sessions — individual tutoring session logs
// ---------------------------------------------------------------------------

export const tutoringSessions = pgTable("tutoring_sessions", {
  sessionId: bigserial("session_id", { mode: "number" }).primaryKey(),
  studentId: integer("student_id")
    .notNull()
    .references(() => students.studentId),
  yearId: integer("year_id")
    .notNull()
    .references(() => academicYears.yearId),
  tutorId: integer("tutor_id")
    .notNull()
    .references(() => staff.staffId),
  sessionType: sessionTypeEnum("session_type").notNull(),
  lessonId: integer("lesson_id").references(() => ufliLessons.lessonId),
  sessionDate: date("session_date").notNull(),
  durationMin: smallint("duration_min"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});


// ---------------------------------------------------------------------------
// instructional_sequences — per-group ordered lesson plans
// ---------------------------------------------------------------------------
// A group has multiple sequences across a school year, one active at a time.
// The active sequence holds the current lesson pointer (via the 'current'
// status on exactly one sequence_lesson row), which the Tutor Input Form
// pre-selects so tutors don't have to hunt through all 128 lessons.

export const instructionalSequences = pgTable("instructional_sequences", {
  sequenceId: serial("sequence_id").primaryKey(),
  groupId: integer("group_id")
    .notNull()
    .references(() => instructionalGroups.groupId, { onDelete: "cascade" }),
  yearId: integer("year_id")
    .notNull()
    .references(() => academicYears.yearId),
  name: varchar("name", { length: 100 }).notNull(),
  startDate: date("start_date"),
  endDate: date("end_date"),
  status: sequenceStatusEnum("status").notNull().default("active"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const instructionalSequencesRelations = relations(
  instructionalSequences,
  ({ one, many }) => ({
    group: one(instructionalGroups, {
      fields: [instructionalSequences.groupId],
      references: [instructionalGroups.groupId],
    }),
    academicYear: one(academicYears, {
      fields: [instructionalSequences.yearId],
      references: [academicYears.yearId],
    }),
    lessons: many(instructionalSequenceLessons),
  }),
);

// ---------------------------------------------------------------------------
// instructional_sequence_lessons — ordered lessons within a sequence
// ---------------------------------------------------------------------------
// Exactly one lesson per active sequence has status='current' (enforced by
// a partial unique index in SQL). Advancement flips the current lesson to
// 'completed' and promotes the next 'upcoming' lesson to 'current'.

export const instructionalSequenceLessons = pgTable(
  "instructional_sequence_lessons",
  {
    sequenceId: integer("sequence_id")
      .notNull()
      .references(() => instructionalSequences.sequenceId, { onDelete: "cascade" }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => ufliLessons.lessonId),
    sortOrder: integer("sort_order").notNull(),
    plannedDate: date("planned_date"),
    status: sequenceLessonStatusEnum("status").notNull().default("upcoming"),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [unique().on(t.sequenceId, t.lessonId)],
);

export const instructionalSequenceLessonsRelations = relations(
  instructionalSequenceLessons,
  ({ one }) => ({
    sequence: one(instructionalSequences, {
      fields: [instructionalSequenceLessons.sequenceId],
      references: [instructionalSequences.sequenceId],
    }),
    lesson: one(ufliLessons, {
      fields: [instructionalSequenceLessons.lessonId],
      references: [ufliLessons.lessonId],
    }),
  }),
);

// ---------------------------------------------------------------------------
// initial_assessments — frozen baseline + end-of-semester snapshots
// ---------------------------------------------------------------------------
// One row per (student, year, snapshot_type). The 'baseline' snapshot is
// the BOY frozen reference; semester_1_end and semester_2_end are independent
// measurements over the year. All snapshots seed lesson_progress with
// source='assessment' so the Big Four high-water-mark logic picks them up.

export const initialAssessments = pgTable(
  "initial_assessments",
  {
    assessmentId: bigserial("assessment_id", { mode: "number" }).primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.studentId, { onDelete: "cascade" }),
    yearId: integer("year_id")
      .notNull()
      .references(() => academicYears.yearId),
    snapshotType: assessmentSnapshotTypeEnum("snapshot_type").notNull(),
    assessmentDate: date("assessment_date").notNull(),
    scorerId: integer("scorer_id").references(() => staff.staffId),
    isKindergartenEoy: boolean("is_kindergarten_eoy").notNull().default(false),
    foundationalPct: numeric("foundational_pct", { precision: 5, scale: 2 }),
    kgPct: numeric("kg_pct", { precision: 5, scale: 2 }),
    firstGradePct: numeric("first_grade_pct", { precision: 5, scale: 2 }),
    secondGradePct: numeric("second_grade_pct", { precision: 5, scale: 2 }),
    overallPct: numeric("overall_pct", { precision: 5, scale: 2 }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [unique("uq_assessment_per_snapshot").on(t.studentId, t.yearId, t.snapshotType)],
);

export const initialAssessmentsRelations = relations(
  initialAssessments,
  ({ one, many }) => ({
    student: one(students, {
      fields: [initialAssessments.studentId],
      references: [students.studentId],
    }),
    academicYear: one(academicYears, {
      fields: [initialAssessments.yearId],
      references: [academicYears.yearId],
    }),
    scorer: one(staff, {
      fields: [initialAssessments.scorerId],
      references: [staff.staffId],
    }),
    lessons: many(initialAssessmentLessons),
    componentErrors: many(assessmentComponentErrors),
  }),
);

// ---------------------------------------------------------------------------
// initial_assessment_lessons — per-lesson Y/N for each assessment row
// ---------------------------------------------------------------------------

export const initialAssessmentLessons = pgTable(
  "initial_assessment_lessons",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    assessmentId: bigint("assessment_id", { mode: "number" })
      .notNull()
      .references(() => initialAssessments.assessmentId, {
        onDelete: "cascade",
      }),
    lessonId: integer("lesson_id")
      .notNull()
      .references(() => ufliLessons.lessonId),
    status: lessonStatusEnum("status").notNull(),
  },
  (t) => [
    unique("uq_assessment_lesson").on(t.assessmentId, t.lessonId),
    check("chk_assessment_status_y_or_n", sql`status IN ('Y', 'N')`),
  ],
);

export const initialAssessmentLessonsRelations = relations(
  initialAssessmentLessons,
  ({ one }) => ({
    assessment: one(initialAssessments, {
      fields: [initialAssessmentLessons.assessmentId],
      references: [initialAssessments.assessmentId],
    }),
    lesson: one(ufliLessons, {
      fields: [initialAssessmentLessons.lessonId],
      references: [ufliLessons.lessonId],
    }),
  }),
);

// ---------------------------------------------------------------------------
// assessment_component_errors — diagnostic detail (Phase C)
// ---------------------------------------------------------------------------
// One row per word where the student missed at least one component. Powers
// the diagnostic framework's network-wide error pattern rollups.

export const assessmentComponentErrors = pgTable(
  "assessment_component_errors",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    assessmentId: bigint("assessment_id", { mode: "number" })
      .notNull()
      .references(() => initialAssessments.assessmentId, {
        onDelete: "cascade",
      }),
    sectionKey: varchar("section_key", { length: 50 }).notNull(),
    sectionName: varchar("section_name", { length: 100 }).notNull(),
    word: varchar("word", { length: 50 }).notNull(),
    componentsCorrect: text("components_correct").notNull().default(""),
    componentsMissed: text("components_missed").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
);

export const assessmentComponentErrorsRelations = relations(
  assessmentComponentErrors,
  ({ one }) => ({
    assessment: one(initialAssessments, {
      fields: [assessmentComponentErrors.assessmentId],
      references: [initialAssessments.assessmentId],
    }),
  }),
);
