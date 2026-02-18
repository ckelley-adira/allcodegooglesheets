#!/usr/bin/env node
/**
 * Validation Script: SharedConstants Integration
 * 
 * This script validates that all Phase2_ProgressTracking.gs files properly
 * reference the SharedConstants.gs module without defining their own versions
 * of the shared constants.
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

// Schools to validate
const SCHOOLS = [
  'Adelante',
  'Allegiant',
  'CCA',
  'CHAW',
  'GlobalPrep',
  'Sankofa'
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

// 2. Validate each school's Phase2 file
console.log('2. Checking Phase2 files for proper integration...\n');

for (const school of SCHOOLS) {
  const phase2Path = path.join(REPO_ROOT, `${school}Phase2_ProgressTracking.gs`);
  
  if (!fs.existsSync(phase2Path)) {
    console.error(`   ❌ ${school}: Phase2 file not found at ${phase2Path}`);
    allValid = false;
    continue;
  }
  
  const phase2Content = fs.readFileSync(phase2Path, 'utf8');
  
  // Check that shared constants are NOT redefined
  let hasLocalDef = false;
  for (const constant of SHARED_CONSTANTS) {
    const declRegex = new RegExp(`^\\s*(const|var)\\s+${constant}\\s*=`, 'm');
    if (declRegex.test(phase2Content)) {
      console.error(`   ❌ ${school}: ${constant} is LOCALLY DEFINED (should use SharedConstants)`);
      hasLocalDef = true;
      allValid = false;
    }
  }
  
  if (hasLocalDef) {
    continue;
  }
  
  // Check that shared constants ARE referenced
  let refCount = 0;
  for (const constant of SHARED_CONSTANTS) {
    const refRegex = new RegExp(`\\b${constant}\\b`, 'g');
    const matches = phase2Content.match(refRegex) || [];
    refCount += matches.length;
  }
  
  // Check for documentation comment about SharedConstants
  const hasDocComment = phase2Content.includes('SHARED CONSTANTS - Imported from SharedConstants.gs') ||
                        phase2Content.includes('SharedConstants.gs');
  
  if (refCount > 0 && hasDocComment) {
    console.log(`   ✅ ${school}: ${refCount} references to shared constants, documented`);
    totalReferences += refCount;
  } else if (refCount > 0) {
    console.log(`   ⚠️  ${school}: ${refCount} references but missing documentation comment`);
    totalReferences += refCount;
  } else {
    console.error(`   ❌ ${school}: No references to shared constants found`);
    allValid = false;
  }
}

console.log('\n═══════════════════════════════════════════════════════════════');
console.log('VALIDATION SUMMARY');
console.log('═══════════════════════════════════════════════════════════════');
console.log(`Total schools validated: ${SCHOOLS.length}`);
console.log(`Total references to shared constants: ${totalReferences}`);

// 3. Validate Phase 7 unified template files exist
console.log('\n3. Checking Phase 7 unified template files...\n');

const PHASE7_FILES = [
  'UnifiedConfig.gs',
  'UnifiedPhase2_ProgressTracking.gs'
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
    }
    
    if (file === 'UnifiedPhase2_ProgressTracking.gs') {
      if (content.includes('function generateSystemSheets(')) {
        console.log(`      ✅ generateSystemSheets() defined`);
      } else {
        console.error(`      ❌ generateSystemSheets() NOT defined`);
        allValid = false;
      }
      if (content.includes('function recalculateAllStatsNow(')) {
        console.log(`      ✅ recalculateAllStatsNow() defined`);
      } else {
        console.error(`      ❌ recalculateAllStatsNow() NOT defined`);
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
