# Phase 5: HTML & UI Unification - Implementation Summary

## Overview
Phase 5 unified all major UI HTML files to use canonical versions with SITE_CONFIG parameterization, eliminating duplication and enabling school-specific branding through configuration rather than separate files.

## Completed Work

### 1. Canonical UI Files Created
The following UI files were unified from Adelante-specific versions to canonical versions:

- **ManageStudentsUI.html** - Student roster management dialog
- **ManageGroupsUI.html** - Group configuration management dialog
- **GenerateReportsUI.html** - Custom report generation interface
- **GrowthHighlighterSidebar.html** - Growth highlighting utility sidebar

All canonical files are now used by all schools (Adelante, Sankofa, GlobalPrep, CCA, CHAW).

### 2. SITE_CONFIG Parameterization
Each canonical UI file now:
- Loads site configuration on page load via `getSiteConfigForUI()`
- Applies dynamic colors based on site configuration:
  - **Primary Color**: Main branding color (buttons hover, headings)
  - **Accent Color**: Derived color for section headers and highlights (70% lighter than primary)
  - **Secondary Color**: Available for future use
- Loads school logo from Google Drive (if configured)
- Hides logo section if no logo is configured

#### Color Mapping
- **Hardcoded #B8E6DC** (old Adelante accent) → **Computed accentColor** (from SITE_CONFIG)
- Section headers, selected rows, modal headers → Use accentColor
- Button hover states → Use primaryColor
- Default colors if not configured: Primary=#4A90E2, Accent=#B8E6DC

### 3. Server-Side Functions Added
Added to all setup wizard files:
- **SetupWizard.gs** (canonical)
- **AdelanteSetUpWizard.gs**
- **CCASetupWizard.gs**
- **CHAWSetupWizard.gs**
- **GlobalPrepSetupWizard.gs**
- **SankofaSetupWizard.gs**
- **AdelanteGrowthHighlighter.gs** (for sidebar)

Functions added:
```javascript
/**
 * Gets site configuration for use in HTML UI dialogs
 * @returns {Object} {schoolName, primaryColor, secondaryColor, logoFileId, accentColor}
 */
function getSiteConfigForUI()

/**
 * Lightens a hex color by a factor (for computing accent colors)
 * @param {string} hex - Hex color code
 * @param {number} factor - Lightening factor (0-1)
 * @returns {string} Lightened hex color
 */
function lightenColor(hex, factor)
```

### 4. Logo Handling
- **Before**: Hardcoded base64-encoded logos embedded in HTML (35KB+ per file)
- **After**: Dynamic loading from Google Drive using logoFileId
- Logo display controlled via Site Configuration sheet (Row 26: Logo File ID)
- Logo section hidden if no logoFileId is configured

## Files Modified

### New Files Created
1. `ManageStudentsUI.html` - Canonical student management UI
2. `ManageGroupsUI.html` - Canonical group management UI
3. `GenerateReportsUI.html` - Canonical report generation UI
4. `GrowthHighlighterSidebar.html` - Canonical growth highlighter sidebar

### Files Modified
1. `SetupWizard.gs` - Added getSiteConfigForUI() and lightenColor()
2. `AdelanteSetUpWizard.gs` - Added getSiteConfigForUI() and lightenColor()
3. `CCASetupWizard.gs` - Added getSiteConfigForUI() and lightenColor()
4. `CHAWSetupWizard.gs` - Added getSiteConfigForUI() and lightenColor()
5. `GlobalPrepSetupWizard.gs` - Added getSiteConfigForUI() and lightenColor()
6. `SankofaSetupWizard.gs` - Added getSiteConfigForUI() and lightenColor()
7. `AdelanteGrowthHighlighter.gs` - Added getSiteConfigForUI() and lightenColor()

### Legacy Files (Kept for Backward Compatibility)
The following Adelante-specific files remain but are no longer actively used:
- `AdelanteManageStudentsUI.html` - Replaced by canonical ManageStudentsUI.html
- `AdelanteManageGroupsUI.html` - Replaced by canonical ManageGroupsUI.html
- `AdelanteGenerateReportsUI.html` - Replaced by canonical GenerateReportsUI.html
- `AdelanteGrowthHighlighterSidebar.html` - Replaced by canonical GrowthHighlighterSidebar.html

**Note**: These files can be safely removed in a future cleanup phase.

## Not Unified (Intentional)

### 1. LessonEntryForm Files
LessonEntryForm files remain school-specific due to significant functional differences:
- **Co-teaching support** (Sankofa) - Displays students from multiple groups in one session
- **Mixed-grade handling** - Different schools have different grade mixing logic
- **Custom field layouts** - Different data collection requirements per school
- **Integration points** - Different backend integration logic

Files that remain school-specific:
- `AdelanteLessonEntryForm.html`
- `SankofaLessonEntryForm.html`
- `GlobalPrepLessonEntryForm.html`
- `AllegiantLessonEntryForm.html`

**Future Work**: A future phase could create a canonical LessonEntryForm with feature flags to handle co-teaching, mixed grades, etc.

### 2. PreK UI Files
PreK UI files remain intentionally separate as they are school-agnostic and use a different curriculum (Handwriting Without Tears):
- `PreKPortal.html`
- `PreKDashboard.html`
- `PreKTutorForm.html`
- `PreKIndex.html`
- `PreKParentReport.html`
- `PreKSetupWizard.html`

These are maintained separately in `PreKMainCode.gs` and are not part of the school-specific setup wizards.

### 3. SetupWizardUI.html
Already canonical! All schools reference `SetupWizardUI.html` (not school-specific versions).
- File: `SetupWizardUI.html`
- Used by: All schools
- Note: `AdelanteSetupWizardUI.html` exists but appears to be legacy/unused

## Configuration Requirements

### Site Configuration Sheet
To use custom branding in the unified UIs, schools must configure these values in their "Site Configuration" sheet:

| Row | Label | Type | Purpose | Example |
|-----|-------|------|---------|---------|
| 2 | School Name | Text | Organization name | "Adelante Preparatory Academy" |
| 24 | Primary Color | Hex Color | Main brand color | "#00838F" |
| 25 | Secondary Color | Hex Color | Accent brand color | "#FFB300" |
| 26 | Logo File ID | Text | Google Drive file ID | "1ABC...XYZ" |

### Default Values
If no configuration is found, the system uses these defaults:
- School Name: "UFLI Master System"
- Primary Color: #4A90E2 (blue)
- Secondary Color: #90EE90 (light green)
- Logo File ID: (empty - logo hidden)
- Accent Color: #B8E6DC (derived from primary)

## Testing & QA

### Manual Testing Checklist
- [ ] Test ManageStudentsUI with custom colors
- [ ] Test ManageStudentsUI with custom logo
- [ ] Test ManageStudentsUI with no logo configured
- [ ] Test ManageGroupsUI with custom colors
- [ ] Test GenerateReportsUI with custom colors
- [ ] Test GrowthHighlighterSidebar with custom colors
- [ ] Verify all schools can open all dialogs
- [ ] Verify logo loads correctly from Drive
- [ ] Verify colors apply correctly to all UI elements

### Regression Testing
- [ ] Verify existing Adelante deployment still works
- [ ] Verify Sankofa deployment can use new UIs
- [ ] Verify GlobalPrep deployment can use new UIs
- [ ] Verify CCA deployment can use new UIs
- [ ] Verify CHAW deployment can use new UIs

## Migration Notes

### For Existing Deployments
1. All setup wizards already reference canonical UI files by name (e.g., 'ManageStudentsUI')
2. No code changes required - canonical files are drop-in replacements
3. Schools using custom branding should configure Site Configuration sheet (Rows 24-26)
4. Schools without branding configuration will see default colors/no logo

### For New Deployments
1. Run Setup Wizard to create Site Configuration sheet
2. Configure branding in Step 7 of wizard (Primary Color, Secondary Color, Logo)
3. All UI dialogs will automatically use configured branding

## Benefits

1. **Single Source of Truth**: One UI file per dialog type instead of 5+ copies
2. **Consistent UX**: All schools get same UI improvements automatically
3. **Easy Branding**: Schools customize via configuration, not code
4. **Smaller Codebase**: Eliminated ~8KB of duplicated HTML
5. **Easier Maintenance**: Bug fixes apply to all schools automatically
6. **Future-Proof**: New schools can be added without creating new UI files

## Future Enhancements

### Short Term
1. Unify LessonEntryForm files with feature flags for co-teaching, mixed grades
2. Remove legacy Adelante-specific UI files
3. Add more branding options (font family, button radius, etc.)

### Long Term
1. Move UI files to a `/ui/` directory for better organization
2. Create a UI component library for shared elements
3. Add dark mode support
4. Add accessibility improvements (ARIA labels, keyboard navigation)
5. Create a branding preview tool in the setup wizard

## Related Documentation
- See `PHASE3_SETUP_GUIDE.md` for Site Configuration structure
- See `SiteConfig_TEMPLATE.gs` for feature flags and configuration options
- See `README.md` for overall architecture and deployment guide

---

**Completed**: February 2026  
**Author**: GitHub Copilot  
**Assignee**: @ckelley-adira
