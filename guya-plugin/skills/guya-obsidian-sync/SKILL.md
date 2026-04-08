---
name: guya-obsidian-sync
description: Sync Guya's knowledge to Obsidian vault. Use when asked "sync obsidian", "update vault", "obsidian sync", or at session end.
argument-hint: "[full] for complete rewrite or empty for incremental update"
---

# Obsidian Sync — Guya Knowledge to Wiki

Push Guya's knowledge (projects, growth, session insights) into the Obsidian wiki vault at `~/Desktop/secrets/`.

## When This Triggers

- User says "sync obsidian", "update vault", "obsidian sync", "push to wiki"
- Also runs semi-automatically at SessionEnd (via hook)

## What To Sync

### 1. Growth Tracker (`wiki/syntheses/growth-tracker.md`)

Read `~/.claude/guya/growth-tracker.md` and update the wiki synthesis page:
- Update grades if changed
- Add new trajectory entries
- Update milestone status
- Append to the changelog with today's date and what changed

### 2. Project Entity Pages (`wiki/entities/`)

For each active project (guya, sdf, bosonai):
- Read the project's `STATUS.md` (if it exists in the project directory)
- Read the project's `.guya/memory/archival/` file (if it exists)
- Update the entity page's "Current State" section
- Add new timeline entries if there are new milestones

### 3. Daniel Entity Page (`wiki/entities/daniel-lee.md`)

- Update "Active Projects" section with current status
- Update growth summary pointer

### 4. Index and Log

- Update `wiki/index.md` if any new pages were created
- Append to `wiki/log.md` with a summary of what was synced

## Vault Conventions (MUST follow)

- **Frontmatter**: Every page has YAML frontmatter with title, type, created, updated, tags, sources
- **Wikilinks**: Use `[[page-name]]` for all cross-references (filename only, no subdirectory)
- **Filenames**: kebab-case
- **Sources immutable**: Never touch `raw/`
- **Update `updated:` date** in frontmatter when modifying a page

## Modes

### Incremental (default, no args or `/guya-obsidian-sync`)

Only update pages where the source data has changed. Compare timestamps or content hashes. Skip pages that are already current.

### Full (`/guya-obsidian-sync full`)

Rewrite all Guya-managed pages from scratch. Use when the wiki structure needs a refresh.

## Rules

- **Don't invent content.** Only write what's in Guya's memory or project state.
- **Preserve manual edits.** If someone added content to a wiki page outside of sync, keep it.
- **Be concise.** Wiki pages should be scannable, not exhaustive.
- **Cross-reference aggressively.** Link to concepts, entities, and sources that already exist in the vault.
- **Flag what changed.** In the log entry, list specific updates made.
