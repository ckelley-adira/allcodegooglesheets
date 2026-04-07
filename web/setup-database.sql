-- =============================================================================
-- ADIRA READS: Complete Database Setup
-- =============================================================================
-- Run this ONCE in the Supabase SQL Editor (supabase.com → your project →
-- SQL Editor → New query → paste this → click "Run").
--
-- This creates all 22 tables, 9 enum types, RLS policies, the JWT claims
-- hook, reference data (128 UFLI lessons + 10 grade levels), and a
-- starter school + admin account.
-- =============================================================================


-- ======================== ENUM TYPES ========================================

DO $$ BEGIN
  CREATE TYPE staff_role AS ENUM ('tutor', 'coach', 'school_admin', 'tilt_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE enrollment_status AS ENUM ('active', 'withdrawn', 'transferred', 'graduated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE lesson_status AS ENUM ('Y', 'N', 'A');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE data_source AS ENUM ('form', 'import', 'manual', 'api');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE benchmark_type AS ENUM ('initial', 'current');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE band_label AS ENUM ('on_track', 'progressing', 'needs_support');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE session_type AS ENUM ('reteach', 'comprehension', 'intervention', 'enrichment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE coaching_priority AS ENUM ('critical', 'high', 'medium', 'low');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE import_status AS ENUM ('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ======================== CORE DOMAIN =======================================

CREATE TABLE IF NOT EXISTS schools (
  school_id     SERIAL PRIMARY KEY,
  name          VARCHAR(150) NOT NULL,
  short_code    VARCHAR(10) NOT NULL UNIQUE,
  address       TEXT,
  city          VARCHAR(100),
  state         CHAR(2),
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS academic_years (
  year_id       SERIAL PRIMARY KEY,
  school_id     INT NOT NULL REFERENCES schools(school_id),
  label         VARCHAR(10) NOT NULL,
  start_date    DATE NOT NULL,
  end_date      DATE NOT NULL,
  is_current    BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE(school_id, label)
);

CREATE TABLE IF NOT EXISTS grade_levels (
  grade_id      SERIAL PRIMARY KEY,
  name          VARCHAR(5) NOT NULL UNIQUE,
  sort_order    SMALLINT NOT NULL,
  grade_band    VARCHAR(10) NOT NULL
);

CREATE TABLE IF NOT EXISTS staff (
  staff_id      SERIAL PRIMARY KEY,
  school_id     INT NOT NULL REFERENCES schools(school_id),
  auth_uid      VARCHAR(255) UNIQUE,
  first_name    VARCHAR(80) NOT NULL,
  last_name     VARCHAR(80) NOT NULL,
  email         VARCHAR(200) NOT NULL UNIQUE,
  role          staff_role NOT NULL DEFAULT 'tutor',
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS students (
  student_id        SERIAL PRIMARY KEY,
  school_id         INT NOT NULL REFERENCES schools(school_id),
  grade_id          INT NOT NULL REFERENCES grade_levels(grade_id),
  first_name        VARCHAR(80) NOT NULL,
  last_name         VARCHAR(80) NOT NULL,
  student_number    VARCHAR(20) NOT NULL UNIQUE,
  enrollment_status enrollment_status NOT NULL DEFAULT 'active',
  enrollment_date   DATE NOT NULL,
  withdrawal_date   DATE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instructional_groups (
  group_id      SERIAL PRIMARY KEY,
  school_id     INT NOT NULL REFERENCES schools(school_id),
  grade_id      INT NOT NULL REFERENCES grade_levels(grade_id),
  year_id       INT NOT NULL REFERENCES academic_years(year_id),
  staff_id      INT NOT NULL REFERENCES staff(staff_id),
  group_name    VARCHAR(100) NOT NULL,
  is_mixed_grade BOOLEAN NOT NULL DEFAULT FALSE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, year_id, group_name)
);

CREATE TABLE IF NOT EXISTS group_memberships (
  membership_id SERIAL PRIMARY KEY,
  group_id      INT NOT NULL REFERENCES instructional_groups(group_id),
  student_id    INT NOT NULL REFERENCES students(student_id),
  joined_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  left_date     DATE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE(group_id, student_id, joined_date)
);


-- ======================== CURRICULUM & ASSESSMENT ============================

CREATE TABLE IF NOT EXISTS ufli_lessons (
  lesson_id     SERIAL PRIMARY KEY,
  lesson_number SMALLINT NOT NULL UNIQUE,
  lesson_name   VARCHAR(150),
  skill_section VARCHAR(50) NOT NULL,
  sort_order    SMALLINT NOT NULL,
  is_review     BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  progress_id   BIGSERIAL PRIMARY KEY,
  student_id    INT NOT NULL REFERENCES students(student_id),
  group_id      INT NOT NULL REFERENCES instructional_groups(group_id),
  lesson_id     INT NOT NULL REFERENCES ufli_lessons(lesson_id),
  year_id       INT NOT NULL REFERENCES academic_years(year_id),
  status        lesson_status NOT NULL,
  date_recorded DATE NOT NULL,
  recorded_by   INT REFERENCES staff(staff_id),
  source        data_source NOT NULL DEFAULT 'form',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, lesson_id, year_id, date_recorded)
);

CREATE TABLE IF NOT EXISTS assessment_sequences (
  sequence_id       SERIAL PRIMARY KEY,
  grade_band        VARCHAR(10) NOT NULL,
  version           VARCHAR(10) NOT NULL,
  sequence_number   SMALLINT NOT NULL,
  lesson_range_start SMALLINT NOT NULL,
  lesson_range_end  SMALLINT NOT NULL,
  UNIQUE(grade_band, version, sequence_number)
);

CREATE TABLE IF NOT EXISTS assessment_results (
  result_id     BIGSERIAL PRIMARY KEY,
  student_id    INT NOT NULL REFERENCES students(student_id),
  sequence_id   INT NOT NULL REFERENCES assessment_sequences(sequence_id),
  year_id       INT NOT NULL REFERENCES academic_years(year_id),
  score         NUMERIC(5,2),
  passed        BOOLEAN NOT NULL,
  date_assessed DATE NOT NULL,
  assessed_by   INT REFERENCES staff(staff_id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, sequence_id, year_id, date_assessed)
);

CREATE TABLE IF NOT EXISTS sounds_catalog (
  sound_id      SERIAL PRIMARY KEY,
  sound         VARCHAR(20) NOT NULL UNIQUE,
  category      VARCHAR(50),
  sort_order    SMALLINT NOT NULL
);

CREATE TABLE IF NOT EXISTS sound_inventory (
  inventory_id  BIGSERIAL PRIMARY KEY,
  student_id    INT NOT NULL REFERENCES students(student_id),
  sound_id      INT NOT NULL REFERENCES sounds_catalog(sound_id),
  year_id       INT NOT NULL REFERENCES academic_years(year_id),
  mastered      BOOLEAN NOT NULL DEFAULT FALSE,
  date_assessed DATE NOT NULL,
  assessed_by   INT REFERENCES staff(staff_id),
  UNIQUE(student_id, sound_id, year_id)
);

CREATE TABLE IF NOT EXISTS tutoring_sessions (
  session_id    BIGSERIAL PRIMARY KEY,
  student_id    INT NOT NULL REFERENCES students(student_id),
  year_id       INT NOT NULL REFERENCES academic_years(year_id),
  tutor_id      INT NOT NULL REFERENCES staff(staff_id),
  session_type  session_type NOT NULL,
  lesson_id     INT REFERENCES ufli_lessons(lesson_id),
  session_date  DATE NOT NULL,
  duration_min  SMALLINT,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ======================== TRACKING & ANALYTICS ===============================

CREATE TABLE IF NOT EXISTS benchmark_records (
  benchmark_id    BIGSERIAL PRIMARY KEY,
  student_id      INT NOT NULL REFERENCES students(student_id),
  year_id         INT NOT NULL REFERENCES academic_years(year_id),
  benchmark_type  benchmark_type NOT NULL,
  band_label      band_label NOT NULL,
  percentage      NUMERIC(5,2) NOT NULL,
  recorded_date   DATE NOT NULL,
  UNIQUE(student_id, year_id, benchmark_type)
);

CREATE TABLE IF NOT EXISTS weekly_snapshots (
  snapshot_id     BIGSERIAL PRIMARY KEY,
  student_id      INT NOT NULL REFERENCES students(student_id),
  year_id         INT NOT NULL REFERENCES academic_years(year_id),
  week_number     SMALLINT NOT NULL,
  week_start_date DATE NOT NULL,
  growth_pct      NUMERIC(5,2) NOT NULL,
  lessons_taken   SMALLINT NOT NULL DEFAULT 0,
  lessons_passed  SMALLINT NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, year_id, week_number)
);

CREATE TABLE IF NOT EXISTS coaching_metrics (
  metric_id         BIGSERIAL PRIMARY KEY,
  group_id          INT NOT NULL REFERENCES instructional_groups(group_id),
  year_id           INT NOT NULL REFERENCES academic_years(year_id),
  week_start_date   DATE NOT NULL,
  reteach_freq      NUMERIC(5,2),
  pass_rate         NUMERIC(5,2),
  growth_slope      NUMERIC(7,4),
  absenteeism_rate  NUMERIC(5,2),
  coaching_priority coaching_priority,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, year_id, week_start_date)
);


-- ======================== SYSTEM & ADMIN ====================================

CREATE TABLE IF NOT EXISTS feature_settings (
  setting_id    SERIAL PRIMARY KEY,
  school_id     INT NOT NULL REFERENCES schools(school_id),
  feature_key   VARCHAR(100) NOT NULL,
  feature_value TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(school_id, feature_key)
);

CREATE TABLE IF NOT EXISTS import_log (
  import_id       SERIAL PRIMARY KEY,
  school_id       INT NOT NULL REFERENCES schools(school_id),
  import_type     VARCHAR(50) NOT NULL,
  file_name       VARCHAR(255),
  records_total   INT NOT NULL DEFAULT 0,
  records_success INT NOT NULL DEFAULT 0,
  records_failed  INT NOT NULL DEFAULT 0,
  status          import_status NOT NULL DEFAULT 'pending',
  imported_by     INT REFERENCES staff(staff_id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS import_exceptions (
  exception_id  BIGSERIAL PRIMARY KEY,
  import_id     INT NOT NULL REFERENCES import_log(import_id),
  student_ref   VARCHAR(100),
  field_name    VARCHAR(100),
  error_msg     TEXT NOT NULL,
  raw_value     TEXT,
  resolved      BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_by   INT REFERENCES staff(staff_id),
  resolved_at   TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS audit_log (
  log_id        BIGSERIAL PRIMARY KEY,
  school_id     INT NOT NULL REFERENCES schools(school_id),
  user_id       INT REFERENCES staff(staff_id),
  action        VARCHAR(50) NOT NULL,
  table_name    VARCHAR(50),
  record_id     BIGINT,
  old_value     JSONB,
  new_value     JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ======================== RLS HELPER FUNCTIONS ===============================

CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS INT LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'school_id')::INT, 0
  );
$$;

CREATE OR REPLACE FUNCTION public.is_tilt_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'app_metadata' ->> 'is_tilt_admin')::BOOLEAN, FALSE
  );
$$;


-- ======================== RLS POLICIES ======================================

-- Enable RLS on all tables
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_years ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grade_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructional_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ufli_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assessment_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sounds_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sound_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tutoring_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.benchmark_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coaching_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.import_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Reference tables: all authenticated users can read
CREATE POLICY "read_grade_levels" ON public.grade_levels FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "read_ufli_lessons" ON public.ufli_lessons FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "read_assessment_sequences" ON public.assessment_sequences FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "read_sounds_catalog" ON public.sounds_catalog FOR SELECT USING (auth.role() = 'authenticated');

-- School-scoped tables: users can only access their own school's data
CREATE POLICY "school_scoped" ON public.schools FOR ALL
  USING (school_id = public.current_user_school_id() OR public.is_tilt_admin())
  WITH CHECK (school_id = public.current_user_school_id() OR public.is_tilt_admin());

CREATE POLICY "school_scoped" ON public.academic_years FOR ALL
  USING (school_id = public.current_user_school_id() OR public.is_tilt_admin())
  WITH CHECK (school_id = public.current_user_school_id() OR public.is_tilt_admin());

CREATE POLICY "school_scoped" ON public.staff FOR ALL
  USING (school_id = public.current_user_school_id() OR public.is_tilt_admin())
  WITH CHECK (school_id = public.current_user_school_id() OR public.is_tilt_admin());

CREATE POLICY "school_scoped" ON public.students FOR ALL
  USING (school_id = public.current_user_school_id() OR public.is_tilt_admin())
  WITH CHECK (school_id = public.current_user_school_id() OR public.is_tilt_admin());

CREATE POLICY "school_scoped" ON public.instructional_groups FOR ALL
  USING (school_id = public.current_user_school_id() OR public.is_tilt_admin())
  WITH CHECK (school_id = public.current_user_school_id() OR public.is_tilt_admin());

CREATE POLICY "school_scoped" ON public.feature_settings FOR ALL
  USING (school_id = public.current_user_school_id() OR public.is_tilt_admin())
  WITH CHECK (school_id = public.current_user_school_id() OR public.is_tilt_admin());

CREATE POLICY "school_scoped" ON public.import_log FOR ALL
  USING (school_id = public.current_user_school_id() OR public.is_tilt_admin())
  WITH CHECK (school_id = public.current_user_school_id() OR public.is_tilt_admin());

-- Join-scoped tables (school_id via parent table)
CREATE POLICY "school_via_group" ON public.group_memberships FOR ALL
  USING (EXISTS (SELECT 1 FROM public.instructional_groups g WHERE g.group_id = group_memberships.group_id AND (g.school_id = public.current_user_school_id() OR public.is_tilt_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.instructional_groups g WHERE g.group_id = group_memberships.group_id AND (g.school_id = public.current_user_school_id() OR public.is_tilt_admin())));

CREATE POLICY "school_via_student" ON public.lesson_progress FOR ALL
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.student_id = lesson_progress.student_id AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.student_id = lesson_progress.student_id AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())));

CREATE POLICY "school_via_student" ON public.assessment_results FOR ALL
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.student_id = assessment_results.student_id AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.student_id = assessment_results.student_id AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())));

CREATE POLICY "school_via_student" ON public.sound_inventory FOR ALL
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.student_id = sound_inventory.student_id AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.student_id = sound_inventory.student_id AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())));

CREATE POLICY "school_via_student" ON public.tutoring_sessions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.student_id = tutoring_sessions.student_id AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.student_id = tutoring_sessions.student_id AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())));

CREATE POLICY "school_via_student" ON public.benchmark_records FOR ALL
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.student_id = benchmark_records.student_id AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.student_id = benchmark_records.student_id AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())));

CREATE POLICY "school_via_student" ON public.weekly_snapshots FOR ALL
  USING (EXISTS (SELECT 1 FROM public.students s WHERE s.student_id = weekly_snapshots.student_id AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.students s WHERE s.student_id = weekly_snapshots.student_id AND (s.school_id = public.current_user_school_id() OR public.is_tilt_admin())));

CREATE POLICY "school_via_group" ON public.coaching_metrics FOR ALL
  USING (EXISTS (SELECT 1 FROM public.instructional_groups g WHERE g.group_id = coaching_metrics.group_id AND (g.school_id = public.current_user_school_id() OR public.is_tilt_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.instructional_groups g WHERE g.group_id = coaching_metrics.group_id AND (g.school_id = public.current_user_school_id() OR public.is_tilt_admin())));

CREATE POLICY "school_via_import" ON public.import_exceptions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.import_log il WHERE il.import_id = import_exceptions.import_id AND (il.school_id = public.current_user_school_id() OR public.is_tilt_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.import_log il WHERE il.import_id = import_exceptions.import_id AND (il.school_id = public.current_user_school_id() OR public.is_tilt_admin())));

-- Audit log: append-only (D-004)
CREATE POLICY "audit_read" ON public.audit_log FOR SELECT
  USING (school_id = public.current_user_school_id() OR public.is_tilt_admin());
CREATE POLICY "audit_insert" ON public.audit_log FOR INSERT
  WITH CHECK (school_id = public.current_user_school_id() OR public.is_tilt_admin());


-- ======================== CUSTOM CLAIMS HOOK ================================

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  claims jsonb;
  staff_record RECORD;
  user_id uuid;
BEGIN
  user_id := (event -> 'user_id')::text::uuid;

  SELECT s.school_id, s.role, s.staff_id
  INTO staff_record
  FROM public.staff s
  WHERE s.auth_uid = user_id::text AND s.is_active = TRUE
  LIMIT 1;

  claims := event -> 'claims';

  IF staff_record IS NOT NULL THEN
    claims := jsonb_set(claims, '{app_metadata, school_id}', to_jsonb(staff_record.school_id));
    claims := jsonb_set(claims, '{app_metadata, role}', to_jsonb(staff_record.role::text));
    claims := jsonb_set(claims, '{app_metadata, is_tilt_admin}', to_jsonb(staff_record.role::text = 'tilt_admin'));
    claims := jsonb_set(claims, '{app_metadata, staff_id}', to_jsonb(staff_record.staff_id));
  ELSE
    claims := jsonb_set(claims, '{app_metadata, school_id}', '0');
    claims := jsonb_set(claims, '{app_metadata, role}', '"tutor"');
    claims := jsonb_set(claims, '{app_metadata, is_tilt_admin}', 'false');
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

GRANT EXECUTE ON FUNCTION public.custom_access_token_hook TO supabase_auth_admin;
REVOKE EXECUTE ON FUNCTION public.custom_access_token_hook FROM authenticated, anon, public;


-- ======================== SEED: GRADE LEVELS ================================

INSERT INTO grade_levels (name, sort_order, grade_band) VALUES
  ('PK', -1, 'PreK'), ('KG', 0, 'K-2'), ('G1', 1, 'K-2'), ('G2', 2, 'K-2'),
  ('G3', 3, '3-5'), ('G4', 4, '3-5'), ('G5', 5, '3-5'),
  ('G6', 6, '6-8'), ('G7', 7, '6-8'), ('G8', 8, '6-8')
ON CONFLICT (name) DO NOTHING;


-- ======================== SEED: 128 UFLI LESSONS ============================

INSERT INTO ufli_lessons (lesson_number, lesson_name, skill_section, sort_order, is_review) VALUES
  (1,'a /ā/','Single Consonants & Vowels',1,FALSE),(2,'m /m/','Single Consonants & Vowels',2,FALSE),
  (3,'s /s/','Single Consonants & Vowels',3,FALSE),(4,'t /t/','Single Consonants & Vowels',4,FALSE),
  (5,'VC & CVC Words','Single Consonants & Vowels',5,FALSE),(6,'p /p/','Single Consonants & Vowels',6,FALSE),
  (7,'f /f/','Single Consonants & Vowels',7,FALSE),(8,'i /ī/','Single Consonants & Vowels',8,FALSE),
  (9,'n /n/','Single Consonants & Vowels',9,FALSE),(10,'CVC Practice (a, i)','Single Consonants & Vowels',10,FALSE),
  (11,'Nasalized A (am, an)','Single Consonants & Vowels',11,FALSE),(12,'o /ō/','Single Consonants & Vowels',12,FALSE),
  (13,'d /d/','Single Consonants & Vowels',13,FALSE),(14,'c /k/','Single Consonants & Vowels',14,FALSE),
  (15,'u /ū/','Single Consonants & Vowels',15,FALSE),(16,'g /g/','Single Consonants & Vowels',16,FALSE),
  (17,'b /b/','Single Consonants & Vowels',17,FALSE),(18,'e /ē/','Single Consonants & Vowels',18,FALSE),
  (19,'VC & CVC practice (all)','Single Consonants & Vowels',19,FALSE),(20,'-s /s/','Single Consonants & Vowels',20,FALSE),
  (21,'-s /z/','Single Consonants & Vowels',21,FALSE),(22,'k /k/','Single Consonants & Vowels',22,FALSE),
  (23,'h /h/','Single Consonants & Vowels',23,FALSE),(24,'r /r/ part 1','Single Consonants & Vowels',24,FALSE),
  (25,'r /r/ part 2','Blends',25,FALSE),(26,'l /l/ part 1','Single Consonants & Vowels',26,FALSE),
  (27,'l /l/ part 2, al','Blends',27,FALSE),(28,'w /w/','Single Consonants & Vowels',28,FALSE),
  (29,'j /j/','Single Consonants & Vowels',29,FALSE),(30,'y /y/','Single Consonants & Vowels',30,FALSE),
  (31,'x /ks/','Single Consonants & Vowels',31,FALSE),(32,'qu /kw/','Single Consonants & Vowels',32,FALSE),
  (33,'v /v/','Single Consonants & Vowels',33,FALSE),(34,'z /z/','Single Consonants & Vowels',34,FALSE),
  (35,'Short A Review','Alphabet Review & Longer Words',35,TRUE),(36,'Short I Review','Alphabet Review & Longer Words',36,TRUE),
  (37,'Short O Review','Alphabet Review & Longer Words',37,TRUE),(38,'Short A, I, O Review','Alphabet Review & Longer Words',38,FALSE),
  (39,'Short U Review','Alphabet Review & Longer Words',39,TRUE),(40,'Short E Review','Alphabet Review & Longer Words',40,TRUE),
  (41,'Short Vowels Review (all)','Alphabet Review & Longer Words',41,TRUE),
  (42,'FLSZ spelling rule','Digraphs',42,FALSE),(43,'-all, -oll, -ull','Digraphs',43,FALSE),
  (44,'ck /k/','Digraphs',44,FALSE),(45,'sh /sh/','Digraphs',45,FALSE),
  (46,'Voiced th /th/','Digraphs',46,FALSE),(47,'Unvoiced th /th/','Digraphs',47,FALSE),
  (48,'ch /ch/','Digraphs',48,FALSE),(49,'Digraphs Review 1','Digraphs',49,TRUE),
  (50,'wh /w/ ph /f/','Digraphs',50,FALSE),(51,'ng /n/','Digraphs',51,FALSE),
  (52,'nk /nk/','Digraphs',52,FALSE),(53,'Digraphs Review 2','Digraphs',53,TRUE),
  (54,'a_e /ā/','VCE',54,FALSE),(55,'i_e /ī/','VCE',55,FALSE),
  (56,'o_e /ō/','VCE',56,FALSE),(57,'VCe Review 1','VCE',57,TRUE),
  (58,'u_e /ū/ /yū/','VCE',58,FALSE),(59,'VCe Review 2 (all)','VCE',59,TRUE),
  (60,'_ce /s/','VCE',60,FALSE),(61,'_ge /j/','VCE',61,FALSE),
  (62,'VCe Review 3','VCE',62,TRUE),
  (63,'-es','Reading Longer Words',63,FALSE),(64,'-ed','Reading Longer Words',64,FALSE),
  (65,'-ing','Reading Longer Words',65,FALSE),(66,'Closed & Open Syllables','Reading Longer Words',66,FALSE),
  (67,'Closed/Closed','Reading Longer Words',67,FALSE),(68,'Open/Closed','Reading Longer Words',68,FALSE),
  (69,'tch /ch/','Ending Spelling Patterns',69,FALSE),(70,'dge /j/','Ending Spelling Patterns',70,FALSE),
  (71,'tch/dge Review','Ending Spelling Patterns',71,TRUE),(72,'Long VCC','Ending Spelling Patterns',72,FALSE),
  (73,'y /ī/','Ending Spelling Patterns',73,FALSE),(74,'y /ē/','Ending Spelling Patterns',74,FALSE),
  (75,'-le','Ending Spelling Patterns',75,FALSE),(76,'Ending Patterns Review','Ending Spelling Patterns',76,TRUE),
  (77,'ar /ar/','R-Controlled Vowels',77,FALSE),(78,'or, ore /or/','R-Controlled Vowels',78,FALSE),
  (79,'ar & or Review','R-Controlled Vowels',79,TRUE),(80,'er /er/','R-Controlled Vowels',80,FALSE),
  (81,'ir, ur /er/','R-Controlled Vowels',81,FALSE),(82,'Spelling /er/','R-Controlled Vowels',82,FALSE),
  (83,'R-Controlled Review','R-Controlled Vowels',83,TRUE),
  (84,'ai ay /ā/','Long Vowel Teams',84,FALSE),(85,'ee, ea, ey /ē/','Long Vowel Teams',85,FALSE),
  (86,'oa, ow, oe /ō/','Long Vowel Teams',86,FALSE),(87,'ie, igh /ī/','Long Vowel Teams',87,FALSE),
  (88,'Vowel Teams Review 1','Long Vowel Teams',88,TRUE),
  (89,'oo, u /oo/','Other Vowel Teams',89,FALSE),(90,'oo /ū/','Other Vowel Teams',90,FALSE),
  (91,'ew, ui, ue /ū/','Other Vowel Teams',91,FALSE),(92,'Vowel Teams Review 2','Other Vowel Teams',92,TRUE),
  (93,'au, aw, augh /aw/','Other Vowel Teams',93,FALSE),(94,'ea /ē/, a /ō/','Other Vowel Teams',94,FALSE),
  (95,'oi, oy /oi/','Diphthongs',95,FALSE),(96,'ou, ow /ow/','Diphthongs',96,FALSE),
  (97,'Diphthongs Review','Diphthongs',97,TRUE),
  (98,'kn, wr, mb','Silent Letters',98,FALSE),
  (99,'-s/-es','Suffixes & Prefixes',99,FALSE),(100,'-er/-est','Suffixes & Prefixes',100,FALSE),
  (101,'-ly','Suffixes & Prefixes',101,FALSE),(102,'-less, -ful','Suffixes & Prefixes',102,TRUE),
  (103,'un-','Suffixes & Prefixes',103,FALSE),(104,'pre-, re-','Suffixes & Prefixes',104,TRUE),
  (105,'dis-','Suffixes & Prefixes',105,TRUE),(106,'Affixes Review 1','Suffixes & Prefixes',106,TRUE),
  (107,'Doubling Rule -ed, -ing','Suffix Spelling Changes',107,FALSE),
  (108,'Doubling Rule -er, -est','Suffix Spelling Changes',108,FALSE),
  (109,'Drop -e Rule','Suffix Spelling Changes',109,FALSE),(110,'-y to I Rule','Suffix Spelling Changes',110,FALSE),
  (111,'-ar, -or /er/','Low Frequency Spellings',111,FALSE),(112,'air, are, ear /air/','Low Frequency Spellings',112,FALSE),
  (113,'ear /ear/','Low Frequency Spellings',113,FALSE),(114,'Alternate /ā/','Low Frequency Spellings',114,FALSE),
  (115,'Alternate Long U','Low Frequency Spellings',115,FALSE),(116,'ough','Low Frequency Spellings',116,FALSE),
  (117,'Signal Vowels','Low Frequency Spellings',117,FALSE),(118,'ch/gn/gh/silent t','Low Frequency Spellings',118,FALSE),
  (119,'-sion, -tion','Additional Affixes',119,FALSE),(120,'-ture','Additional Affixes',120,FALSE),
  (121,'-er, -or, -ist','Additional Affixes',121,FALSE),(122,'-ish','Additional Affixes',122,FALSE),
  (123,'-y','Additional Affixes',123,FALSE),(124,'-ness','Additional Affixes',124,FALSE),
  (125,'-ment','Additional Affixes',125,FALSE),(126,'-able, -ible','Additional Affixes',126,FALSE),
  (127,'uni-, bi-, tri-','Additional Affixes',127,FALSE),(128,'Affixes Review 2','Additional Affixes',128,TRUE)
ON CONFLICT (lesson_number) DO NOTHING;


-- ======================== STARTER DATA ======================================

-- Create the first school
INSERT INTO schools (name, short_code, city, state)
VALUES ('TILT Pilot School', 'PILOT', 'Indianapolis', 'IN')
ON CONFLICT (short_code) DO NOTHING;

-- Create the first academic year
INSERT INTO academic_years (school_id, label, start_date, end_date, is_current)
VALUES (1, 'FY26', '2025-08-01', '2026-06-30', TRUE)
ON CONFLICT (school_id, label) DO NOTHING;


-- ======================== DONE ==============================================
-- After running this, you need to:
-- 1. Enable the custom access token hook in Authentication > Hooks
-- 2. Sign up in the app
-- 3. Link your account (see next SQL block)
-- =============================================================================
