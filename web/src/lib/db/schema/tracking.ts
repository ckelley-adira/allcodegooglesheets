/**
 * @file tracking.ts — Tracking & Analytics domain tables
 *
 * Covers benchmark records, weekly snapshots, and coaching metrics.
 * These tables power the Big Four metrics and the Friday Dashboard.
 *
 * @see /Relational_Database_Model.html Section 3 — "TRACKING & ANALYTICS"
 */

import {
  pgTable,
  bigserial,
  integer,
  date,
  smallint,
  numeric,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  benchmarkTypeEnum,
  bandLabelEnum,
  coachingPriorityEnum,
} from "./enums";
import { students, instructionalGroups, academicYears } from "./core";

// ---------------------------------------------------------------------------
// benchmark_records — initial vs. current performance band per student
// ---------------------------------------------------------------------------

export const benchmarkRecords = pgTable(
  "benchmark_records",
  {
    benchmarkId: bigserial("benchmark_id", { mode: "number" }).primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.studentId),
    yearId: integer("year_id")
      .notNull()
      .references(() => academicYears.yearId),
    benchmarkType: benchmarkTypeEnum("benchmark_type").notNull(),
    bandLabel: bandLabelEnum("band_label").notNull(),
    percentage: numeric("percentage", { precision: 5, scale: 2 }).notNull(),
    recordedDate: date("recorded_date").notNull(),
  },
  (t) => [unique().on(t.studentId, t.yearId, t.benchmarkType)],
);

export const benchmarkRecordsRelations = relations(
  benchmarkRecords,
  ({ one }) => ({
    student: one(students, {
      fields: [benchmarkRecords.studentId],
      references: [students.studentId],
    }),
    academicYear: one(academicYears, {
      fields: [benchmarkRecords.yearId],
      references: [academicYears.yearId],
    }),
  }),
);

// ---------------------------------------------------------------------------
// weekly_snapshots — time-series growth data per student per week
// ---------------------------------------------------------------------------

export const weeklySnapshots = pgTable(
  "weekly_snapshots",
  {
    snapshotId: bigserial("snapshot_id", { mode: "number" }).primaryKey(),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.studentId),
    yearId: integer("year_id")
      .notNull()
      .references(() => academicYears.yearId),
    weekNumber: smallint("week_number").notNull(),
    weekStartDate: date("week_start_date").notNull(),
    growthPct: numeric("growth_pct", { precision: 5, scale: 2 }).notNull(),
    lessonsTaken: smallint("lessons_taken").notNull().default(0),
    lessonsPassed: smallint("lessons_passed").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.studentId, t.yearId, t.weekNumber)],
);

export const weeklySnapshotsRelations = relations(
  weeklySnapshots,
  ({ one }) => ({
    student: one(students, {
      fields: [weeklySnapshots.studentId],
      references: [students.studentId],
    }),
    academicYear: one(academicYears, {
      fields: [weeklySnapshots.yearId],
      references: [academicYears.yearId],
    }),
  }),
);

// ---------------------------------------------------------------------------
// coaching_metrics — weekly per-group coaching signals (Friday Dashboard)
// ---------------------------------------------------------------------------

export const coachingMetrics = pgTable(
  "coaching_metrics",
  {
    metricId: bigserial("metric_id", { mode: "number" }).primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => instructionalGroups.groupId),
    yearId: integer("year_id")
      .notNull()
      .references(() => academicYears.yearId),
    weekStartDate: date("week_start_date").notNull(),
    reteachFreq: numeric("reteach_freq", { precision: 5, scale: 2 }),
    passRate: numeric("pass_rate", { precision: 5, scale: 2 }),
    growthSlope: numeric("growth_slope", { precision: 7, scale: 4 }),
    absenteeismRate: numeric("absenteeism_rate", { precision: 5, scale: 2 }),
    coachingPriority: coachingPriorityEnum("coaching_priority"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.groupId, t.yearId, t.weekStartDate)],
);

export const coachingMetricsRelations = relations(
  coachingMetrics,
  ({ one }) => ({
    group: one(instructionalGroups, {
      fields: [coachingMetrics.groupId],
      references: [instructionalGroups.groupId],
    }),
    academicYear: one(academicYears, {
      fields: [coachingMetrics.yearId],
      references: [academicYears.yearId],
    }),
  }),
);
