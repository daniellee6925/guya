# ADR-016: Constantia log layout split by author — `log/guya/` + `log/telos/`

**Status:** Accepted
**Date:** 2026-05-04

## Decision

Constantia's `log/` directory split by author into `log/guya/` and `log/telos/`. Filenames drop the redundant `-{author}-` segment — author = directory now. Telos uses single-trailing-segment names: `YYYY-MM-DD-tick.md` and `YYYY-MM-DD-reflection.md`.

Pre-commit hook validates per-author regex and rejects `log/` root with explicit error. Post-commit hook walks subdirs via `find` and adds Path column to log manifest.

## Why

26+ flat files in `log/` were unscannable as the system grew. Author-based split mirrors the architecture's ownership boundary cleanly (Guya-owned vs Telos-owned writes).

Migrated 23 existing logs in single commit (constantia commit `d33aa4e`).

Hooks installed as symlinks in `.git/hooks/` on both laptop AND mini — closed the silent rot where mini's hook was missing entirely (only `pre-commit.sample` existed), letting `tick.md` filenames commit despite not matching the regex.

Daniel chose author-based over my type-based proposal (`sessions/` + `reflections/`) — author-split mirrors ownership; type-mixing within a dir is acceptable for ~2 files/day.

Note: `/guya-reflect` skill updated in same arc to write into the new path (guya commit `03b297f`).

Same meta-pattern as ADR-011/012/013 — silent rot of trusted enforcement at the data-validation tier this time.
