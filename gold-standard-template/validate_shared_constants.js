#!/usr/bin/env node
/**
 * Validation Script: SharedConstants Integration
 * 
 * This script validates that Phase2_ProgressTracking.gs properly references
 * the SharedConstants.gs module without defining its own versions of the
 * shared constants, and that Phase 7 unified template files exist.
 * 
 * Usage: node validate_shared_constants.js
 */

const fs = require('fs');
const path = require('path');

// Constants to check for - these should NOT be defined in Phase2 files
const SHARED_CONSTANTS = [
  'LESSON_LABELS',
  'SKILL_SECTIONS', 
  'REVIEW_LESSONS',
  'REVIEW_LESSONS_SET',
  'PERFORMANCE_THRESHOLDS',
  'STATUS_LABELS'
];

const REPO_ROOT = __dirname;

console.log('═══════════════════════════════════════════════════════════════');
console.log('VALIDATING SHAREDCONSTANTS INTEGRATION');
console.log('═══════════════════════════════════════════════════════════════\n');

let allValid = true;
let totalReferences = 0;

// 1. Validate SharedConstants.gs exists and has all constants
console.log('1. Checking SharedConstants.gs...');
const sharedConstantsPath = path.join(REPO_ROOT, 'SharedConstants.gs');
if (!fs.existsSync(sharedConstantsPath)) {
  console.error('   ❌ ERROR: SharedConstants.gs not found!');
  allValid = false;
} else {
  const sharedConstantsContent = fs.readFileSync(sharedConstantsPath, 'utf8');
  
  for (const constant of SHARED_CONSTANTS) {
    // Check for const/var declaration
    const declRegex = new RegExp(`(const|var)\\s+${constant}\\s*=`, 'm');
    if (declRegex.test(sharedConstantsContent)) {
      console.log(`   ✅ ${constant} defined`);
    } else {
      console.error(`   ❌ ${constant} NOT defined`);
      allValid = false;
    }
  }
  console.log('');
}

// 2. Validate unified Phase2 file does not redefine shared constants
console.log('2. Checking Phase2_ProgressTracking.gs for proper integration...\n');

const phase2Path = path.join(REPO_ROOT, 'Phase2_ProgressTracking.gs');
if (!fs.existsSync(phase2Path)) {
  console.error('   ❌ Phase2_ProgressTracking.gs not found');
  allValid = false;
} else {
  const phase2Content = fs.readFileSync(phase2Path, 'utf8');
  
  // Check that shared constants are NOT redefined locally
  let hasLocalDef = false;
  for (const constant of SHARED_CONSTANTS) {
    const declRegex = new RegExp(`^\\s*(const|var)\\s+${constant}\\s*=`, 'm');
    if (declRegex.test(phase2Content)) {
      console.error(`   ❌ ${constant} is LOCALLY DEFINED (should use SharedConstants)`);
      hasLocalDef = true;
      allValid = false;
    }
  }
  
  if (!hasLocalDef) {
    // Check that shared constants ARE referenced
    let refCount = 0;
    for (const constant of SHARED_CONSTANTS) {
      const refRegex = new RegExp(`\\b${constant}\\b`, 'g');
      const matches = phase2Content.match(refRegex) || [];
      refCount += matches.length;
    }
    totalReferences += refCount;
    console.log(`   ✅ Phase2_ProgressTracking.gs: ${refCount} references to shared constants, no local redefinitions`);
  }
}

// 3. Validate Phase 7 unified template files exist
console.log('\n3. Checking Phase 7 unified template files...\n');

const PHASE7_FILES = [
  'UnifiedConfig.gs',
  'Phase2_ProgressTracking.gs'
];

for (const file of PHASE7_FILES) {
  const filePath = path.join(REPO_ROOT, file);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    console.log(`   ✅ ${file} exists (${(content.length / 1024).toFixed(1)} KB)`);
    
    // Check for key function definitions
    if (file === 'UnifiedConfig.gs') {
      if (content.includes('function getUnifiedConfig()')) {
        console.log(`      ✅ getUnifiedConfig() defined`);
      } else {
        console.error(`      ❌ getUnifiedConfig() NOT defined`);
        allValid = false;
      }
      if (content.includes('GRADE_RANGE_MODELS')) {
        console.log(`      ✅ GRADE_RANGE_MODELS defined`);
      } else {
        console.error(`      ❌ GRADE_RANGE_MODELS NOT defined`);
        allValid = false;
      }
      if (content.includes('function getGradeRangeModels()')) {
        console.log(`      ✅ getGradeRangeModels() defined`);
      } else {
        console.error(`      ❌ getGradeRangeModels() NOT defined`);
        allValid = false;
      }
      if (content.includes('function getDefaultGradesForModel(')) {
        console.log(`      ✅ getDefaultGradesForModel() defined`);
      } else {
        console.error(`      ❌ getDefaultGradesForModel() NOT defined`);
        allValid = false;
      }
      if (content.includes('function validateUnifiedConfig(')) {
        console.log(`      ✅ validateUnifiedConfig() defined`);
      } else {
        console.error(`      ❌ validateUnifiedConfig() NOT defined`);
        allValid = false;
      }
    }
    
    if (file === 'Phase2_ProgressTracking.gs') {
      if (content.includes('function generateSystemSheets(')) {
        console.log(`      ✅ generateSystemSheets() defined`);
      } else {
        console.error(`      ❌ generateSystemSheets() NOT defined`);
        allValid = false;
      }
    }
  } else {
    console.error(`   ❌ ${file} NOT found`);
    allValid = false;
  }
}

// 4. Validate SiteConfig_TEMPLATE.gs has Phase 7 settings
console.log('\n4. Checking SiteConfig_TEMPLATE.gs for Phase 7 settings...\n');

const siteConfigPath = path.join(REPO_ROOT, 'SiteConfig_TEMPLATE.gs');
if (fs.existsSync(siteConfigPath)) {
  const siteConfigContent = fs.readFileSync(siteConfigPath, 'utf8');
  
  const phase7Settings = ['gradeRangeModel', 'gradesServed', 'layout:', 'headerRowCount', 'dataStartRow'];
  for (const setting of phase7Settings) {
    if (siteConfigContent.includes(setting)) {
      console.log(`   ✅ ${setting} found in SiteConfig_TEMPLATE.gs`);
    } else {
      console.error(`   ❌ ${setting} NOT found in SiteConfig_TEMPLATE.gs`);
      allValid = false;
    }
  }
} else {
  console.error('   ❌ SiteConfig_TEMPLATE.gs NOT found');
  allValid = false;
}

console.log('\n═══════════════════════════════════════════════════════════════');

if (allValid) {
  console.log('\n✅ ALL VALIDATIONS PASSED');
  console.log('SharedConstants integration and Phase 7 unified template are correct.\n');
  process.exit(0);
} else {
  console.log('\n❌ VALIDATION FAILED');
  console.log('Please fix the errors above before deploying.\n');
  process.exit(1);
}
