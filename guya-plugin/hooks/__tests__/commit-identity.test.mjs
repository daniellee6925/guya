/**
 * commit-identity.test.mjs — Verifies the identity-commit helper end-to-end
 *
 * PURPOSE:
 *   Lock in the contract that commitIdentityChange() actually creates a real
 *   git commit and surfaces every failure mode as a structured result. This
 *   is the foundation of the reflection-driven self-edit pipeline (Phase 1+):
 *   if this helper silently fails, Guya will appear to "evolve" without ever
 *   landing changes on disk. Same class of bug as the PostToolUse:Bash
 *   non-dispatch from 2026-04-10.
 *
 * COVERAGE:
 *   1. Happy path: dirty repo + valid message → commit lands, sha returned,
 *      audit log entry written
 *   2. No staged changes → returns { committed: false, reason: 'nothing-staged' },
 *      no commit created
 *   3. Specific files list → only those files staged and committed
 *   4. Missing message → returns { committed: false, reason: 'missing-message' }
 *   5. Non-repo path → returns { committed: false, reason: 'not-a-git-repo' }
 *   6. Multiline message preserved (uses git commit -F -, not shell escaping)
 *   7. Audit log NDJSON shape matches contract (ts, action, sha, ...)
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';

import { commitIdentityChange } from '../commit-identity.mjs';

function makeTmpRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'guya-commit-identity-'));
  execSync('git init -b main', { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
  // Set local identity so commits don't fail in CI environments without global config
  execSync('git config user.email test@guya.local', { cwd: dir });
  execSync('git config user.name "Guya Test"', { cwd: dir });
  // Seed an initial commit so HEAD exists for SHA queries
  writeFileSync(join(dir, 'README.md'), '# seed\n');
  execSync('git add README.md', { cwd: dir });
  execSync('git commit -m seed', { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'] });
  return dir;
}

function readAuditLog(repoPath) {
  const logPath = join(repoPath, '.commit-log');
  if (!existsSync(logPath)) return [];
  return readFileSync(logPath, 'utf-8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function getHeadSha(repoPath) {
  return execSync('git rev-parse HEAD', { cwd: repoPath, encoding: 'utf-8' }).trim();
}

describe('commitIdentityChange', () => {
  let repo;

  beforeEach(() => {
    repo = makeTmpRepo();
  });

  afterEach(() => {
    if (repo) rmSync(repo, { recursive: true, force: true });
  });

  it('happy path: dirty repo + valid message → commit lands and sha is returned', () => {
    writeFileSync(join(repo, 'soul.md'), '# soul v2\n');
    const headBefore = getHeadSha(repo);

    const result = commitIdentityChange({
      message: 'auto: update soul from reflection',
      repoPath: repo,
    });

    assert.equal(result.committed, true);
    assert.equal(result.reason, 'ok');
    assert.match(result.sha, /^[0-9a-f]{40}$/);
    assert.notEqual(result.sha, headBefore, 'HEAD must advance');
    assert.equal(getHeadSha(repo), result.sha);

    const log = readAuditLog(repo);
    const success = log.find(e => e.action === 'success');
    assert.ok(success, 'audit log must contain a success entry');
    assert.equal(success.sha, result.sha);
    assert.match(success.ts, /^\d{4}-\d{2}-\d{2}T/);
  });

  it('clean repo → returns nothing-staged, no commit', () => {
    const headBefore = getHeadSha(repo);

    const result = commitIdentityChange({
      message: 'auto: nothing to do',
      repoPath: repo,
    });

    assert.equal(result.committed, false);
    assert.equal(result.reason, 'nothing-staged');
    assert.equal(result.sha, null);
    assert.equal(getHeadSha(repo), headBefore, 'HEAD must NOT advance');

    const log = readAuditLog(repo);
    assert.ok(log.find(e => e.action === 'noop'), 'audit log must contain a noop entry');
  });

  it('specific files list → only listed files are committed', () => {
    writeFileSync(join(repo, 'a.md'), 'a');
    writeFileSync(join(repo, 'b.md'), 'b');

    const result = commitIdentityChange({
      message: 'auto: only a',
      files: ['a.md'],
      repoPath: repo,
    });

    assert.equal(result.committed, true);
    // a.md is in the commit, b.md is still untracked
    const status = execSync('git status --porcelain', { cwd: repo, encoding: 'utf-8' });
    assert.match(status, /\?\? b\.md/, 'b.md must remain untracked');
    const filesInCommit = execSync('git show --name-only --pretty=format: HEAD', {
      cwd: repo, encoding: 'utf-8',
    }).trim();
    assert.equal(filesInCommit, 'a.md');
  });

  it('missing message → rejected without committing', () => {
    writeFileSync(join(repo, 'soul.md'), 'x');
    const headBefore = getHeadSha(repo);

    const result = commitIdentityChange({ message: '', repoPath: repo });

    assert.equal(result.committed, false);
    assert.equal(result.reason, 'missing-message');
    assert.equal(getHeadSha(repo), headBefore);
  });

  it('non-repo path → returns not-a-git-repo cleanly', () => {
    const notRepo = mkdtempSync(join(tmpdir(), 'guya-not-repo-'));
    try {
      const result = commitIdentityChange({
        message: 'auto: should fail',
        repoPath: notRepo,
      });
      assert.equal(result.committed, false);
      assert.equal(result.reason, 'not-a-git-repo');
    } finally {
      rmSync(notRepo, { recursive: true, force: true });
    }
  });

  it('multiline message is preserved verbatim in the commit', () => {
    writeFileSync(join(repo, 'soul.md'), 'x');
    const message = 'auto: update soul\n\nReason: 2 reflections agreed Daniel\nwants more "convergence pressure".\n\nFiles: soul.md';

    const result = commitIdentityChange({ message, repoPath: repo });
    assert.equal(result.committed, true);

    const fullMessage = execSync('git log -1 --pretty=%B', { cwd: repo, encoding: 'utf-8' }).trim();
    assert.equal(fullMessage, message.trim());
  });
});
