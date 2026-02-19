/**
 * =============================================================================
 * ADELANTE BRANDING EXTENSIONS
 * =============================================================================
 * 
 * School: Adelante Bilingual Academy
 * 
 * Purpose:
 * This file contains Adelante-specific branding functions extracted from
 * AdelantePhase2_ProgressTracking.gs. These functions extend the unified
 * Phase2_ProgressTracking_Unified.gs with dynamic branding capabilities.
 * 
 * Feature Flags:
 * - dynamicBranding: Enables dynamic loading of branding from Site Configuration
 * - studentNormalization: Enables student name normalization functionality
 * 
 * Dependencies:
 * - SITE_CONFIG.branding: Configuration object containing:
 *   - PRIMARY_COLOR: School's primary brand color (hex)
 *   - SECONDARY_COLOR: School's secondary/accent color (hex)
 *   - LOGO_FILE_ID: Google Drive file ID or URL for school logo
 * 
 * Configuration Sheet Reference:
 * - Row 24: Primary Color
 * - Row 25: Secondary Color
 * - Row 26: Logo File ID
 * 
 * Functions Included:
 * 1. loadSchoolBranding() - Loads branding from Site Configuration
 * 2. insertSheetLogo() - Inserts school logo on sheets
 * 3. applySheetBranding() - Applies custom branding to sheets
 * 4. clearBrandingCache() - Clears cached branding data
 * 5. lightenColor() - Color manipulation utility
 * 6. normalizeStudent() - Student data normalization
 * 
 * Usage:
 * These functions should be called from AdelantePhase2_ProgressTracking.gs
 * when the dynamicBranding or studentNormalization feature flags are enabled.
 * =============================================================================
 */

// ═══════════════════════════════════════════════════════════════════════════
// BRANDING CACHE
// ═══════════════════════════════════════════════════════════════════════════

// Cache for branding settings (loaded once per execution)
let _brandingCache = null;

/**
 * Clears the branding cache
 * Call this when branding configuration changes to force reload
 */
function clearBrandingCache() {
  _brandingCache = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// BRANDING CONFIGURATION LOADER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Loads school branding from Site Configuration sheet
 * Falls back to defaults if not configured
 * @returns {Object} Branding settings
 */
function loadSchoolBranding() {
  if (_brandingCache) return _brandingCache;

  // Default values
  const defaults = {
    PRIMARY_COLOR: "#00838F",
    SECONDARY_COLOR: "#FFB300",
    LOGO_FILE_ID: ""
  };

  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const configSheet = ss.getSheetByName("Site Configuration");

    if (configSheet) {
      // Row 24: Primary Color, Row 25: Secondary Color, Row 26: Logo File ID
      const primaryColor = configSheet.getRange(24, 2).getValue();
      const secondaryColor = configSheet.getRange(25, 2).getValue();
      const logoFileId = configSheet.getRange(26, 2).getValue();

      _brandingCache = {
        PRIMARY_COLOR: primaryColor || defaults.PRIMARY_COLOR,
        SECONDARY_COLOR: secondaryColor || defaults.SECONDARY_COLOR,
        LOGO_FILE_ID: logoFileId || ""
      };
    } else {
      _brandingCache = defaults;
    }
  } catch (e) {
    Logger.log("Could not load branding: " + e.message);
    _brandingCache = defaults;
  }

  return _brandingCache;
}

// ═══════════════════════════════════════════════════════════════════════════
// COLOR UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Helper to lighten a hex color
 * @param {string} hex - Hex color code (e.g., "#00838F")
 * @param {number} factor - Lightening factor (0-1)
 * @returns {string} Lightened hex color
 */
function lightenColor(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const lr = Math.round(r + (255 - r) * factor);
  const lg = Math.round(g + (255 - g) * factor);
  const lb = Math.round(b + (255 - b) * factor);
  return `#${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// STUDENT DATA NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalizes student data object
 * Ensures all fields are properly trimmed and converted to strings
 * @param {Object} student - Student object with name, grade, teacher, group fields
 * @returns {Object} Normalized student object
 */
function normalizeStudent(student) {
  return {
    name: (student && student.name) ? student.name.toString().trim() : "",
    grade: (student && student.grade) ? student.grade.toString().trim() : "",
    teacher: (student && student.teacher) ? student.teacher.toString().trim() : "",
    group: (student && student.group) ? student.group.toString().trim() : ""
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SHEET BRANDING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Inserts the school logo into a sheet (row 1, column A)
 * Supports both Google Drive file IDs and external URLs
 * @param {Sheet} sheet - The sheet to add logo to
 * @returns {boolean} True if logo was inserted successfully
 */
function insertSheetLogo(sheet) {
  const logoSource = SCHOOL_BRANDING.LOGO_FILE_ID;
  if (!logoSource) return false;

  try {
    let logoBlob;

    // Check if it's a URL or a Drive file ID
    if (logoSource.startsWith('http://') || logoSource.startsWith('https://')) {
      // Fetch image from URL
      const response = UrlFetchApp.fetch(logoSource, {
        muteHttpExceptions: true,
        followRedirects: true
      });

      if (response.getResponseCode() !== 200) {
        Logger.log("Could not fetch logo from URL: HTTP " + response.getResponseCode());
        return false;
      }

      logoBlob = response.getBlob();
    } else {
      // Treat as Google Drive file ID
      logoBlob = DriveApp.getFileById(logoSource).getBlob();
    }

    const image = sheet.insertImage(logoBlob, 1, 1);

    // Resize logo to configured dimensions
    image.setWidth(SCHOOL_BRANDING.LOGO_WIDTH);
    image.setHeight(SCHOOL_BRANDING.LOGO_HEIGHT);

    // Set row height to accommodate logo
    sheet.setRowHeight(1, SCHOOL_BRANDING.LOGO_HEIGHT + 10);

    return true;
  } catch (e) {
    Logger.log("Could not insert logo: " + e.message);
    return false;
  }
}

/**
 * Sets up standard sheet formatting with logo and headers
 * Call this when creating new sheets for consistent branding
 * @param {Sheet} sheet - The sheet to format
 * @param {string} title - Main title text
 * @param {string} subtitle - Subtitle/description text
 * @param {number} width - Number of columns
 */
function applySheetBranding(sheet, title, subtitle, width) {
  // Insert logo (if configured)
  insertSheetLogo(sheet);

  // Row 1: Title header
  createHeader(sheet, 1, title, width, {
    background: COLORS.TITLE_BG,
    fontColor: COLORS.TITLE_FG,
    fontWeight: "bold",
    fontSize: SCHOOL_BRANDING.HEADER_FONT_SIZE
  });

  // Row 2: Subtitle
  createHeader(sheet, 2, subtitle, width, {
    fontFamily: SCHOOL_BRANDING.FONT_FAMILY,
    fontSize: SCHOOL_BRANDING.SUBHEADER_FONT_SIZE,
    fontStyle: "italic"
  });

  // Apply Calibri font to entire sheet (affects new data)
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
    .setFontFamily(SCHOOL_BRANDING.FONT_FAMILY);
}
