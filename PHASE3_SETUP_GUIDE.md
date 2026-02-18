# Phase 3: Canonical Setup Wizard & SiteConfig Template

## Overview

Phase 3 introduces a **universal, configuration-driven setup wizard** that can deploy the Adira UFLI Progress Tracking System to ANY supported school or organization. This eliminates the need for school-specific wizard files and enables greenfield deployments with comprehensive configuration options.

## Key Components

### 1. SiteConfig_TEMPLATE.gs
**Purpose:** Defines the complete SITE_CONFIG data structure with all configuration options.

**Key Features:**
- Comprehensive documentation for all configuration keys
- Validation functions for configuration integrity
- Helper functions for reading configuration dynamically
- Support for all school-specific quirks and feature modules

**Configuration Categories:**
- **Basic Information:** School name, deployment type, version
- **Grade Levels:** Grades served (PreK-G8)
- **Mixed Grade Support:** Enable/disable, allowed combinations, naming format
- **Feature Modules:** 10 optional features (coaching, tutoring, grant reporting, etc.)
- **Sheet Layout:** Header row count, group format, SC classroom inclusion
- **Branding:** Primary/secondary colors, logo file ID
- **Advanced Options:** Batch optimization, sync mode, group size constraints

### 2. SetupWizard.gs
**Purpose:** Universal setup wizard that works for all Adira network schools.

**Key Features:**
- Based on AdelanteSetUpWizard.gs v3.2 (batch write optimized)
- Expanded from 5 to 10 feature modules
- Dynamic configuration reading from SITE_CONFIG
- Support for all deployment scenarios
- Maintains v3.2 performance optimizations

**Version:** 4.0 (Phase 3)

### 3. SetupWizardUI.html
**Purpose:** User interface for the guided setup wizard.

**Steps:**
1. **School Information** - Name and basic details
2. **Grade Levels** - Select grades served (PreK-G8)
3. **Students** - Import or manually enter student roster
4. **Teachers** - Configure teacher assignments
5. **Groups** - Define intervention group structure
6. **Features** - Enable optional modules (categorized)
7. **Branding** - Customize colors and logo
8. **Sheet Layout** - Configure sheet structure options
9. **Review** - Confirm all settings before setup

## Supported Feature Modules

### Advanced Modules (Opt-in)
- **Coaching Dashboard** - Weekly coaching visualization with AG% growth tracking
  - *Implemented by:* SankofaCoachView.gs, SankofaWeeklyCoachingDashboard.gs
- **Tutoring System** - Dual-track progress (whole-group + tutoring)
  - *Implemented by:* GlobalPrepTutoringSystem.gs
- **Grant Reporting** - Specialized reports for grant compliance
  - *Implemented by:* GlobalPrepMindTrustReport.gs
- **Growth Highlights** - Visual growth indicators on sheets
  - *Implemented by:* AdelanteGrowthHighlighter.gs
- **Admin Import** - Bulk data import with validation
  - *Implemented by:* AdelanteAdminImport.gs
- **Unenrollment Automation** - Auto-archive inactive students
  - *Implemented by:* AdelanteUnenrollmentAutomation.gs

### Standard Features (Recommended)
- **Pacing Sheets** - Monitor progress against schedule
- **Parent Reports** - Family-friendly progress reports
- **Exception Reports** - Flag students needing intervention

### Integrations (Optional)
- **Monday.com Integration** - Export to project management boards

## Sheet Layout Options

### Group Format Types
- **Standard** - Traditional layout with group name in column D
- **Condensed** - Minimal layout for small displays/printing
- **Expanded** - Additional metadata columns for detailed tracking
- **Sankofa** - Co-teaching format with "Student Name" headers

### Header Configuration
- **Header Row Count** - 3-10 rows (default: 5)
- **SC Classroom Inclusion** - Self-contained classroom designation support

## Usage

### For Greenfield Deployments

1. **Copy Template Files**
   - Copy `SetupWizard.gs` to your Google Apps Script project
   - Copy `SetupWizardUI.html` to your project
   - Copy `SiteConfig_TEMPLATE.gs` to your project

2. **Run Setup Wizard**
   - Open your Google Sheet
   - The wizard will automatically appear in the menu
   - Follow the 9-step guided process

3. **Configure Features**
   - Enable only the features your school needs
   - Features can be changed later in System Settings

4. **Customize Branding**
   - Set your school colors (hex codes)
   - Upload logo to Google Drive and add file ID (optional)

5. **Complete Setup**
   - Review all settings in Step 9
   - Click "Complete Setup" to generate system

### For Existing Deployments

⚠️ **Important:** Phase 3 is designed for **greenfield deployments** and **major rewrites only**. 

Do not use for in-flight school upgrades without careful migration planning.

### Reading Configuration in Code

```javascript
// Get complete site configuration
const config = getSiteConfig();

// Check if a feature is enabled
if (isFeatureEnabled('coachingDashboard')) {
  // Show coaching dashboard
}

// Get specific configuration value
const primaryColor = getConfigValue('branding.primaryColor');
const headerRows = getConfigValue('sheetLayout.headerRowCount');
```

## Migration from School-Specific Wizards

### Adelante → SetupWizard.gs
- All features preserved
- Branding moved to dedicated step
- Sheet layout options added

### Sankofa → SetupWizard.gs
- Coaching dashboard available as feature toggle
- Sankofa group format available in sheet layout options
- SC classroom support preserved

### GlobalPrep → SetupWizard.gs
- Tutoring system available as feature toggle
- Grant reporting available as feature toggle
- All tutoring configurations preserved

### CCA/CHAW → SetupWizard.gs
- Standard configuration options
- Mixed grade support configurable
- All existing features available

## Configuration Storage

### Site Configuration Sheet
All settings are stored in the "Site Configuration" sheet:

| Row | Label | Purpose |
|-----|-------|---------|
| 2 | School Name | Organization name |
| 5-14 | Grades Served | Grade level checkboxes |
| 17 | Allow Grade Mixing | Enable mixed grades |
| 18 | Mixed Combinations | Allowed grade combinations |
| 20 | System Version | Current version |
| 21 | Last Updated | Last modification date |
| 24 | Primary Color | Brand primary color (hex) |
| 25 | Secondary Color | Brand secondary color (hex) |
| 26 | Logo File ID | Google Drive file ID |
| 29 | Header Row Count | Sheet header rows (3-10) |
| 30 | Group Format | Sheet format style |
| 31 | Include SC Classroom | SC designation toggle |

### Feature Settings Sheet
Feature toggles are stored in the "Feature Settings" sheet with one row per feature.

## Validation

The system includes comprehensive validation:

```javascript
// Validate configuration before saving
const validation = validateSiteConfig(config);
if (!validation.valid) {
  console.log("Configuration errors:", validation.errors);
}
```

**Validation Checks:**
- School name is required
- At least one grade level must be selected
- Color codes must be valid hex format (#RRGGBB)
- Mixed grade combinations required when mixing enabled

## Backward Compatibility

Phase 3 maintains backward compatibility with existing deployments:

- Existing configuration sheets are recognized
- Missing configuration values use sensible defaults
- Feature toggles default to false (opt-in model)
- Sheet layout defaults to "standard" format

## Future Enhancements

Potential Phase 4 improvements:
- Import/export configuration profiles
- Configuration templates library
- Multi-school district management
- Configuration versioning and rollback
- A/B testing for feature effectiveness

## Support

For questions or issues with Phase 3 deployment:
1. Check the validation errors in the wizard
2. Review SiteConfig_TEMPLATE.gs documentation
3. Verify all required fields are completed
4. Contact @ckelley-adira for deployment assistance

## Version History

- **v4.0 (Phase 3)** - February 2026
  - Canonical setup wizard for universal deployment
  - 10 feature modules with categorization
  - Branding and sheet layout configuration
  - Enhanced documentation and validation

- **v3.2** - January 2026
  - Batch write optimizations (~90% faster)
  - Base for Phase 3 canonical wizard

- **v3.1** - December 2025
  - Instant group sheet updates
  - Improved form submission feedback
