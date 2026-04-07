/**
 * @file core.ts — Core domain tables (schools, people, groups)
 *
 * These tables form the tenancy backbone of Adira Reads. Every table with a
 * school_id column participates in RLS per D-002 and D-015.
 *
 * @see /Relational_Database_Model.html Section 3 — "CORE DOMAIN"
 */

import {
  pgTable,
  serial,
  varchar,
  text,
  char,
  boolean,
  timestamp,
  integer,
  date,
  smallint,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  staffRoleEnum,
  enrollmentStatusEnum,
} from "./enums";

// ---------------------------------------------------------------------------
// schools — the tenant boundary (D-001, D-002)
// ---------------------------------------------------------------------------

export const schools = pgTable("schools", {
  schoolId: serial("school_id").primaryKey(),
  name: varchar("name", { length: 150 }).notNull(),
  shortCode: varchar("short_code", { length: 10 }).notNull().unique(),
  address: text("address"),
  city: varchar("city", { length: 100 }),
  state: char("state", { length: 2 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const schoolsRelations = relations(schools, ({ many }) => ({
  academicYears: many(academicYears),
  staff: many(staff),
  students: many(students),
  instructionalGroups: many(instructionalGroups),
}));

// ---------------------------------------------------------------------------
// academic_years — per-school year boundaries
// ---------------------------------------------------------------------------

export const academicYears = pgTable(
  "academic_years",
  {
    yearId: serial("year_id").primaryKey(),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.schoolId),
    label: varchar("label", { length: 10 }).notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
  },
  (t) => [unique().on(t.schoolId, t.label)],
);

export const academicYearsRelations = relations(academicYears, ({ one }) => ({
  school: one(schools, {
    fields: [academicYears.schoolId],
    references: [schools.schoolId],
  }),
}));

// ---------------------------------------------------------------------------
// grade_levels — reference table (not school-scoped)
// ---------------------------------------------------------------------------

export const gradeLevels = pgTable("grade_levels", {
  gradeId: serial("grade_id").primaryKey(),
  name: varchar("name", { length: 5 }).notNull().unique(),
  sortOrder: smallint("sort_order").notNull(),
  gradeBand: varchar("grade_band", { length: 10 }).notNull(),
});

// ---------------------------------------------------------------------------
// staff — users (tutors, coaches, admins). Named "staff" per D-003 role model,
// not "teachers" as in the original HTML schema, to match the five-role layer.
// ---------------------------------------------------------------------------

export const staff = pgTable("staff", {
  staffId: serial("staff_id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schools.schoolId),
  authUid: varchar("auth_uid", { length: 255 }).unique(),
  firstName: varchar("first_name", { length: 80 }).notNull(),
  lastName: varchar("last_name", { length: 80 }).notNull(),
  email: varchar("email", { length: 200 }).notNull().unique(),
  role: staffRoleEnum("role").notNull().default("tutor"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const staffRelations = relations(staff, ({ one }) => ({
  school: one(schools, {
    fields: [staff.schoolId],
    references: [schools.schoolId],
  }),
}));

// ---------------------------------------------------------------------------
// students — per D-009, student_number (external ID) is the canonical join key
// ---------------------------------------------------------------------------

export const students = pgTable("students", {
  studentId: serial("student_id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schools.schoolId),
  gradeId: integer("grade_id")
    .notNull()
    .references(() => gradeLevels.gradeId),
  firstName: varchar("first_name", { length: 80 }).notNull(),
  lastName: varchar("last_name", { length: 80 }).notNull(),
  studentNumber: varchar("student_number", { length: 20 }).notNull().unique(),
  enrollmentStatus: enrollmentStatusEnum("enrollment_status")
    .notNull()
    .default("active"),
  enrollmentDate: date("enrollment_date").notNull(),
  withdrawalDate: date("withdrawal_date"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const studentsRelations = relations(students, ({ one, many }) => ({
  school: one(schools, {
    fields: [students.schoolId],
    references: [schools.schoolId],
  }),
  grade: one(gradeLevels, {
    fields: [students.gradeId],
    references: [gradeLevels.gradeId],
  }),
  groupMemberships: many(groupMemberships),
}));

// ---------------------------------------------------------------------------
// instructional_groups — per D-008, structured fields not free-text names
// ---------------------------------------------------------------------------

export const instructionalGroups = pgTable(
  "instructional_groups",
  {
    groupId: serial("group_id").primaryKey(),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.schoolId),
    gradeId: integer("grade_id")
      .notNull()
      .references(() => gradeLevels.gradeId),
    yearId: integer("year_id")
      .notNull()
      .references(() => academicYears.yearId),
    staffId: integer("staff_id")
      .notNull()
      .references(() => staff.staffId),
    groupName: varchar("group_name", { length: 100 }).notNull(),
    isMixedGrade: boolean("is_mixed_grade").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.schoolId, t.yearId, t.groupName)],
);

export const instructionalGroupsRelations = relations(
  instructionalGroups,
  ({ one, many }) => ({
    school: one(schools, {
      fields: [instructionalGroups.schoolId],
      references: [schools.schoolId],
    }),
    grade: one(gradeLevels, {
      fields: [instructionalGroups.gradeId],
      references: [gradeLevels.gradeId],
    }),
    academicYear: one(academicYears, {
      fields: [instructionalGroups.yearId],
      references: [academicYears.yearId],
    }),
    assignedStaff: one(staff, {
      fields: [instructionalGroups.staffId],
      references: [staff.staffId],
    }),
    memberships: many(groupMemberships),
  }),
);

// ---------------------------------------------------------------------------
// group_memberships — historical junction table (students move between groups)
// ---------------------------------------------------------------------------

export const groupMemberships = pgTable(
  "group_memberships",
  {
    membershipId: serial("membership_id").primaryKey(),
    groupId: integer("group_id")
      .notNull()
      .references(() => instructionalGroups.groupId),
    studentId: integer("student_id")
      .notNull()
      .references(() => students.studentId),
    joinedDate: date("joined_date").notNull().defaultNow(),
    leftDate: date("left_date"),
    isActive: boolean("is_active").notNull().default(true),
  },
  (t) => [unique().on(t.groupId, t.studentId, t.joinedDate)],
);

export const groupMembershipsRelations = relations(
  groupMemberships,
  ({ one }) => ({
    group: one(instructionalGroups, {
      fields: [groupMemberships.groupId],
      references: [instructionalGroups.groupId],
    }),
    student: one(students, {
      fields: [groupMemberships.studentId],
      references: [students.studentId],
    }),
  }),
);
