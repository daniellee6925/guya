/**
 * apply-synthesis-result.test.mjs — Phase 2 file-mutation contract tests
 *
 * PURPOSE:
 *   Lock in the contract for applyGuidelineEdits + applyUserProfileAdditions
 *   before they're invoked from /guya-evolve. These functions write to the
 *   identity repo and commit the result — wrong file content or wrong
 *   section targeting silently corrupts ~/.claude/guya/.
 *
 * COVERAGE:
 *   1. Create a new guideline file with correct frontmatter shape
 *   2. Reinforce bumps confidence + lastValidated, preserves body
 *   3. Update replaces body, preserves frontmatter, bumps lastValidated
 *   4. Reinforce/update with missing id → error, no write
 *   5. Reinforce/update with non-existent id → error, no write
 *   6. user.md addition appends bullet under correct section
 *   7. user.md addition with non-existent section → error
 *   8. Multiple additions to same section both land in correct order
 *   9. appendBulletToSection as a pure unit
 *  10. Empty edits/additions → no write, no commit
 *  11. commit: false skips the commit phase
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

import {
  applyGuidelineEdits,
  applyUserProfileAdditions,
  appendBulletToSection,
  touchLastEvolved,
} from '../apply-synthesis-result.mjs';

// --- Fixtures ---

function makeTmpGuyaRepo() {
  const root = mkdtempSync(join(tmpdir(), 'guya-apply-'));
  // Create the guidelines/strategic dir
  mkdirSync(join(root, 'guidelines', 'strategic'), { recursive: true });
  // Seed user.md so additions can find sections
  writeFileSync(
    join(root, 'user.md'),
    '# Daniel\n\n## Basics\n- 26, west coast\n\n## How He Thinks\n- Systems thinker\n- First principles\n\n## Key Patterns to Watch\n- Over-explores\n',
  );
  // Init as a git repo so commit-identity can commit
  execSync('git init -b main', { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
  execSync('git config user.email test@guya.local', { cwd: root });
  execSync('git config user.name "Guya Test"', { cwd: root });
  // Initial commit so HEAD exists
  execSync('git add .', { cwd: root });
  execSync('git commit -m seed', { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
  return root;
}

function readGuideline(repo, filename) {
  return readFileSync(join(repo, 'guidelines', 'strategic', filename), 'utf-8');
}

function listGuidelines(repo) {
  return execSync('ls guidelines/strategic', { cwd: repo, encoding: 'utf-8' }).trim().split('\n').filter(Boolean);
}

// --- Tests ---

describe('appendBulletToSection (pure)', () => {
  const sample = '# Daniel\n\n## Basics\n- one\n- two\n\n## How He Thinks\n- alpha\n- beta\n\n## Key Patterns to Watch\n- gamma\n';

  it('appends bullet at end of section, before next header', () => {
    const out = appendBulletToSection(sample, 'How He Thinks', 'new fact');
    assert.match(out, /- alpha\n- beta\n- new fact\n/);
    // Following section preserved
    assert.match(out, /## Key Patterns to Watch\n- gamma/);
  });

  it('preserves blank line before next section header (regression: v1 glued sections)', () => {
    // Phase 2 verification caught this: the first real /guya-evolve run
    // produced user.md with "- bullet\n## Next Section" (no blank line),
    // which some markdown renderers treat as a continuation of the bullet
    // instead of a new heading. Fix was in appendBulletToSection; this
    // test pins the fix so it can't regress silently.
    const out = appendBulletToSection(sample, 'How He Thinks', 'new fact');
    assert.match(out, /- new fact\n\n## Key Patterns to Watch/);
  });

  it('appends to last section when no following header', () => {
    const out = appendBulletToSection(sample, 'Key Patterns to Watch', 'new pattern');
    assert.match(out, /- gamma\n- new pattern/);
  });

  it('returns null when section header is missing', () => {
    const out = appendBulletToSection(sample, 'Nonexistent Section', 'x');
    assert.equal(out, null);
  });

  it('preserves earlier sections exactly', () => {
    const out = appendBulletToSection(sample, 'How He Thinks', 'x');
    assert.match(out, /## Basics\n- one\n- two/);
  });

  it('handles content with leading/trailing whitespace', () => {
    const out = appendBulletToSection(sample, 'How He Thinks', '   trimmed   ');
    assert.match(out, /- trimmed\n/);
  });

  it('multiple additions to same section keep blank line before next header', () => {
    // Chain two calls — second call sees output of first. Verifies the
    // invariant holds across repeated inserts to the same section.
    let out = appendBulletToSection(sample, 'How He Thinks', 'first');
    out = appendBulletToSection(out, 'How He Thinks', 'second');
    assert.match(out, /- first\n- second\n\n## Key Patterns to Watch/);
  });
});

describe('applyGuidelineEdits', () => {
  let repo;
  beforeEach(() => { repo = makeTmpGuyaRepo(); });
  afterEach(() => { rmSync(repo, { recursive: true, force: true }); });

  it('create: writes a new guideline file with correct frontmatter shape', () => {
    const edits = [{
      action: 'create',
      domain: 'workflow',
      body: 'Always pwd before git operations',
      confidence: 0.9,
      sourceReflections: ['2026-04-10-manual.md'],
    }];
    const result = applyGuidelineEdits(edits, { globalDir: repo });

    assert.equal(result.errors.length, 0);
    assert.equal(result.written.length, 1);
    const filename = result.written[0];
    const content = readGuideline(repo, filename);

    assert.match(content, /^---\n/);
    assert.match(content, /^id: guideline-/m);
    assert.match(content, /^domain: workflow$/m);
    assert.match(content, /^confidence: 0\.9$/m);
    assert.match(content, /^rank: 50$/m);
    assert.match(content, /sourceReflections: \["2026-04-10-manual\.md"\]/);
    assert.match(content, /Always pwd before git operations/);

    // Commit landed
    assert.ok(result.commit);
    assert.equal(result.commit.committed, true);
    assert.match(result.commit.sha, /^[0-9a-f]{40}$/);
  });

  it('reinforce: bumps confidence and lastValidated, preserves body', () => {
    // Seed an existing guideline
    const seed = `---
id: guideline-test-001
domain: communication
confidence: 0.7
created: 2026-04-01
lastValidated: 2026-04-01
rank: 50
---

Original body content here.
`;
    writeFileSync(join(repo, 'guidelines', 'strategic', 'guideline-test-001.md'), seed);
    execSync('git add . && git commit -m seed-guideline', { cwd: repo, stdio: ['pipe', 'pipe', 'pipe'] });

    const edits = [{ action: 'reinforce', id: 'guideline-test-001', sourceReflections: ['x.md'] }];
    const result = applyGuidelineEdits(edits, { globalDir: repo });

    assert.equal(result.errors.length, 0);
    assert.equal(result.written.length, 1);
    const after = readGuideline(repo, 'guideline-test-001.md');
    assert.match(after, /confidence: 0\.75/);
    assert.match(after, /lastValidated: \d{4}-\d{2}-\d{2}/);
    assert.doesNotMatch(after, /lastValidated: 2026-04-01/);
    assert.match(after, /Original body content here\./);
  });

  it('update: replaces body, preserves frontmatter id, bumps lastValidated', () => {
    const seed = `---
id: guideline-test-002
domain: workflow
confidence: 0.8
created: 2026-03-01
lastValidated: 2026-03-15
rank: 50
---

Old body.
`;
    writeFileSync(join(repo, 'guidelines', 'strategic', 'guideline-test-002.md'), seed);
    execSync('git add . && git commit -m seed-guideline-2', { cwd: repo, stdio: ['pipe', 'pipe', 'pipe'] });

    const edits = [{ action: 'update', id: 'guideline-test-002', newBody: 'New body content.', sourceReflections: ['y.md'] }];
    const result = applyGuidelineEdits(edits, { globalDir: repo });

    assert.equal(result.errors.length, 0);
    const after = readGuideline(repo, 'guideline-test-002.md');
    assert.match(after, /id: guideline-test-002/);
    assert.match(after, /confidence: 0\.8/); // unchanged
    assert.doesNotMatch(after, /Old body\./);
    assert.match(after, /New body content\./);
    assert.doesNotMatch(after, /lastValidated: 2026-03-15/);
  });

  it('reinforce with missing id → error, no write', () => {
    const result = applyGuidelineEdits([{ action: 'reinforce' }], { globalDir: repo });
    assert.equal(result.written.length, 0);
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /missing id/);
  });

  it('reinforce with non-existent id → error, no write', () => {
    const result = applyGuidelineEdits([{ action: 'reinforce', id: 'guideline-nope' }], { globalDir: repo });
    assert.equal(result.written.length, 0);
    assert.match(result.errors[0], /target not found/);
  });

  it('reinforce: target file with no confidence field → error, NO silent reset', () => {
    // Regression: earlier version defaulted to 0.5 when confidence line was
    // missing, silently destroying any real confidence value.
    const seed = `---
id: guideline-no-conf
domain: workflow
created: 2026-04-01
lastValidated: 2026-04-01
rank: 50
---

Body without confidence in frontmatter.
`;
    writeFileSync(join(repo, 'guidelines', 'strategic', 'guideline-no-conf.md'), seed);
    execSync('git add . && git commit -m seed-no-conf', { cwd: repo, stdio: ['pipe', 'pipe', 'pipe'] });

    const result = applyGuidelineEdits([{ action: 'reinforce', id: 'guideline-no-conf' }], { globalDir: repo });
    assert.equal(result.written.length, 0);
    assert.match(result.errors[0], /no valid confidence/);
    // File on disk must be untouched
    const after = readGuideline(repo, 'guideline-no-conf.md');
    assert.equal(after, seed);
  });

  it('update: target file with no frontmatter anchor → error, untouched', () => {
    // Defensive: if a file somehow lost its leading frontmatter delimiter,
    // the update path must not mutate the wrong region.
    const seed = 'This file has no frontmatter at all.\n---\nFake delimiter inside body.\n';
    writeFileSync(join(repo, 'guidelines', 'strategic', 'guideline-no-fm.md'), seed);
    // Add an id line so findGuidelineFile finds it (it grep's the raw text)
    writeFileSync(join(repo, 'guidelines', 'strategic', 'guideline-no-fm.md'),
      'prefix line\nid: guideline-no-fm\n' + seed);
    execSync('git add . && git commit -m seed-no-fm', { cwd: repo, stdio: ['pipe', 'pipe', 'pipe'] });

    const result = applyGuidelineEdits([{ action: 'update', id: 'guideline-no-fm', newBody: 'new' }], { globalDir: repo });
    assert.equal(result.written.length, 0);
    assert.match(result.errors[0], /no frontmatter anchor/);
  });

  it('create: sanitizes newlines in domain field to prevent frontmatter corruption', () => {
    const edits = [{
      action: 'create',
      domain: 'workflow\nmalicious: true',
      body: 'body',
      confidence: 0.5,
      sourceReflections: [],
    }];
    const result = applyGuidelineEdits(edits, { globalDir: repo });
    assert.equal(result.errors.length, 0);
    const content = readGuideline(repo, result.written[0]);
    // Newline must be sanitized — no literal "malicious: true" on its own line
    assert.doesNotMatch(content, /^malicious: true/m);
    assert.match(content, /^domain: workflow malicious: true$/m);
  });

  it('empty edits → no write, no commit', () => {
    const result = applyGuidelineEdits([], { globalDir: repo });
    assert.equal(result.written.length, 0);
    assert.equal(result.errors.length, 0);
    assert.equal(result.commit, null);
  });

  it('commit: false skips the commit phase', () => {
    const edits = [{
      action: 'create',
      domain: 'workflow',
      body: 'test',
      confidence: 0.9,
      sourceReflections: [],
    }];
    const result = applyGuidelineEdits(edits, { globalDir: repo, commit: false });
    assert.equal(result.written.length, 1);
    assert.equal(result.commit, null);
  });
});

describe('applyUserProfileAdditions', () => {
  let repo;
  beforeEach(() => { repo = makeTmpGuyaRepo(); });
  afterEach(() => { rmSync(repo, { recursive: true, force: true }); });

  it('appends a bullet under the correct section', () => {
    const additions = [{ section: 'How He Thinks', content: 'New observation', sourceReflections: ['a.md'] }];
    const result = applyUserProfileAdditions(additions, { globalDir: repo });

    assert.equal(result.errors.length, 0);
    assert.deepEqual(result.written, ['user.md']);
    const content = readFileSync(join(repo, 'user.md'), 'utf-8');
    assert.match(content, /## How He Thinks\n- Systems thinker\n- First principles\n- New observation/);
    // Other sections preserved
    assert.match(content, /## Basics\n- 26, west coast/);
    assert.match(content, /## Key Patterns to Watch\n- Over-explores/);
    // Commit landed
    assert.equal(result.commit.committed, true);
  });

  it('multiple additions to same section all land in order', () => {
    const additions = [
      { section: 'How He Thinks', content: 'First new', sourceReflections: [] },
      { section: 'How He Thinks', content: 'Second new', sourceReflections: [] },
    ];
    const result = applyUserProfileAdditions(additions, { globalDir: repo });
    assert.equal(result.errors.length, 0);
    const content = readFileSync(join(repo, 'user.md'), 'utf-8');
    assert.match(content, /- First new\n- Second new/);
  });

  it('non-existent section → error, no write of that item', () => {
    const additions = [
      { section: 'Nonexistent', content: 'x', sourceReflections: [] },
      { section: 'How He Thinks', content: 'valid', sourceReflections: [] },
    ];
    const result = applyUserProfileAdditions(additions, { globalDir: repo });
    assert.equal(result.errors.length, 1);
    assert.match(result.errors[0], /section not found/);
    assert.equal(result.written.length, 1); // user.md was still written for the valid one
    const content = readFileSync(join(repo, 'user.md'), 'utf-8');
    assert.match(content, /- valid\n/);
  });

  it('missing user.md → error, no write', () => {
    rmSync(join(repo, 'user.md'));
    const result = applyUserProfileAdditions([{ section: 'Basics', content: 'x' }], { globalDir: repo });
    assert.equal(result.written.length, 0);
    assert.match(result.errors[0], /user\.md not found/);
  });

  it('empty additions → no write, no commit', () => {
    const result = applyUserProfileAdditions([], { globalDir: repo });
    assert.equal(result.written.length, 0);
    assert.equal(result.commit, null);
  });
});

describe('touchLastEvolved', () => {
  let repo;
  beforeEach(() => { repo = makeTmpGuyaRepo(); });
  afterEach(() => { rmSync(repo, { recursive: true, force: true }); });

  it('writes ISO timestamp + summary to .last-evolved', () => {
    touchLastEvolved(repo, { applied: 5, rejected: 1 });
    const content = readFileSync(join(repo, '.last-evolved'), 'utf-8');
    const parsed = JSON.parse(content);
    assert.match(parsed.ts, /^\d{4}-\d{2}-\d{2}T/);
    assert.equal(parsed.applied, 5);
    assert.equal(parsed.rejected, 1);
  });
});
