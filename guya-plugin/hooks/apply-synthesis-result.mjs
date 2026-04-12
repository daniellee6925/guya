/**
 * apply-synthesis-result.mjs — Apply approved items from a synthesis result
 *
 * CALLING SPEC:
 *   Exports:
 *     - applyGuidelineEdits(edits, opts) -> { written: [...], errors: [...], commit }
 *     - applyUserProfileAdditions(additions, opts) -> { written: [...], errors: [...], commit }
 *     - touchLastEvolved(globalDir) -> void
 *
 *   Each apply function:
 *     1. Walks the approved items
 *     2. Performs the file mutation (write new guideline / append to user.md / etc.)
 *     3. Calls commit-identity to land the changes as a single commit per stream
 *     4. Returns a structured result so the caller (guya-evolve skill) can show
 *        Daniel exactly what was applied and what failed
 *
 *   Why a separate module from reflection-synthesis.mjs:
 *     Synthesis (read + LLM call) and application (file mutation + commit) have
 *     different failure modes, different test surfaces, and different blast
 *     radii. Splitting them keeps each module under the 800 LOC rule and lets
 *     the manual /guya-evolve workflow call them in sequence with explicit
 *     review between.
 *
 *   Identity proposals are NOT handled here. They have high blast radius and
 *   the skill applies them via the Edit tool (per-item, with diff visible),
 *   then calls commitIdentityChange() directly. This module only handles the
 *   mechanical low-blast streams.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import { commitIdentityChange } from './commit-identity.mjs';

const DEFAULT_GLOBAL_DIR = join(homedir(), '.claude', 'guya');
const LOG_PREFIX = '[guya-apply-synthesis]';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function readFileSafe(path) {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
}

// --- Guideline writers ---

/**
 * Strip CR/LF from a frontmatter field value. The synthesizer is trusted
 * to return clean values, but an embedded newline in `domain` or `id`
 * would corrupt the YAML frontmatter silently — future `parseGuidelineFrontmatter`
 * calls would read the wrong line as a field. Cheap boundary defense.
 */
function sanitizeField(v) {
  if (typeof v !== 'string') return v;
  return v.replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Generate the on-disk markdown for a new strategic guideline.
 * Frontmatter shape matches existing guidelines so the SessionStart hook
 * parser (parseGuidelineFrontmatter) reads it correctly.
 */
function renderGuidelineFile(edit) {
  const id = sanitizeField(edit.id) || `guideline-${randomUUID()}`;
  const today = todayIso();
  const frontmatter = [
    '---',
    `id: ${id}`,
    `domain: ${sanitizeField(edit.domain) || 'general'}`,
    `confidence: ${edit.confidence ?? 0.5}`,
    `created: ${edit.created || today}`,
    `lastValidated: ${edit.lastValidated || today}`,
    `sourceReflections: ${JSON.stringify(edit.sourceReflections || [])}`,
    `rank: ${edit.rank ?? 50}`,
    '---',
    '',
    // Body is allowed to contain newlines (it's prose), but strip the
    // pathological case of a literal `---` line that would collide with
    // frontmatter delimiters on future parses.
    (edit.body || '').replace(/^---\s*$/gm, '— — —'),
    '',
  ].join('\n');
  return { id, content: frontmatter };
}

/**
 * Find the guideline file whose frontmatter declares the given id.
 * Linear scan — strategic dir has ≲100 files in any realistic state.
 * Returns the filename or null.
 */
function findGuidelineFile(strategicDir, id) {
  if (!id) return null;
  let files;
  try {
    files = readdirSync(strategicDir).filter(f => f.endsWith('.md'));
  } catch {
    return null;
  }
  // Use line-anchored regex, not substring .includes(), to prevent partial
  // id collisions (e.g., searching for "guideline-foo" matching a file
  // containing "id: guideline-foobar"). Caught during guya-deep-review.
  const idPattern = new RegExp(`^id:\\s*${id.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*$`, 'm');
  for (const f of files) {
    const raw = readFileSafe(join(strategicDir, f));
    if (raw && idPattern.test(raw)) return f;
  }
  return null;
}

/**
 * Apply approved guideline edits.
 *
 * @param {Array} edits - The approved guidelineEdits from the synthesizer
 * @param {object} opts
 * @param {string} [opts.globalDir] - Path to ~/.claude/guya
 * @param {boolean} [opts.commit=true] - Whether to commit after writing
 * @returns {{ written: string[], errors: string[], commit: object|null }}
 */
export function applyGuidelineEdits(edits, opts = {}) {
  const globalDir = opts.globalDir || DEFAULT_GLOBAL_DIR;
  const shouldCommit = opts.commit !== false;
  const strategicDir = join(globalDir, 'guidelines', 'strategic');
  if (!existsSync(strategicDir)) {
    try { mkdirSync(strategicDir, { recursive: true }); } catch {}
  }

  const written = [];
  const errors = [];

  for (const edit of edits) {
    const action = edit.action || 'create';

    if (action === 'create') {
      try {
        const { id, content } = renderGuidelineFile(edit);
        const filename = `${id}.md`;
        const path = join(strategicDir, filename);
        writeFileSync(path, content, 'utf-8');
        written.push(filename);
      } catch (err) {
        errors.push(`create failed: ${err.message}`);
      }
      continue;
    }

    if (action === 'reinforce' || action === 'update') {
      if (!edit.id) {
        errors.push(`${action} missing id`);
        continue;
      }
      const targetFile = findGuidelineFile(strategicDir, edit.id);
      if (!targetFile) {
        errors.push(`${action} target not found: ${edit.id}`);
        continue;
      }

      try {
        const path = join(strategicDir, targetFile);
        const raw = readFileSafe(path);
        if (!raw) {
          errors.push(`${action} could not read ${targetFile}`);
          continue;
        }
        // Require frontmatter-anchored file start. An un-anchored search would
        // find the wrong `---` position for files with content before the
        // frontmatter (shouldn't happen, but defense in depth) and silently
        // mutate the wrong region.
        if (!raw.startsWith('---\n')) {
          errors.push(`${action} target has no frontmatter anchor: ${edit.id}`);
          continue;
        }

        let updated = raw;
        const today = todayIso();
        if (action === 'reinforce') {
          // Bump confidence by 0.05 (capped at 1.0) and update lastValidated.
          // Silent-reset defense: fail if the existing file has no confidence
          // field rather than defaulting to 0.5 and bumping from there, which
          // would silently destroy the real confidence score on any file with
          // a malformed frontmatter.
          const confMatch = raw.match(/^confidence:\s*([\d.]+)$/m);
          if (!confMatch) {
            errors.push(`reinforce target has no valid confidence field: ${edit.id}`);
            continue;
          }
          const oldConf = parseFloat(confMatch[1]);
          if (!Number.isFinite(oldConf)) {
            errors.push(`reinforce target has non-numeric confidence: ${edit.id}`);
            continue;
          }
          const newConf = Math.min(1.0, Math.round((oldConf + 0.05) * 100) / 100);
          updated = updated.replace(/^confidence:.*$/m, `confidence: ${newConf}`);
          updated = updated.replace(/^lastValidated:.*$/m, `lastValidated: ${today}`);
        } else if (action === 'update') {
          if (!edit.newBody) {
            errors.push(`update missing newBody for ${edit.id}`);
            continue;
          }
          // Replace the body (everything after the closing ---) with newBody.
          // Update lastValidated since the body changed.
          updated = updated.replace(/^lastValidated:.*$/m, `lastValidated: ${today}`);
          // With the startsWith('---\n') guard above, we know the opening
          // delimiter is at position 0. Search for the closing `\n---\n`
          // starting from position 4 (past `---\n`).
          const fmEnd = updated.indexOf('\n---\n', 4);
          if (fmEnd === -1) {
            errors.push(`update could not locate frontmatter end for ${edit.id}`);
            continue;
          }
          updated = updated.slice(0, fmEnd + 5) + '\n' + edit.newBody.trim() + '\n';
        }
        writeFileSync(path, updated, 'utf-8');
        written.push(targetFile);
      } catch (err) {
        errors.push(`${action} write failed for ${edit.id}: ${err.message}`);
      }
      continue;
    }

    errors.push(`unknown action: ${action}`);
  }

  process.stderr.write(
    `${LOG_PREFIX} guidelines: wrote ${written.length}, errors ${errors.length}\n`
  );

  let commit = null;
  if (shouldCommit && written.length > 0) {
    const message = [
      `evolve(guidelines): apply ${written.length} approved edit(s)`,
      '',
      'Approved via /guya-evolve. Files touched:',
      ...written.map(f => `  - guidelines/strategic/${f}`),
    ].join('\n');
    commit = commitIdentityChange({
      message,
      files: written.map(f => `guidelines/strategic/${f}`),
      repoPath: globalDir,
    });
  }

  return { written, errors, commit };
}

// --- user.md additions ---

/**
 * Append `content` as a bullet under the named section in user.md.
 *
 * Algorithm: find `## ${section}` line, scan forward to the next `## ` or
 * end-of-file, insert the new bullet just before that boundary. Preserves
 * existing content exactly. Returns the updated full file string OR null
 * if the section header isn't found (caller decides whether to error or
 * create the section).
 *
 * Pure function — exported for unit testing.
 */
export function appendBulletToSection(userMd, section, content) {
  const headerRe = new RegExp(`^## ${section.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\s*$`, 'm');
  const match = userMd.match(headerRe);
  if (!match) return null;

  const headerEnd = match.index + match[0].length;
  // Find the next "## " header after this one, or end of file.
  const rest = userMd.slice(headerEnd);
  const nextHeaderRe = /\n## /;
  const nextMatch = rest.match(nextHeaderRe);
  const nextHeaderAt = nextMatch ? headerEnd + nextMatch.index : userMd.length;

  // Trim trailing newlines from the section so we insert cleanly.
  const before = userMd.slice(0, nextHeaderAt).replace(/\n+$/, '');
  const after = userMd.slice(nextHeaderAt);
  const bullet = `- ${content.trim()}`;

  // If there's a following section, always leave a blank line between the
  // appended bullet and the next `## ` header — otherwise markdown parsers
  // render the header as plain text glued to the bullet. `after` here starts
  // with `\n## ` (because nextHeaderRe matched `\n## `), so the naive join
  // `before + '\n' + bullet + '\n' + '## '` yields only ONE blank line before
  // the header. We need TWO newlines between the last bullet and the `##`.
  //
  // Earlier version emitted `\n` when after began with `\n`, silently
  // producing `...- bullet\n## Header` (missing blank line). Caught during
  // Phase 2 verification — user.md ended up with glued sections after the
  // first real /guya-evolve run.
  if (after.startsWith('\n## ')) {
    return `${before}\n${bullet}\n${after}`;
  }
  // End-of-file case: no following header, preserve tail newlines minimally.
  const sep = after.startsWith('\n') ? '' : '\n';
  return `${before}\n${bullet}${sep}${after}`;
}

/**
 * Apply approved user profile additions by appending each one as a bullet
 * under its target section in ~/.claude/guya/user.md.
 *
 * @param {Array} additions - The approved userProfileAdditions
 * @param {object} opts
 * @param {string} [opts.globalDir]
 * @param {boolean} [opts.commit=true]
 * @returns {{ written: string[], errors: string[], commit: object|null }}
 */
export function applyUserProfileAdditions(additions, opts = {}) {
  const globalDir = opts.globalDir || DEFAULT_GLOBAL_DIR;
  const shouldCommit = opts.commit !== false;
  const userPath = join(globalDir, 'user.md');

  const errors = [];
  if (!existsSync(userPath)) {
    errors.push(`user.md not found at ${userPath}`);
    return { written: [], errors, commit: null };
  }

  let userMd = readFileSafe(userPath);
  if (userMd === null) {
    errors.push(`could not read user.md`);
    return { written: [], errors, commit: null };
  }

  const appliedSections = [];
  for (const add of additions) {
    if (!add.section || !add.content) {
      errors.push(`addition missing section or content`);
      continue;
    }
    const updated = appendBulletToSection(userMd, add.section, add.content);
    if (updated === null) {
      errors.push(`section not found: "${add.section}"`);
      continue;
    }
    userMd = updated;
    appliedSections.push(add.section);
  }

  let written = [];
  if (appliedSections.length > 0) {
    try {
      writeFileSync(userPath, userMd, 'utf-8');
      written = ['user.md'];
    } catch (err) {
      errors.push(`write failed: ${err.message}`);
    }
  }

  process.stderr.write(
    `${LOG_PREFIX} user.md: applied ${appliedSections.length} addition(s), errors ${errors.length}\n`
  );

  let commit = null;
  if (shouldCommit && written.length > 0) {
    const sectionList = [...new Set(appliedSections)].join(', ');
    const message = [
      `evolve(user): apply ${appliedSections.length} profile addition(s)`,
      '',
      `Approved via /guya-evolve. Sections updated: ${sectionList}`,
    ].join('\n');
    commit = commitIdentityChange({
      message,
      files: ['user.md'],
      repoPath: globalDir,
    });
  }

  return { written, errors, commit };
}

// --- last-evolved marker ---

/**
 * Touch the .last-evolved timestamp file. Read by guya-session-start.mjs to
 * compute the "days since last evolve" nudge. Stores ISO timestamp + the
 * count of items applied in this run for richer reporting.
 */
export function touchLastEvolved(globalDir = DEFAULT_GLOBAL_DIR, summary = {}) {
  try {
    const path = join(globalDir, '.last-evolved');
    const payload = JSON.stringify({
      ts: new Date().toISOString(),
      ...summary,
    });
    writeFileSync(path, payload + '\n', 'utf-8');
  } catch (err) {
    process.stderr.write(`${LOG_PREFIX} touchLastEvolved failed: ${err.message}\n`);
  }
}
