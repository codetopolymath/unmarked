## Documentation

Use the `project-documentation` skill for documentation work: research, tasks, ADRs,
handoffs, audits, migrations, and resuming sessions. Don't invoke it for trivial edits.
Standard: `docs/DOCUMENTATION_STANDARD.md`. Map: `docs/INDEX.md`.

**Session start:** read `docs/INDEX.md` → `docs/CURRENT_STATUS.md` → active task → latest handoff.
Check code/git against the docs and flag mismatches before proceeding.

**While working:** record decisions (ADR), findings (research), blockers and progress (task).
Update docs when changes make them inaccurate. Don't document trivial changes.

**Session end (substantial work):** update task + status, write a handoff with an exact resume point.

**Rules:** never invent facts or test results (label Verified / Inferred / Assumption / Unknown;
PASS / FAIL / NOT RUN). Never delete docs during migration. No secrets in docs.

**Project convention:** decisions live in `docs/decisions.md` (indexed in `docs/decisions/INDEX.md`
as ADR-001..013). New decisions from ADR-014 on are separate files in `docs/decisions/`.
