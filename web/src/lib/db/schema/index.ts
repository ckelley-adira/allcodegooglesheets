/**
 * @file schema/index.ts — barrel export for the complete Adira Reads schema
 *
 * All 22 tables across 4 domains, plus enum types and relation definitions.
 * Import from here for Drizzle queries and migrations.
 */

export * from "./enums";
export * from "./core";
export * from "./curriculum";
export * from "./tracking";
export * from "./system";
