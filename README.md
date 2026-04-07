# Adira Reads Web App — Context Bundle

This is the **context bundle** for the Adira Reads web application rebuild. It exists so that any Claude session — whether Claude Code in your terminal, a fresh Claude.ai conversation, or a new Project — can come up to speed on the project without you having to re-explain five years of history.

## How to use this bundle with Claude Code

1. **Place the bundle at the root of your new repo** so the structure looks like:
   ```
   adira-reads-webapp/        ← your new repo
   ├── CLAUDE.md              ← this file is read automatically by Claude Code
   ├── docs/
   │   ├── data-model.md
   │   ├── ufli-domain.md
   │   ├── school-variations.md
   │   ├── current-state-inventory.md
   │   ├── glossary.md
   │   ├── decisions.md
   │   ├── brand.md
   │   └── source/
   │       └── future-state-data-model-v1.docx   ← drop the .docx here
   ├── src/                   ← your code goes here
   └── ...
   ```

2. **Drop the Future State Data Model .docx into `docs/source/`.** The bundle's `data-model.md` references it as the canonical specification — without it, the bundle is incomplete. You have it locally; the file you used previously was named `Adira_Reads_Future_State_Data_Model_v1.docx`.

3. **Start Claude Code in the repo root.** It will read `CLAUDE.md` automatically on every session start.

4. **For deep work on a specific area, point Claude Code at the relevant doc.** Example:
   > "We're working on the Group entity today. Read docs/data-model.md and docs/school-variations.md first."

## How to use this bundle with Claude.ai (web/desktop)

1. **Create a Claude Project** for "Adira Reads Web App."
2. **Upload all the markdown files and the .docx** to the Project's knowledge base.
3. New conversations within that Project will have all this context available.
4. **Memory does not transfer between Claude.ai and a Project** — the bundle is the canonical context regardless of which interface you use.

## Keeping the bundle in sync

This bundle is a snapshot from April 2026. As decisions get made and the project evolves:

- **`docs/decisions.md`** is the most important file to keep updated. When something gets decided, add a `D-NNN` entry. When something open gets resolved, move it from Open to Decided.
- **The .docx** is the canonical data model spec. If the data model changes, regenerate the .docx (or version it as v2, v3, etc.) — do not edit `data-model.md` to drift from the .docx.
- **`docs/glossary.md`** should grow as new terms enter the project.
- **`docs/current-state-inventory.md`** should shrink as systems get migrated and retired.

## What's intentionally missing

- **Tech stack specifics** — not yet decided (see `docs/decisions.md` O-001). Do not let Claude Code commit to Next.js, Supabase, or any other specific stack until Christina confirms.
- **Migration sequencing** — the Mapt Solutions 51-item build plan exists but the actual ordering is a separate planning decision.
- **API specifications** — too early. Will be generated once entities are stable.
- **UI mockups / wireframes** — also too early.
- **Christina's broader life context** (caregiving, @parentingmyparents brand, Bridge Builder Consulting, garage construction) — intentionally out of scope. That's life, not features.

## Provenance

This bundle was generated April 6, 2026, by Claude (Opus 4.6) in conversation with Christina Kelley. Source material was pulled from past Claude.ai conversations using the conversation_search tool. The Future State Data Model .docx referenced throughout was built by Christina and Claude in an earlier session and is the spine of this bundle.

If anything in this bundle contradicts the .docx, **the .docx wins.**

If anything in this bundle contradicts what Christina says in real time, **Christina wins.**
