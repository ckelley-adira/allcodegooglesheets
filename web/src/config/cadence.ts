/**
 * @file cadence.ts — Cadence day constants
 *
 * Separated from the schools DAL so client components can import the
 * constant array without pulling in the server-only Supabase client.
 */

/** Valid 3-letter day codes for the school cadence setting */
export const CADENCE_DAY_CODES = ["MON", "TUE", "WED", "THU", "FRI"] as const;
export type CadenceDayCode = (typeof CADENCE_DAY_CODES)[number];
