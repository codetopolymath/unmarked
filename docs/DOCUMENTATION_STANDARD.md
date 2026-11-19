---
id: DOC-002
title: 'Documentation Standard (project summary)'
type: runbook
status: active
created: 2026-11-19
updated: 2026-11-19
project: unmarked
tags: [standard]
related: [DOC-001]
---

# Documentation Standard

Short, project-local summary of the `project-documentation` skill (PKB v1.0). Works without the skill.

## Principles

- Concise and scannable: bullets, tables, summary first, details linked.
- One canonical home per fact; link, don't copy.
- Evidence over assumption. Code = truth for _what is_; docs = intent, decisions, progress.
- Diagrams (Mermaid) only when they explain something.
- No secrets, ever. Use env var names.

## Metadata (frontmatter)

`id`, `title`, `type`, `status`, `created`, `updated`, `project`, `tags`, `related`.

- Types: overview, requirement, architecture, technical-design, adr, research, task, handoff, status, report, runbook, troubleshooting, meeting-notes, experiment.
- Status: draft, active, planned, in-progress, blocked, completed, verified, deprecated, archived (ADR: proposed, accepted, superseded, rejected).

## IDs and names

`TASK-001` · `ADR-001` · `RES-001` · `EXP-001` · `REQ-001` · `HANDOFF-YYYY-MM-DD-NN`. Next = highest + 1; never reuse.
Files: `tasks/TASK-001-slug.md`, `decisions/ADR-014-slug.md`, `research/RES-001-slug.md`, `handoffs/YYYY-MM-DD-topic.md`.

## Claims

Label: **Verified** (with evidence) · **Inferred** · **Assumption** · **Unknown**. Tests: PASS / FAIL / NOT RUN.

## Where things live

Overview → `PROJECT_OVERVIEW.md` · Now → `CURRENT_STATUS.md` (rewrite, don't append) · Why → ADR · Findings → research · Work → task · Session state → handoff.

## Project conventions (existing layout kept)

- `docs/decisions.md` is the canonical home for ADR-001..013; `docs/decisions/INDEX.md` indexes it. ADR-014 onward are separate files.
- `docs/roadmap.md` is the open-work checklist; `docs/design/design-exploration.md` is the design system and interaction spec.
- Original docs have no frontmatter; they are indexed, not rewritten.

## Session flow

- **Start:** INDEX → STATUS → active task → latest handoff → check code/git.
- **During:** keep task current; record decisions/findings/blockers.
- **End:** update task + status; handoff with an exact resume point.

## Don't

Create empty docs · duplicate facts · log trivial changes · delete old docs without approval.
