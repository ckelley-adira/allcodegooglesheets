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

if (allValid) {
  console.log('\n✅ ALL VALIDATIONS PASSED');
  console.log('SharedConstants integration is correct and ready for deployment.\n');
  process.exit(0);
} else {
  console.log('\n❌ VALIDATION FAILED');
  console.log('Please fix the errors above before deploying.\n');
  process.exit(1);
}
