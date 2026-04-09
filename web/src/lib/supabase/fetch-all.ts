/**
 * @file supabase/fetch-all.ts — Paginated fetch for Supabase queries
 *
 * Supabase / PostgREST defaults to returning at most 1,000 rows per
 * request. Queries that can exceed this (students × lessons, school-wide
 * aggregations, network rollups) silently truncate — no error, just
 * missing data. This helper paginates transparently.
 *
 * Usage:
 *   const rows = await fetchAllRows<{ student_id: number; status: string }>(
 *     (from, to) =>
 *       supabase
 *         .from("lesson_progress")
 *         .select("student_id, status")
 *         .eq("year_id", yearId)
 *         .range(from, to),
 *   );
 *
 * The callback receives `(from, to)` and must return the Supabase query
 * with `.range(from, to)` appended. It's called once per page until a
 * page returns fewer rows than PAGE_SIZE.
 *
 * @rls Pagination does not bypass RLS — each page request goes through
 *   the same authenticated client.
 */

/**
 * Shape returned by Supabase query builders when awaited.
 *
 * Uses `unknown[]` for data because PostgREST types represent joined
 * relations as arrays (e.g. `ufli_lessons: { lesson_number: any }[]`)
 * while our domain types model them as objects (`{ lesson_number: number } | null`).
 * The caller's generic `T` still types the output correctly.
 */
interface SupabaseQueryResult {
  data: unknown[] | null;
  error: { message: string } | null;
}

/**
 * Default page size. Must not exceed the project's PostgREST `max-rows`
 * setting (1,000 on Supabase hosted by default). Using exactly 1,000
 * ensures each page fills completely when there are more rows.
 */
const DEFAULT_PAGE_SIZE = 1000;

/**
 * Fetches all rows from a Supabase query, paginating automatically.
 *
 * @param buildQuery Factory called once per page. Must return a fresh
 *   Supabase query with `.range(from, to)` appended.
 * @param pageSize Rows per page. Defaults to 1,000 (Supabase default
 *   max-rows). Only lower this if the project's max-rows is smaller.
 */
export async function fetchAllRows<T>(
  buildQuery: (from: number, to: number) => PromiseLike<SupabaseQueryResult>,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  const allRows: T[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await buildQuery(offset, offset + pageSize - 1);
    if (error) throw new Error(error.message);

    const rows = (data ?? []) as T[];
    allRows.push(...rows);

    if (rows.length < pageSize) break;
    offset += pageSize;
  }

  return allRows;
}
