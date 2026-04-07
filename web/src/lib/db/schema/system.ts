/**
 * @file system.ts — System & Admin domain tables
 *
 * Covers feature settings (per-school feature flags), import pipeline
 * tracking, and the append-only audit log (D-004).
 *
 * @see /Relational_Database_Model.html Section 3 — "SYSTEM & ADMIN"
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
  bigint,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { importStatusEnum } from "./enums";
import { schools, staff } from "./core";

// ---------------------------------------------------------------------------
// feature_settings — per-school key-value feature flags
// Replaces the SiteConfig_TEMPLATE.gs features object from the GAS codebase.
// ---------------------------------------------------------------------------

export const featureSettings = pgTable(
  "feature_settings",
  {
    settingId: serial("setting_id").primaryKey(),
    schoolId: integer("school_id")
      .notNull()
      .references(() => schools.schoolId),
    featureKey: varchar("feature_key", { length: 100 }).notNull(),
    featureValue: text("feature_value"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.schoolId, t.featureKey)],
);

export const featureSettingsRelations = relations(
  featureSettings,
  ({ one }) => ({
    school: one(schools, {
      fields: [featureSettings.schoolId],
      references: [schools.schoolId],
    }),
  }),
);

// ---------------------------------------------------------------------------
// import_log — tracks bulk data import operations
// ---------------------------------------------------------------------------

export const importLog = pgTable("import_log", {
  importId: serial("import_id").primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schools.schoolId),
  importType: varchar("import_type", { length: 50 }).notNull(),
  fileName: varchar("file_name", { length: 255 }),
  recordsTotal: integer("records_total").notNull().default(0),
  recordsSuccess: integer("records_success").notNull().default(0),
  recordsFailed: integer("records_failed").notNull().default(0),
  status: importStatusEnum("status").notNull().default("pending"),
  importedBy: integer("imported_by").references(() => staff.staffId),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const importLogRelations = relations(importLog, ({ one, many }) => ({
  school: one(schools, {
    fields: [importLog.schoolId],
    references: [schools.schoolId],
  }),
  importer: one(staff, {
    fields: [importLog.importedBy],
    references: [staff.staffId],
  }),
  exceptions: many(importExceptions),
}));

// ---------------------------------------------------------------------------
// import_exceptions — individual row-level errors from an import
// ---------------------------------------------------------------------------

export const importExceptions = pgTable("import_exceptions", {
  exceptionId: bigserial("exception_id", { mode: "number" }).primaryKey(),
  importId: integer("import_id")
    .notNull()
    .references(() => importLog.importId),
  studentRef: varchar("student_ref", { length: 100 }),
  fieldName: varchar("field_name", { length: 100 }),
  errorMsg: text("error_msg").notNull(),
  rawValue: text("raw_value"),
  resolved: boolean("resolved").notNull().default(false),
  resolvedBy: integer("resolved_by").references(() => staff.staffId),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
});

export const importExceptionsRelations = relations(
  importExceptions,
  ({ one }) => ({
    import: one(importLog, {
      fields: [importExceptions.importId],
      references: [importLog.importId],
    }),
  }),
);

// ---------------------------------------------------------------------------
// audit_log — append-only, immutable (D-004)
// No UPDATE or DELETE permissions granted to the application user.
// ---------------------------------------------------------------------------

export const auditLog = pgTable("audit_log", {
  logId: bigserial("log_id", { mode: "number" }).primaryKey(),
  schoolId: integer("school_id")
    .notNull()
    .references(() => schools.schoolId),
  userId: integer("user_id").references(() => staff.staffId),
  action: varchar("action", { length: 50 }).notNull(),
  tableName: varchar("table_name", { length: 50 }),
  recordId: bigint("record_id", { mode: "number" }),
  oldValue: jsonb("old_value"),
  newValue: jsonb("new_value"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  school: one(schools, {
    fields: [auditLog.schoolId],
    references: [schools.schoolId],
  }),
  user: one(staff, {
    fields: [auditLog.userId],
    references: [staff.staffId],
  }),
}));
