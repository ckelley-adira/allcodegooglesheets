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
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  lessonStatusEnum,
  dataSourceEnum,
  sessionTypeEnum,
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
