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
 * 3. applySheetBranding_Adelante() - Applies custom branding to sheets (school-specific override)
 * 4. clearBrandingCache() - Clears cached branding data
 * 5. lightenColor() - Color manipulation utility
 * 6. normalizeStudent_Adelante() - Student data normalization (school-specific override)
 * 
 * NOTE: Functions with _Adelante suffix are school-specific overrides that avoid
 * naming conflicts with the default implementations in Phase2_ProgressTracking_Unified.gs.
 * The unified module provides generic versions; these provide Adelante-branded behavior.
 * 
 * Usage:
 * These functions should be called from AdelantePhase2_ProgressTracking.gs
 * when the dynamicBranding or studentNormalization feature flags are enabled.
 * =============================================================================
 */

// ═══════════════════════════════════════════════════════════════════════════
// BRANDING CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

// SCHOOL_BRANDING object with lazy-loaded values from Site Configuration
const SCHOOL_BRANDING = {
  // Font settings (static)
  FONT_FAMILY: "Calibri",
  HEADER_FONT_SIZE: 14,
  SUBHEADER_FONT_SIZE: 10,
  LOGO_WIDTH: 100,
  LOGO_HEIGHT: 50,

  // Dynamic getters that load from config sheet
  get PRIMARY_COLOR() { return loadSchoolBranding().PRIMARY_COLOR; },
  get SECONDARY_COLOR() { return loadSchoolBranding().SECONDARY_COLOR; },
  get LOGO_FILE_ID() { return loadSchoolBranding().LOGO_FILE_ID; },

  // Derived colors
  get HEADER_BG() { return this.PRIMARY_COLOR; },
  get HEADER_FG() { return "#FFFFFF"; },
  get TITLE_BG() { return lightenColor(this.PRIMARY_COLOR, 0.7); },
  get TITLE_FG() { return "#000000"; },
  get ACCENT_BG() { return this.SECONDARY_COLOR; }
};

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
 * Normalizes student data object (Adelante-specific version)
 * Ensures all fields are properly trimmed and converted to strings.
 * Renamed to avoid conflict with the default normalizeStudent() in the unified module.
 * @param {Object} student - Student object with name, grade, teacher, group fields
 * @returns {Object} Normalized student object
 */
function normalizeStudent_Adelante(student) {
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
 * Sets up standard sheet formatting with logo and headers (Adelante-branded version)
 * Call this when creating new sheets for consistent Adelante branding.
 * Renamed to avoid conflict with the default applySheetBranding() in the unified module.
 * @param {Sheet} sheet - The sheet to format
 * @param {string} title - Main title text
 * @param {string} subtitle - Subtitle/description text
 * @param {number} width - Number of columns
 */
function applySheetBranding_Adelante(sheet, title, subtitle, width) {
  // Insert logo (if configured)
  insertSheetLogo(sheet);

  // Row 1: Title header
  createHeader(sheet, 1, title, width, {
    background: SCHOOL_BRANDING.TITLE_BG,
    fontColor: SCHOOL_BRANDING.TITLE_FG,
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
