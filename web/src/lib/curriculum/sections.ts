/**
 * @file curriculum/sections.ts — Skill section helpers
 *
 * Builds on SKILL_SECTIONS from @/config/ufli (the canonical coaching
 * section map) and adds the FCD-specific helpers ported from
 * FridayCoachingDashboard.gs: section order, bridging section resolution,
 * effective lesson sets, bridge-detection thresholds, and previous-section
 * lookups.
 *
 * "Bridging sections" are small sections embedded inside a larger parent
 * section's instructional flow. They resolve to the parent for dashboard
 * purposes so section labels don't oscillate week-to-week and lesson counts
 * include the bridged children. Per Christina: the Alphabet Review lessons
 * (35–41) belong here and feed back into Digraphs instruction when students
 * struggle, which is why the coaching section map is the canonical one.
 *
 * Separate from the Assessment section map in lib/assessment/sections.ts,
 * which is scoped to the initial-assessment scoring engine.
 */

import { SKILL_SECTIONS } from "@/config/ufli";

export type SkillSectionName = keyof typeof SKILL_SECTIONS;

/**
 * Ordered section names (chronological in the UFLI sequence). Used for
 * previous/next section lookups and bridge detection.
 */
export const SECTION_ORDER: readonly SkillSectionName[] = [
  "Single Consonants & Vowels",
  "Blends",
  "Alphabet Review & Longer Words",
  "Digraphs",
  "VCE",
  "Reading Longer Words",
  "Ending Spelling Patterns",
  "R-Controlled Vowels",
  "Long Vowel Teams",
  "Other Vowel Teams",
  "Diphthongs",
  "Silent Letters",
  "Suffixes & Prefixes",
  "Suffix Spelling Changes",
  "Low Frequency Spellings",
  "Additional Affixes",
] as const;

/**
 * Bridging sections: raw section name → parent section.
 * Blends (L25, L27) embed inside Single Consonants & Vowels instructionally,
 * so for dashboard purposes they resolve to the parent section.
 */
export const BRIDGING_SECTIONS: Partial<Record<SkillSectionName, SkillSectionName>> = {
  Blends: "Single Consonants & Vowels",
};

/** Reverse lookup: lesson number → raw section name (pre-bridge resolution). */
const LESSON_TO_RAW_SECTION = new Map<number, SkillSectionName>();
for (const [section, lessons] of Object.entries(SKILL_SECTIONS)) {
  for (const l of lessons) {
    LESSON_TO_RAW_SECTION.set(l, section as SkillSectionName);
  }
}

/**
 * Returns the raw section name for a lesson, or null if the lesson is not
 * in any section (shouldn't happen for valid UFLI lessons 1–128).
 */
export function rawSectionForLesson(
  lessonNumber: number,
): SkillSectionName | null {
  return LESSON_TO_RAW_SECTION.get(lessonNumber) ?? null;
}

/**
 * Returns the resolved section name for a lesson — bridging sections
 * collapsed to their parent. Use this for coaching dashboards, growth
 * snapshots, and the diagnostic framework lookup.
 */
export function sectionForLesson(
  lessonNumber: number,
): SkillSectionName | null {
  const raw = rawSectionForLesson(lessonNumber);
  if (!raw) return null;
  return BRIDGING_SECTIONS[raw] ?? raw;
}

/**
 * Returns the effective lesson set for a section — includes bridged children.
 * For Single Consonants & Vowels, this returns the SCV lessons plus the
 * bridged Blends lessons (25, 27).
 */
export function effectiveSectionLessons(section: SkillSectionName): number[] {
  const direct = [...(SKILL_SECTIONS[section] ?? [])];
  const bridgedChildren: number[] = [];
  for (const [child, parent] of Object.entries(BRIDGING_SECTIONS)) {
    if (parent === section) {
      bridgedChildren.push(...(SKILL_SECTIONS[child as SkillSectionName] ?? []));
    }
  }
  return [...direct, ...bridgedChildren].sort((a, b) => a - b);
}

/** Returns the effective section size (lesson count including bridged children). */
export function sectionSize(section: SkillSectionName): number {
  return effectiveSectionLessons(section).length;
}

/**
 * Returns the minimum number of lessons a group must have attempted in a
 * section before mastery flags fire. Small sections (≤3) → attempt all;
 * larger sections → attempt at least 3.
 */
export function sectionMinThreshold(section: SkillSectionName): number {
  const size = sectionSize(section);
  return size <= 3 ? size : 3;
}

/**
 * Returns the previous non-bridging section in the UFLI sequence, or null
 * if this is the first section. Used by the Priority Matrix to detect
 * recently-completed sections and surface celebration/fidelity flags.
 */
export function previousSection(
  section: SkillSectionName,
): SkillSectionName | null {
  const idx = SECTION_ORDER.indexOf(section);
  if (idx <= 0) return null;
  for (let i = idx - 1; i >= 0; i--) {
    const candidate = SECTION_ORDER[i];
    if (!(candidate in BRIDGING_SECTIONS)) {
      return candidate;
    }
  }
  return null;
}

/** Returns the highest lesson number in a section's effective lesson set. */
export function lastLessonInSection(section: SkillSectionName): number | null {
  const lessons = effectiveSectionLessons(section);
  return lessons.length > 0 ? lessons[lessons.length - 1] : null;
}

/** Returns the lowest lesson number in a section's effective lesson set. */
export function firstLessonInSection(section: SkillSectionName): number | null {
  const lessons = effectiveSectionLessons(section);
  return lessons.length > 0 ? lessons[0] : null;
}
