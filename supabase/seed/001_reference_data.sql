-- =============================================================================
-- Adira Reads: Reference Data Seed
-- =============================================================================
-- Per D-016, the UFLI_Lesson reference table is seeded from day one.
-- Grade levels are also reference data the platform needs to function.
--
-- Source: gold-standard-template/SharedConstants.gs (LESSON_LABELS, SKILL_SECTIONS, REVIEW_LESSONS)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Grade Levels (KG through G8)
-- ---------------------------------------------------------------------------
INSERT INTO grade_levels (name, sort_order, grade_band) VALUES
  ('PK',  -1, 'PreK'),
  ('KG',   0, 'K-2'),
  ('G1',   1, 'K-2'),
  ('G2',   2, 'K-2'),
  ('G3',   3, '3-5'),
  ('G4',   4, '3-5'),
  ('G5',   5, '3-5'),
  ('G6',   6, '6-8'),
  ('G7',   7, '6-8'),
  ('G8',   8, '6-8')
ON CONFLICT (name) DO NOTHING;


-- ---------------------------------------------------------------------------
-- UFLI Lessons — all 128 lessons with skill sections and review flags
-- ---------------------------------------------------------------------------
-- Source: LESSON_LABELS, SKILL_SECTIONS, and REVIEW_LESSONS from SharedConstants.gs
-- Review lessons (23): 35,36,37,39,40,41,49,53,57,59,62,71,76,79,83,88,92,97,102,104,105,106,128
-- ---------------------------------------------------------------------------

INSERT INTO ufli_lessons (lesson_number, lesson_name, skill_section, sort_order, is_review) VALUES
  -- Single Consonants & Vowels (L1-L34, excluding L25, L27)
  (1,   'a /ā/',                                'Single Consonants & Vowels',   1,   FALSE),
  (2,   'm /m/',                                'Single Consonants & Vowels',   2,   FALSE),
  (3,   's /s/',                                'Single Consonants & Vowels',   3,   FALSE),
  (4,   't /t/',                                'Single Consonants & Vowels',   4,   FALSE),
  (5,   'VC & CVC Words',                       'Single Consonants & Vowels',   5,   FALSE),
  (6,   'p /p/',                                'Single Consonants & Vowels',   6,   FALSE),
  (7,   'f /f/',                                'Single Consonants & Vowels',   7,   FALSE),
  (8,   'i /ī/',                                'Single Consonants & Vowels',   8,   FALSE),
  (9,   'n /n/',                                'Single Consonants & Vowels',   9,   FALSE),
  (10,  'CVC Practice (a, i)',                  'Single Consonants & Vowels',  10,   FALSE),
  (11,  'Nasalized A (am, an)',                 'Single Consonants & Vowels',  11,   FALSE),
  (12,  'o /ō/',                                'Single Consonants & Vowels',  12,   FALSE),
  (13,  'd /d/',                                'Single Consonants & Vowels',  13,   FALSE),
  (14,  'c /k/',                                'Single Consonants & Vowels',  14,   FALSE),
  (15,  'u /ū/',                                'Single Consonants & Vowels',  15,   FALSE),
  (16,  'g /g/',                                'Single Consonants & Vowels',  16,   FALSE),
  (17,  'b /b/',                                'Single Consonants & Vowels',  17,   FALSE),
  (18,  'e /ē/',                                'Single Consonants & Vowels',  18,   FALSE),
  (19,  'VC & CVC practice (all)',              'Single Consonants & Vowels',  19,   FALSE),
  (20,  '-s /s/',                               'Single Consonants & Vowels',  20,   FALSE),
  (21,  '-s /z/',                               'Single Consonants & Vowels',  21,   FALSE),
  (22,  'k /k/',                                'Single Consonants & Vowels',  22,   FALSE),
  (23,  'h /h/',                                'Single Consonants & Vowels',  23,   FALSE),
  (24,  'r /r/ part 1',                         'Single Consonants & Vowels',  24,   FALSE),
  (26,  'l /l/ part 1',                         'Single Consonants & Vowels',  26,   FALSE),
  (28,  'w /w/',                                'Single Consonants & Vowels',  28,   FALSE),
  (29,  'j /j/',                                'Single Consonants & Vowels',  29,   FALSE),
  (30,  'y /y/',                                'Single Consonants & Vowels',  30,   FALSE),
  (31,  'x /ks/',                               'Single Consonants & Vowels',  31,   FALSE),
  (32,  'qu /kw/',                              'Single Consonants & Vowels',  32,   FALSE),
  (33,  'v /v/',                                'Single Consonants & Vowels',  33,   FALSE),
  (34,  'z /z/',                                'Single Consonants & Vowels',  34,   FALSE),

  -- Blends (L25, L27)
  (25,  'r /r/ part 2',                         'Blends',                      25,   FALSE),
  (27,  'l /l/ part 2, al',                     'Blends',                      27,   FALSE),

  -- Alphabet Review & Longer Words (L35-L41)
  (35,  'Short A Review (incl. Nasalized A)',   'Alphabet Review & Longer Words', 35, TRUE),
  (36,  'Short I Review',                       'Alphabet Review & Longer Words', 36, TRUE),
  (37,  'Short O Review',                       'Alphabet Review & Longer Words', 37, TRUE),
  (38,  'Short A, I, O Review',                 'Alphabet Review & Longer Words', 38, FALSE),
  (39,  'Short U Review',                       'Alphabet Review & Longer Words', 39, TRUE),
  (40,  'Short E Review',                       'Alphabet Review & Longer Words', 40, TRUE),
  (41,  'Short Vowels Review (all)',            'Alphabet Review & Longer Words', 41, TRUE),

  -- Digraphs (L42-L53)
  (42,  'FLSZ spelling rule (ff, ll, ss, zz)',  'Digraphs',                   42,   FALSE),
  (43,  '-all, -oll, -ull',                     'Digraphs',                   43,   FALSE),
  (44,  'ck /k/',                               'Digraphs',                   44,   FALSE),
  (45,  'sh /sh/',                              'Digraphs',                   45,   FALSE),
  (46,  'Voiced th /th/',                       'Digraphs',                   46,   FALSE),
  (47,  'Unvoiced th /th/',                     'Digraphs',                   47,   FALSE),
  (48,  'ch /ch/',                              'Digraphs',                   48,   FALSE),
  (49,  'Digraphs Review 1',                    'Digraphs',                   49,   TRUE),
  (50,  'wh /w/ ph /f/',                        'Digraphs',                   50,   FALSE),
  (51,  'ng /n/',                               'Digraphs',                   51,   FALSE),
  (52,  'nk /nk/',                              'Digraphs',                   52,   FALSE),
  (53,  'Digraphs Review 2 (incl. CCCVC)',      'Digraphs',                   53,   TRUE),

  -- VCE (L54-L62)
  (54,  'a_e /ā/',                              'VCE',                        54,   FALSE),
  (55,  'i_e /ī/',                              'VCE',                        55,   FALSE),
  (56,  'o_e /ō/',                              'VCE',                        56,   FALSE),
  (57,  'VCe Review 1, e_e /ē/',               'VCE',                        57,   TRUE),
  (58,  'u_e /ū/ /yū/',                        'VCE',                        58,   FALSE),
  (59,  'VCe Review 2 (all)',                   'VCE',                        59,   TRUE),
  (60,  '_ce /s/',                              'VCE',                        60,   FALSE),
  (61,  '_ge /j/',                              'VCE',                        61,   FALSE),
  (62,  'VCe Review 3, VCe exceptions',         'VCE',                        62,   TRUE),

  -- Reading Longer Words (L63-L68)
  (63,  '-es',                                  'Reading Longer Words',        63,   FALSE),
  (64,  '-ed',                                  'Reading Longer Words',        64,   FALSE),
  (65,  '-ing',                                 'Reading Longer Words',        65,   FALSE),
  (66,  'Closed & Open Syllables',              'Reading Longer Words',        66,   FALSE),
  (67,  'Closed/Closed',                        'Reading Longer Words',        67,   FALSE),
  (68,  'Open/Closed',                          'Reading Longer Words',        68,   FALSE),

  -- Ending Spelling Patterns (L69-L76)
  (69,  'tch /ch/',                             'Ending Spelling Patterns',    69,   FALSE),
  (70,  'dge /j/',                              'Ending Spelling Patterns',    70,   FALSE),
  (71,  'tch/ch/ dge/j/ Review',                'Ending Spelling Patterns',    71,   TRUE),
  (72,  'Long VCC (-ild, -old, -ind, -olt, -ost)', 'Ending Spelling Patterns', 72,  FALSE),
  (73,  'y /ī/',                                'Ending Spelling Patterns',    73,   FALSE),
  (74,  'y /ē/',                                'Ending Spelling Patterns',    74,   FALSE),
  (75,  '-le',                                  'Ending Spelling Patterns',    75,   FALSE),
  (76,  'Ending Patterns Review',               'Ending Spelling Patterns',    76,   TRUE),

  -- R-Controlled Vowels (L77-L83)
  (77,  'ar /ar/',                              'R-Controlled Vowels',         77,   FALSE),
  (78,  'or, ore /or/',                         'R-Controlled Vowels',         78,   FALSE),
  (79,  'ar/ar/ & or,ore/or/ Review',           'R-Controlled Vowels',         79,   TRUE),
  (80,  'er /er/',                              'R-Controlled Vowels',         80,   FALSE),
  (81,  'ir, ur /er/',                          'R-Controlled Vowels',         81,   FALSE),
  (82,  'Spelling /er/: er, ir, ur, w + or',    'R-Controlled Vowels',         82,   FALSE),
  (83,  'R-Controlled Vowels Review',           'R-Controlled Vowels',         83,   TRUE),

  -- Long Vowel Teams (L84-L88)
  (84,  'ai ay /ā/',                            'Long Vowel Teams',            84,   FALSE),
  (85,  'ee, ea, ey /ē/',                       'Long Vowel Teams',            85,   FALSE),
  (86,  'oa, ow, oe /ō/',                       'Long Vowel Teams',            86,   FALSE),
  (87,  'ie, igh /ī/',                          'Long Vowel Teams',            87,   FALSE),
  (88,  'Vowel Teams Review 1',                 'Long Vowel Teams',            88,   TRUE),

  -- Other Vowel Teams (L89-L94)
  (89,  'oo, u /oo/',                           'Other Vowel Teams',           89,   FALSE),
  (90,  'oo /ū/',                               'Other Vowel Teams',           90,   FALSE),
  (91,  'ew, ui, ue /ū/',                       'Other Vowel Teams',           91,   FALSE),
  (92,  'Vowel Teams Review 2',                 'Other Vowel Teams',           92,   TRUE),
  (93,  'au, aw, augh /aw/',                    'Other Vowel Teams',           93,   FALSE),
  (94,  'ea /ē/, a /ō/',                        'Other Vowel Teams',           94,   FALSE),

  -- Diphthongs (L95-L97)
  (95,  'oi, oy /oi/',                          'Diphthongs',                  95,   FALSE),
  (96,  'ou, ow /ow/',                          'Diphthongs',                  96,   FALSE),
  (97,  'Vowel Teams & Diphthongs Review',      'Diphthongs',                  97,   TRUE),

  -- Silent Letters (L98)
  (98,  'kn /n/, wr /r/, mb /m/',               'Silent Letters',              98,   FALSE),

  -- Suffixes & Prefixes (L99-L106)
  (99,  '-s/-es',                               'Suffixes & Prefixes',         99,   FALSE),
  (100, '-er/-est',                             'Suffixes & Prefixes',        100,   FALSE),
  (101, '-ly',                                  'Suffixes & Prefixes',        101,   FALSE),
  (102, '-less, -ful',                          'Suffixes & Prefixes',        102,   TRUE),
  (103, 'un-',                                  'Suffixes & Prefixes',        103,   FALSE),
  (104, 'pre-, re-',                            'Suffixes & Prefixes',        104,   TRUE),
  (105, 'dis-',                                 'Suffixes & Prefixes',        105,   TRUE),
  (106, 'Affixes Review 1',                     'Suffixes & Prefixes',        106,   TRUE),

  -- Suffix Spelling Changes (L107-L110)
  (107, 'Doubling Rule -ed, -ing',              'Suffix Spelling Changes',    107,   FALSE),
  (108, 'Doubling Rule -er, -est',              'Suffix Spelling Changes',    108,   FALSE),
  (109, 'Drop -e Rule',                         'Suffix Spelling Changes',    109,   FALSE),
  (110, '-y to I Rule',                         'Suffix Spelling Changes',    110,   FALSE),

  -- Low Frequency Spellings (L111-L118)
  (111, '-ar, -or /er/',                        'Low Frequency Spellings',    111,   FALSE),
  (112, 'air, are, ear /air/',                  'Low Frequency Spellings',    112,   FALSE),
  (113, 'ear /ear/',                            'Low Frequency Spellings',    113,   FALSE),
  (114, 'Alternate /ā/ (ei, ey, eigh, aigh, ea)', 'Low Frequency Spellings', 114,   FALSE),
  (115, 'Alternate Long U (ew, eui, ue /yū/; ou /ū/)', 'Low Frequency Spellings', 115, FALSE),
  (116, 'ough /aw/, /ō/',                       'Low Frequency Spellings',    116,   FALSE),
  (117, 'Signal Vowels (c /s/, g /j/)',         'Low Frequency Spellings',    117,   FALSE),
  (118, 'ch /sh/, /k/; gn /n/, gh /g/; silent t', 'Low Frequency Spellings', 118,   FALSE),

  -- Additional Affixes (L119-L128)
  (119, '-sion, -tion',                         'Additional Affixes',         119,   FALSE),
  (120, '-ture',                                'Additional Affixes',         120,   FALSE),
  (121, '-er, -or, -ist',                       'Additional Affixes',         121,   FALSE),
  (122, '-ish',                                 'Additional Affixes',         122,   FALSE),
  (123, '-y',                                   'Additional Affixes',         123,   FALSE),
  (124, '-ness',                                'Additional Affixes',         124,   FALSE),
  (125, '-ment',                                'Additional Affixes',         125,   FALSE),
  (126, '-able, -ible',                         'Additional Affixes',         126,   FALSE),
  (127, 'uni-, bi-, tri-',                      'Additional Affixes',         127,   FALSE),
  (128, 'Affixes Review 2',                     'Additional Affixes',         128,   TRUE)
ON CONFLICT (lesson_number) DO NOTHING;
