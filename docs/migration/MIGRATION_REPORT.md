---
id: DOC-003
title: 'PKB migration report'
type: report
status: completed
created: 2026-11-19
updated: 2026-11-19
project: unmarked
tags: [migration]
related: [DOC-001, DOC-002]
---

# Migration Report (2026-11-19)

Non-destructive: no original was edited, moved or deleted. Archive this folder once reviewed.

| Original                            | Action                      | Now                                             |
| ----------------------------------- | --------------------------- | ----------------------------------------------- |
| `README.md`                         | Kept                        | Source for overview; indexed                    |
| `docs/roadmap.md`                   | Kept in place               | Indexed; open items feed STATUS                 |
| `docs/decisions.md`                 | Kept in place (13 sections) | Indexed as ADR-001..013 in `decisions/INDEX.md` |
| `docs/design/design-exploration.md` | Kept in place               | Indexed                                         |
| `docs/design/screens/*.png` (19)    | Kept                        | Indexed as a folder                             |

**Created:** `CLAUDE.md`, `docs/INDEX.md`, `PROJECT_OVERVIEW.md` (DOC-001), `CURRENT_STATUS.md` (STATUS-001), `DOCUMENTATION_STANDARD.md` (DOC-002), `decisions/INDEX.md`, this report (DOC-003).
**Not created (no content yet):** tasks, research, handoffs folders.

## Conflicts

- None open. The README and design doc contradictions found by the audit were fixed in commit `cf1ae51`.

## Needs review

- `decisions.md`, `roadmap.md` and `design-exploration.md` have no frontmatter (by choice); add it later if machine-readability matters.
- Resolved after review (2026-11-19): ADR dates filled from git; `design-exploration.md` confirmed as a living spec, with its status line, §0, §8, and §11 items 1, 17 and 20 updated. §11 items 4, 15 and others were not re-triaged.
- Open: roadmap "decorative waveform" and "track-level favourites" were not confirmed as wanted.

## Validation

- Originals: all 4 doc files and 19 screenshots still exist (Verified: `git status` shows no changes to them).
- Secrets: none found.
- Links in new docs: PASS (every relative link and `decisions.md` anchor resolves; scripted check, 2026-11-19).
- Unit tests: PASS, 158 (`npm test`).
