# Archive

This directory contains **legacy school-specific files** preserved for historical reference. These files have been superseded by the [Gold Standard Template](../gold-standard-template/README.md).

## Why these files exist

During early development, each partner site received a copy of the core engine with school-specific prefixes (e.g., `AdelantePhase2_ProgressTracking.gs`, `SankofaSetupWizard.gs`). This led to duplicated logic that was difficult to maintain and update across sites.

The Gold Standard Template consolidates all shared logic into a single codebase, with per-site configuration handled entirely through `SiteConfig_TEMPLATE.gs`.

## Directory structure

| Directory | Partner site |
|---|---|
| `adelante/` | Adelante school-specific files |
| `sankofa/` | Sankofa school-specific files |
| `chaw/` | CHAW school-specific files |
| `cca/` | CCA school-specific files |
| `globalprep/` | GlobalPrep school-specific files |
| `allegiant/` | Allegiant school-specific files |

### Superseded files

| File | Notes |
|---|---|
| `UnifiedPhase2_ProgressTracking_SKELETON.gs` | Incomplete early unification skeleton; superseded by `gold-standard-template/Phase2_ProgressTracking.gs` |

## Do not use these files for new deployments

All new site deployments should use the Gold Standard Template. These files are retained solely for reference and will not receive updates.
