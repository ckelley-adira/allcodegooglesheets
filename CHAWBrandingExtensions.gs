/**
 * =============================================================================
 * CHAW BRANDING EXTENSIONS
 * =============================================================================
 * 
 * School: CHAW (Handwriting Without Tears)
 * 
 * Purpose:
 * This file contains CHAW-specific branding functions extracted from
 * CHAWPhase2_ProgressTracking.gs. These functions extend the unified
 * Phase2_ProgressTracking_Unified.gs with dynamic branding capabilities.
 * 
 * Feature Flags:
 * - dynamicBranding: Enables dynamic loading of branding from Site Configuration
 * 
 * Dependencies:
 * - SITE_CONFIG.branding: Configuration object containing:
 *   - PRIMARY_COLOR: School's primary brand color (hex)
 *   - SECONDARY_COLOR: School's secondary/accent color (hex)
 *   - LOGO_FILE_ID: Google Drive file ID or URL for school logo
 * 
 * Configuration Sheet Reference (Site Configuration sheet):
 * - Row 24: Primary Color
 * - Row 25: Secondary Color
 * - Row 26: Logo File ID
 * 
 * Functions Included:
 * 1. loadSchoolBranding() - Loads branding from Site Configuration
 * 2. insertSheetLogo() - Inserts school logo on sheets
 * 3. applySheetBranding_CHAW() - Applies custom branding to sheets (school-specific override)
 * 4. lightenColor() - Color manipulation utility
 * 5. getCHAWConfig() - CHAW-specific configuration retrieval
 * 6. createHeader_CHAW() - Header with logo positioning support (school-specific override)
 * 7. clearBrandingCache() - Clears cached branding data
 * 
 * NOTE: Functions with _CHAW suffix are school-specific overrides that avoid
 * naming conflicts with the default implementations in Phase2_ProgressTracking_Unified.gs.
 * The unified module provides generic versions; these provide CHAW-branded behavior.
 * 
 * Constants Defined:
 * - SCHOOL_BRANDING: Branding configuration object with static and dynamic properties
 * - COLORS: Color palette for sheet formatting
 * 
 * Usage:
 * These functions should be called from CHAWPhase2_ProgressTracking.gs
 * when the dynamicBranding feature flag is enabled.
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
// CHAW CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Returns CHAW-specific configuration for SharedEngine functions
 * @returns {Object} Configuration object
 */
function getCHAWConfig() {
  return {
    SHEET_NAMES_V2,
    SHEET_NAMES_PREK,
    LAYOUT,
    PREK_CONFIG,
    GRADE_METRICS: SHARED_GRADE_METRICS
  };
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

const COLORS = {
  Y: "#d4edda",        // Light green - Yes/Pass
  N: "#f8d7da",        // Light red - No/Fail
  A: "#fff3cd",        // Light yellow - Absent
  HEADER_BG: SCHOOL_BRANDING.HEADER_BG,
  HEADER_FG: SCHOOL_BRANDING.HEADER_FG,
  TITLE_BG: SCHOOL_BRANDING.TITLE_BG,
  TITLE_FG: SCHOOL_BRANDING.TITLE_FG,
  SUB_HEADER_BG: "#f8f9fa",
  PLACEHOLDER_FG: "#999999"
};

// ═══════════════════════════════════════════════════════════════════════════
// SHEET BRANDING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a header row without merging cells (CHAW-branded version)
 * Accounts for logo positioning in row 1 by offsetting text to column B.
 * Renamed to avoid conflict with the default createHeader() in the unified module.
 * @param {Sheet} sheet - The sheet to format
 * @param {number} row - Row number for the header
 * @param {string} text - Header text
 * @param {number} width - Number of columns to apply background to
 * @param {Object} options - Formatting options (background, fontColor, fontWeight, fontSize, fontFamily, fontStyle, horizontalAlignment)
 */
function createHeader_CHAW(sheet, row, text, width, options = {}) {
  // Set background across the full width (no merge)
  const fullRange = sheet.getRange(row, 1, 1, width);
  if (options.background) fullRange.setBackground(options.background);

  // Set text in first column only (or column 2 if logo present and row 1)
  const textCol = (row === 1 && SCHOOL_BRANDING.LOGO_FILE_ID) ? 2 : 1;
  const textRange = sheet.getRange(row, textCol);
  textRange.setValue(text);

  // Apply font styling to the text cell
  textRange.setFontFamily(options.fontFamily || SCHOOL_BRANDING.FONT_FAMILY);
  if (options.fontColor) textRange.setFontColor(options.fontColor);
  if (options.fontWeight) textRange.setFontWeight(options.fontWeight);
  if (options.fontSize) textRange.setFontSize(options.fontSize);
  if (options.fontStyle) textRange.setFontStyle(options.fontStyle);
  if (options.horizontalAlignment) textRange.setHorizontalAlignment(options.horizontalAlignment);
}

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
 * Sets up standard sheet formatting with logo and headers (CHAW-branded version)
 * Call this when creating new sheets for consistent CHAW branding.
 * Renamed to avoid conflict with the default applySheetBranding() in the unified module.
 * @param {Sheet} sheet - The sheet to format
 * @param {string} title - Main title text
 * @param {string} subtitle - Subtitle/description text
 * @param {number} width - Number of columns
 */
function applySheetBranding_CHAW(sheet, title, subtitle, width) {
  // Insert logo (if configured)
  insertSheetLogo(sheet);

  // Row 1: Title header
  createHeader_CHAW(sheet, 1, title, width, {
    background: COLORS.TITLE_BG,
    fontColor: COLORS.TITLE_FG,
    fontWeight: "bold",
    fontSize: SCHOOL_BRANDING.HEADER_FONT_SIZE
  });

  // Row 2: Subtitle
  createHeader_CHAW(sheet, 2, subtitle, width, {
    fontFamily: SCHOOL_BRANDING.FONT_FAMILY,
    fontSize: SCHOOL_BRANDING.SUBHEADER_FONT_SIZE,
    fontStyle: "italic"
  });

  // Apply Calibri font to entire sheet (affects new data)
  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns())
    .setFontFamily(SCHOOL_BRANDING.FONT_FAMILY);
}
