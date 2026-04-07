/**
 * @file enums.ts — PostgreSQL enum type definitions for Adira Reads
 *
 * Maps directly to the ENUM types in the Relational_Database_Model.html DDL.
 * Supabase/Postgres enums are defined here as pgEnum and re-exported for use
 * in table definitions.
 *
 * @see /Relational_Database_Model.html Section 3 — "ENUM TYPES"
 */

import { pgEnum } from "drizzle-orm/pg-core";

/** Staff roles — maps to the five-role model from D-003 */
export const staffRoleEnum = pgEnum("staff_role", [
  "tutor",
  "coach",
  "school_admin",
  "tilt_admin",
]);

/** Student enrollment lifecycle */
export const enrollmentStatusEnum = pgEnum("enrollment_status", [
  "active",
  "withdrawn",
  "transferred",
  "graduated",
]);

/**
 * Lesson outcome — Y (passed), N (attempted/failed), A (absent).
 * Per D-012 (Equity of Visibility), 'A' values are excluded from slope
 * calculations, never counted as zeros.
 */
export const lessonStatusEnum = pgEnum("lesson_status", ["Y", "N", "A"]);

/** How a lesson_progress record was created */
export const dataSourceEnum = pgEnum("data_source", [
  "form",
  "import",
  "manual",
  "api",
  "assessment",
]);

/** Benchmark comparison type */
export const benchmarkTypeEnum = pgEnum("benchmark_type", [
  "initial",
  "current",
]);

/** Student performance band labels */
export const bandLabelEnum = pgEnum("band_label", [
  "on_track",
  "progressing",
  "needs_support",
]);

/** Tutoring session types */
export const sessionTypeEnum = pgEnum("session_type", [
  "reteach",
  "comprehension",
  "intervention",
  "enrichment",
]);

/** Coaching priority levels for the Friday Dashboard */
export const coachingPriorityEnum = pgEnum("coaching_priority", [
  "critical",
  "high",
  "medium",
  "low",
]);

/** Data import pipeline status */
export const importStatusEnum = pgEnum("import_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

/** Instructional sequence lifecycle status */
export const sequenceStatusEnum = pgEnum("sequence_status", [
  "draft",
  "active",
  "completed",
]);

/** Per-lesson status within a sequence */
export const sequenceLessonStatusEnum = pgEnum("sequence_lesson_status", [
  "upcoming",
  "current",
  "completed",
  "skipped",
]);

/**
 * Initial-assessment snapshot type. A student gets at most one row per
 * (year, snapshot_type). 'baseline' is the frozen BOY reference; the two
 * end-of-semester snapshots are independent measurements over the year.
 */
export const assessmentSnapshotTypeEnum = pgEnum("assessment_snapshot_type", [
  "baseline",
  "semester_1_end",
  "semester_2_end",
]);
