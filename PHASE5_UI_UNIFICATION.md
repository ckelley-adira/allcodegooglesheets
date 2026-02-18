# Phase 5: HTML & UI Unification - Server-Side Template Approach

## Overview
Phase 5 unified all major UI HTML files to canonical versions using Apps Script server-side templating with `<?= ?>` tokens. This approach allows school-specific branding (colors, logos, labels) to be injected at render time from SITE_CONFIG.

## Approach: Server-Side Templating

Instead of client-side dynamic loading via `google.script.run`, this implementation uses Apps Script's native template system:

```html
<!-- Before: Hardcoded -->
<div style="background: #B8E6DC;">

<!-- After: Template token -->
<div style="background: <?= getBranding().primaryColor ?>;">
```

### Benefits
- **No additional API calls** - Branding injected at page load
- **Faster rendering** - No wait for async config loading
- **Simpler code** - No client-side JavaScript for branding
- **Native Apps Script** - Uses built-in template system

## Canonical UI Files

### Renamed from Adelante (Base Template)
1. **ManageStudentsUI.html** (was AdelanteManageStudentsUI.html)
2. **ManageGroupsUI.html** (was AdelanteManageGroupsUI.html)
3. **GenerateReportsUI.html** (was AdelanteGenerateReportsUI.html)
4. **GrowthHighlighterSidebar.html** (was AdelanteGrowthHighlighterSidebar.html)
5. **LessonEntryForm.html** (was AdelanteLessonEntryForm.html)

### Already Canonical
6. **SetupWizardUI.html** (was already canonical, updated with template tokens)

## SITE_CONFIG Branding Block

Added to `SiteConfig_TEMPLATE.gs`:

```javascript
branding: {
  schoolName: "Your School Name",
  shortName: "",
  tagline: "Innovate. Educate. Empower.",
  logoUrl: "",  // Google Drive file ID or public URL
  primaryColor: "#B8E6DC",  // Main accent color for UI elements
  headerGradientStart: "#4A90E2",  // Setup wizard header gradient start
  headerGradientEnd: "#357ABD",  // Setup wizard header gradient end
  accentColor: "#4A90A4"  // Secondary accent for sidebars and highlights
}
```

### Helper Function

```javascript
function getBranding() {
  return SITE_CONFIG.branding || {
    schoolName: "UFLI Master System",
    shortName: "",
    tagline: "Innovate. Educate. Empower.",
    logoUrl: "",
    primaryColor: "#B8E6DC",
    headerGradientStart: "#4A90E2",
    headerGradientEnd: "#357ABD",
    accentColor: "#4A90A4"
  };
}
```

## Template Token Usage

### Colors
```html
<!-- Primary accent color (section headers, selected rows, buttons) -->
<div style="background: <?= getBranding().primaryColor ?>;">

<!-- Header gradients (setup wizard) -->
<div style="background: linear-gradient(135deg, <?= getBranding().headerGradientStart ?> 0%, <?= getBranding().headerGradientEnd ?> 100%);">

<!-- Accent color (sidebar, highlights) -->
<div style="color: <?= getBranding().accentColor ?>;">
```

### Labels
```html
<!-- School name -->
<h1><?= getBranding().schoolName ?> - Lesson Data Entry</h1>

<!-- Tagline -->
<div class="tagline"><?= getBranding().tagline ?></div>
```

### Logo
```html
<!-- Conditional logo display -->
<? if (getBranding().logoUrl) { ?>
  <img src="<?= getBranding().logoUrl ?>" alt="School Logo">
<? } else { ?>
  <img src="" style="display:none;">
<? } ?>
```

## Deleted School-Specific Files

The following files were removed as they are now replaced by the canonical LessonEntryForm.html:
- ❌ SankofaLessonEntryForm.html
- ❌ GlobalPrepLessonEntryForm.html
- ❌ CHAWLessonEntryform.html
- ❌ AllegiantLessonEntryForm.html

**Note:** Functional differences (co-teaching, mixed-grade handling) should now be handled via feature flags in SITE_CONFIG rather than separate files.

## Adelante-Specific Files (Legacy)

The following Adelante files remain but are **no longer used** (canonical versions replace them):
- AdelanteManageStudentsUI.html → ManageStudentsUI.html
- AdelanteManageGroupsUI.html → ManageGroupsUI.html
- AdelanteGenerateReportsUI.html → GenerateReportsUI.html
- AdelanteGrowthHighlighterSidebar.html → GrowthHighlighterSidebar.html
- AdelanteLessonEntryForm.html → LessonEntryForm.html
- AdelanteSetupWizardUI.html → SetupWizardUI.html (canonical already existed)

These can be safely deleted in a future cleanup phase.

## PreK UI Files (Intentionally Separate)

PreK UI files remain untouched as requested:
- ✅ PreKPortal.html
- ✅ PreKDashboard.html
- ✅ PreKTutorForm.html
- ✅ PreKIndex.html
- ✅ PreKParentReport.html
- ✅ PreKSetupWizard.html

**Reason:** School-agnostic system with different curriculum (Handwriting Without Tears)

## Setup Wizard Updates

Setup wizards need to be updated to:
1. Include `SiteConfig_TEMPLATE.gs` with the branding block
2. Ensure `getBranding()` function is available
3. Reference canonical file names when calling `HtmlService.createHtmlOutputFromFile()`

Example:
```javascript
function manageStudents() {
  const html = HtmlService.createTemplateFromFile('ManageStudentsUI');
  // Template tokens will be evaluated automatically
  const output = html.evaluate()
    .setWidth(800)
    .setHeight(600)
    .setTitle('Manage Student Roster');
  
  SpreadsheetApp.getUi().showModalDialog(output, 'Manage Students');
}
```

**Important:** Change from `createHtmlOutputFromFile()` to `createTemplateFromFile()` + `.evaluate()` to enable template token processing.

## Color Mapping

| Element | Old Hardcoded | New Token |
|---------|---------------|-----------|
| Section headers, selected rows | `#B8E6DC` | `<?= getBranding().primaryColor ?>` |
| Setup wizard header gradient start | `#4A90E2` | `<?= getBranding().headerGradientStart ?>` |
| Setup wizard header gradient end | `#357ABD` | `<?= getBranding().headerGradientEnd ?>` |
| Sidebar accents, highlights | `#4A90A4` | `<?= getBranding().accentColor ?>` |

## Migration Guide

### For Existing Deployments

1. **Add branding block to SITE_CONFIG**
   ```javascript
   branding: {
     schoolName: "My School",
     tagline: "Our Motto Here",
     logoUrl: "https://...",
     primaryColor: "#B8E6DC",
     headerGradientStart: "#4A90E2",
     headerGradientEnd: "#357ABD",
     accentColor: "#4A90A4"
   }
   ```

2. **Update UI launcher functions**
   ```javascript
   // Old
   const html = HtmlService.createHtmlOutputFromFile('ManageStudentsUI');
   
   // New
   const html = HtmlService.createTemplateFromFile('ManageStudentsUI').evaluate();
   ```

3. **Test all dialogs** to ensure branding renders correctly

### For New Deployments

1. Copy `SiteConfig_TEMPLATE.gs` to your setup wizard
2. Configure the `branding` block with your school's colors/logo
3. All UI dialogs will automatically use your branding

## Testing Checklist

- [ ] ManageStudentsUI displays with correct colors/logo
- [ ] ManageGroupsUI displays with correct colors/logo
- [ ] GenerateReportsUI displays with correct colors/logo
- [ ] GrowthHighlighterSidebar displays with correct colors/logo
- [ ] LessonEntryForm displays with correct school name/logo
- [ ] SetupWizardUI displays with correct header gradient
- [ ] Logo conditionally displays only when logoUrl is set
- [ ] Tagline displays correctly in all applicable UIs
- [ ] Colors match branding configuration

## Future Enhancements

1. **Feature flags for LessonEntryForm variants**
   - Add `features.coTeaching` flag for Sankofa-style co-teaching
   - Add `features.mixedGradeDisplay` for different grade mixing UI patterns

2. **Additional branding options**
   - `fontFamily` - Custom font selection
   - `buttonRadius` - Button border radius
   - `headerLogoHeight` - Logo size control

3. **Dark mode support**
   - `darkMode` flag with alternate color scheme

## Related Documentation

- See `SiteConfig_TEMPLATE.gs` for complete branding configuration
- See `PHASE3_SETUP_GUIDE.md` for Site Configuration structure
- See `README.md` for overall architecture

---

**Completed**: February 18, 2026  
**Approach**: Server-side templating with `<?= ?>` tokens  
**Author**: GitHub Copilot  
**Assignee**: @ckelley-adira
