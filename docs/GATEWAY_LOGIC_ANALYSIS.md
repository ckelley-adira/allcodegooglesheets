# Gateway Logic: Legacy vs. Current System

**Date:** 2026-04-09  
**Status:** ⚠️ **MAJOR FEATURE MISSING FROM NEW SYSTEM**

---

## Your Question (Both Parts)

**a) Does the gateway logic make sense pedagogically?**  
**b) Is that how the system is designed?**

**Answer:**
- **a) YES** — The gateway logic makes excellent pedagogical sense
- **b) NO** — The current TypeScript system **does NOT implement this logic**. It was in the legacy Sheets system but did not port forward to the new architecture.

---

## What the Gateway Logic Did (Legacy System)

### Core Concept

The 23 **review lessons** (also called **gateway tests**) served as section-level "proof of mastery." When a student struggled with regular lessons in a section, they could be assigned the review lessons for that section as an alternative pathway to demonstrate competency.

**File:** `/gold-standard-template/SharedConstants.gs` (lines 104-109)
```javascript
// Review lessons act as "gateway tests" - passing ALL review lessons in a
// section grants 100% credit for that section. If ANY review is populated
// (Y or N), the section's final percentage is determined by mastery of
// all review lessons ONLY.

const REVIEW_LESSONS = [35,36,37,39,40,41,49,53,57,59,62,71,76,79,83,88,92,97,102,104,105,106,128];
```

### How It Worked

**File:** `/gold-standard-template/SharedEngine.gs` (lines 220-249, 256-318)

#### Step 1: Identify Review Lessons in a Section
```javascript
// For each skill section, partition lessons into:
// - Review lessons (the 23 gateway tests)
// - Non-review lessons (regular instructional content)

const SECTIONS = {
  "Alphabet Review & Longer Words": [35, 36, 37, 38, 39, 40, 41],
  "Digraphs": [42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53],
  // etc.
};

// For each section:
const reviewLessonsInSection = SECTIONS[sectionName].filter(l => REVIEW_LESSONS.includes(l));
const regularLessonsInSection = SECTIONS[sectionName].filter(l => !REVIEW_LESSONS.includes(l));
```

#### Step 2: Check Gateway Status
```javascript
/**
 * Checks if the student "passed the gateway" for a section:
 * - At least one review lesson is assigned (Y or N in the tracker)
 * - AND all assigned review lessons are marked Y (passed)
 * 
 * Blank cells = not assigned (ignored for gateway check)
 */
function checkGateway(studentRow, reviewLessonsInSection) {
  let anyReviewAssigned = false;
  let allReviewsPassed = true;

  for (const lessonNum of reviewLessonsInSection) {
    const status = studentRow[getColumnForLesson(lessonNum)];
    
    if (status === "Y") {
      anyReviewAssigned = true;
    } else if (status === "N") {
      anyReviewAssigned = true;
      allReviewsPassed = false;  // At least one failed review
    }
    // Blank = not yet assigned/taken, ignore
  }

  return {
    gatewayPassed: anyReviewAssigned && allReviewsPassed,
    anyAssigned: anyReviewAssigned
  };
}
```

#### Step 3: Calculate Section Mastery
```javascript
/**
 * Legacy section mastery calculation with gateway logic
 * 
 * FOR INITIAL ASSESSMENT (Baseline): 
 *   Ignore gateway, use only non-review lessons
 *   mastery% = Y_count / non_review_total × 100
 *
 * FOR ONGOING PROGRESS:
 *   IF gateway is passed (all assigned reviews = Y):
 *     mastery% = 100% (automatic credit)
 *   ELSE:
 *     mastery% = Y_count_on_regular_lessons / non_review_total × 100
 */
function calculateSectionPercentage(studentRow, sectionLessons, isInitial) {
  const regularLessons = sectionLessons.filter(l => !REVIEW_LESSONS.includes(l));
  const reviewLessons = sectionLessons.filter(l => REVIEW_LESSONS.includes(l));

  // Baseline (initial assessment): ignore gateway
  if (isInitial) {
    const passed = countPassed(studentRow, regularLessons);
    return Math.round((passed / regularLessons.length) * 100);
  }

  // === ONGOING PROGRESS WITH GATEWAY ===
  
  // First check: did they pass the gateway?
  if (reviewLessons.length > 0) {
    const gateway = checkGateway(studentRow, reviewLessons);
    if (gateway.gatewayPassed) {
      return 100;  // Automatic 100% credit for the section
    }
  }

  // Gateway not passed: fall back to regular lesson mastery
  const passed = countPassed(studentRow, regularLessons);
  return Math.round((passed / regularLessons.length) * 100);
}
```

### Pedagogical Rationale

The gateway logic made sense because:

1. **Proof of Mastery:** Review/gateway lessons are comprehensive assessments. If a student passes ALL of them, they've demonstrated section-level understanding even if they struggled along the way.

2. **Alternative Pathway:** Not all students follow the same learning trajectory. Some students:
   - Might have gaps in earlier lessons but strong foundational understanding
   - Might struggle with the sequential instruction but excel on cumulative assessments
   - Might have been absent during certain lessons but catch up via focused review

3. **Credit for Resilience:** If a student shows up and completes the full review sequence with mastery, they've earned section credit, period.

4. **Avoids "Swiss Cheese" Penalties:** A student with one gap in a 12-lesson section (91.7% mastery) gets penalized, while a student who passes the 2-3 review lessons for that section gets 100%. This acknowledges that comprehensive understanding matters more than perfect sequential coverage.

5. **Motivation:** Students who are "stuck" in a section can see a clear path forward: "Pass these review lessons and you get credit for the whole section."

### Example Scenario (Legacy System)

**Student: Maria, Grade 2, Section: "VCE"**

- Regular VCE lessons (L54-L61): Attempted 8 lessons, passed 5 (62.5% mastery)
- VCE Review lessons (L57, L59, L62): Assigned all 3, passed all 3

**Legacy System Result:**
- Gateway Status: Assigned (3 reviews) + All Passed (3/3 Y) = **Gateway Passed**
- Section Mastery: **100%** (overrides the 62.5% from regular lessons)
- Ceiling Section: VCE or higher (depending on other sections)

---

## What the Current System Does

### Review Lessons Are Simply Excluded

**File:** `/web/src/lib/banding/engine.ts` (lines 125-140)
```typescript
/** Filter out review lessons from a bucket. */
function nonReviewLessons(bucket: Set<number>): number[] {
  const out: number[] = [];
  for (const l of bucket) if (!REVIEW_LESSONS.has(l)) out.push(l);
  return out;
}
```

### Section Mastery Calculation (Current)

**File:** `/web/src/lib/banding/engine.ts` (lines 315-349)
```typescript
export function findCeilingSection(
  passedLessons: Set<number>,
): SkillSectionName | null {
  const counts = new Map<SkillSectionName, { total: number; passed: number }>();

  for (const [rawSectionName, lessonNumbers] of Object.entries(SKILL_SECTIONS)) {
    for (const ln of lessonNumbers) {
      if (REVIEW_LESSONS.has(ln)) continue;  // ← Skip review lessons entirely
      const resolved = sectionForLesson(ln);
      const section: SkillSectionName = resolved ?? (rawSectionName as SkillSectionName);
      const agg = counts.get(section) ?? { total: 0, passed: 0 };
      agg.total++;
      if (passedLessons.has(ln)) agg.passed++;
      counts.set(section, agg);
    }
  }

  // Find first section from the end with >=80% mastery
  for (let i = SECTION_ORDER.length - 1; i >= 0; i--) {
    const section = SECTION_ORDER[i];
    const agg = counts.get(section);
    if (!agg || agg.total === 0) continue;
    const pct = (agg.passed / agg.total) * 100;
    if (pct >= 80) return section;
  }
  return null;
}
```

### Key Differences

| Aspect | Legacy (Sheets) | Current (TypeScript) |
|--------|---|---|
| **Review Lessons** | Used as alternative proof of mastery | Excluded from all calculations |
| **Gateway Passing** | All reviews Y in section = 100% credit | Not implemented |
| **100% Section Credit** | Can be earned by passing gateway reviews | Only by passing all regular lessons |
| **Section Mastery Calc** | Regular lessons IF gateway not passed | Always regular lessons only |
| **Review Lesson Assignment** | Automatic routing for struggling students | Not implemented |
| **Reflected in Code** | `checkGateway()`, `calculateSectionPercentage()` | Just `if (REVIEW_LESSONS.has(l)) continue;` |

### Current Example (Same Student - Maria)

**Student: Maria, Grade 2, Section: "VCE"**

- Regular VCE lessons (L54-L61): Passed 5 (excluding reviews)
- VCE Review lessons (L57, L59, L62): Passed all 3

**Current System Result:**
- Review lessons **ignored entirely** in calculation
- Section Mastery: (5 regular passed / 8 regular total) × 100 = **62.5%**
- Ceiling Section: Determined by sections with ≥80% regular mastery only
- Review lesson results have **no impact** on section credit

---

## Database: Is the Infrastructure There?

**Good news:** The database schema **does include the `is_review` flag**:

**File:** `/web/src/lib/db/schema/curriculum.ts` (lines 42-49)
```typescript
export const ufliLessons = pgTable("ufli_lessons", {
  lessonId: serial("lesson_id").primaryKey(),
  lessonNumber: smallint("lesson_number").notNull().unique(),
  lessonName: varchar("lesson_name", { length: 150 }),
  skillSection: varchar("skill_section", { length: 50 }).notNull(),
  sortOrder: smallint("sort_order").notNull(),
  isReview: boolean("is_review").notNull().default(false),  // ← Infrastructure exists
});
```

The 23 review lessons are seeded with `is_review=true` in the database. But this flag is **not actively used** in the new system's core calculation logic.

---

## What This Means for Your System

### Current Gaps

1. **No Automatic Gateway Routing:** When a student struggles in a section, there's no automatic assignment of review lessons as an alternative pathway.

2. **No 100% Gateway Credit:** Even if a student is manually assigned review lessons and passes all of them, the system won't award 100% section credit—it still calculates mastery from only the regular lessons.

3. **Review Lesson Results Are Lost:** When review lessons are submitted (via assessment or manual entry), their Y/N results don't flow into section mastery calculations. They're stored in the database but ignored.

4. **No Visibility into Gateway Potential:** The system can't tell you "Maria is 3 points away from 100% section credit if she passes these 2 review lessons."

### Questions to Ask

1. **Is the gateway logic intentional?** (Part of your pedagogical model?)
   - If YES: This is a deferred feature that needs implementation
   - If NO: The `is_review` flag can be removed/ignored

2. **Do you want struggling students routed to review lessons?**
   - This would require new assignment logic in the coaching dashboard or teacher UI

3. **Should passing all review lessons grant 100% section credit?**
   - This would require modifying the ceiling section calculation in `findCeilingSection()`

4. **Should review lesson results affect the Big Four metrics?**
   - Currently they don't; should they?

---

## Implementation Path (If Needed)

If you want to restore gateway logic, you would need to:

### 1. Modify Ceiling Section Calculation
**File:** `/web/src/lib/banding/engine.ts` → `findCeilingSection()`

```typescript
// Instead of:
const pct = (agg.passed / agg.total) * 100;
if (pct >= 80) return section;

// Would need:
const gatewayStatus = checkGatewayForSection(passedLessons, section);
if (gatewayStatus.passed) return section;  // 100% credit via gateway
const pct = (agg.passed / agg.total) * 100;
if (pct >= 80) return section;  // 80%+ on regular lessons
```

### 2. Add Gateway Checker
```typescript
function checkGatewayForSection(
  passedLessons: Set<number>,
  section: SkillSectionName
): { passed: boolean; assigned: boolean } {
  const reviewsInSection = SKILL_SECTIONS[section]
    .filter(l => REVIEW_LESSONS.has(l));
  
  if (reviewsInSection.length === 0) {
    return { passed: false, assigned: false };
  }

  let anyAssigned = false;
  let allPassed = true;

  for (const l of reviewsInSection) {
    if (passedLessons.has(l)) {
      anyAssigned = true;
    } else if (!passedLessons.has(l)) {
      // Check if it's been attempted (N) or not yet
      // This requires checking lesson_progress for "N" status
      allPassed = false;
    }
  }

  return {
    passed: anyAssigned && allPassed,
    assigned: anyAssigned
  };
}
```

### 3. Add Review Lesson Assignment Logic
- New feature in coaching dashboard: "Recommend review lessons for section"
- Automatic routing when a student's ceiling section is below grade expectation
- Manual override for teachers

### 4. Update Coach Recommendations
- "Maria is at 62.5% in VCE. If she passes the 3 VCE review lessons, she'll get 100% credit."

---

## Recommendation

**Before porting gateway logic forward, clarify:**

1. Is the gateway logic part of your pedagogical model (intentional per your curriculum)?
2. Who decides when review lessons are assigned (teacher, system, student)?
3. Should review lesson performance be visible in dashboards even though it doesn't affect calculations currently?
4. Is the `is_review` flag something you want to keep active, or should it be informational only?

The **infrastructure exists** (database flag, 23-lesson set defined, review lessons can be stored). The **calculation logic is missing**. Once you confirm this is intentional, it's a straightforward port.
