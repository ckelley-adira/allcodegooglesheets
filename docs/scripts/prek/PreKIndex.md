# PreKIndex.html (Pre-K UI Template)

## 📋 Overview
Landing/home page for the Pre-K and Pre-School Literacy Program web app. Displayed as the default page when the web app URL is opened (no `?page=` parameter). Presents three clickable portal cards — Teacher Tracker, Tutor Tracker, and Program Overview Dashboard — so that staff and administrators can navigate to the appropriate tool. The page is branded for "The Indy Learning Team with Adira Reads."

## 📜 Business Rules
- Portal navigation uses the server-provided web app URL (retrieved once on load via `getWebAppUrl()`); the URL is cached in `webAppUrl` and reused on subsequent card clicks to avoid extra server round-trips.
- If `webAppUrl` is not yet available when a card is clicked, the fallback is to call `getWebAppUrl()` again before navigating.
- All cards add a CSS `loading` class (reduces opacity, disables pointer events) immediately on click to prevent double-navigation.
- The page uses `<base target="_top">` so that all navigations replace the top-level browser window rather than the iframe.

## 📥 Data Inputs
No user-entered form fields.

| Data | Source |
|------|--------|
| Web app base URL | `google.script.run.getWebAppUrl()` on `DOMContentLoaded` |

## 📤 Outputs
| Action | Result |
|--------|--------|
| Click "Open Teacher Tracker" | Navigates `window.top` to `webAppUrl + '?page=teacher'` |
| Click "Open Tutor Tracker" | Navigates `window.top` to `webAppUrl + '?page=tutor'` |
| Click "Open Dashboard" | Navigates `window.top` to `webAppUrl + '?page=dashboard'` |

## 🔗 Dependencies
### Server Functions Called (`google.script.run`)
| Function | Purpose |
|----------|---------|
| `getWebAppUrl()` | Retrieve the deployed web app base URL; called on page load and optionally again as a fallback inside `navigateTo()` |

### Called From (which .gs opens this HTML)
- `PreKMainCode.gs` — serves this as the default page (no `?page=` parameter) via `HtmlService.createHtmlOutputFromFile('PreKIndex')`.

## ⚙️ Client-Side JavaScript Functions

### `navigateTo(page)`
**Description:** Applies a loading state to all portal cards, then navigates `window.top` to the web app URL for the given page. Uses the cached `webAppUrl` if available; otherwise calls `getWebAppUrl()` again first.
**Parameters:**
- `page` (string): Page identifier — `'teacher'`, `'tutor'`, or `'dashboard'`
**Returns:** void
