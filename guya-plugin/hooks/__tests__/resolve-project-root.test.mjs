/**
 * resolve-project-root.test.mjs — resolveProjectRoot contract
 *
 * PURPOSE:
 *   Pins the git-root resolution helper that prevents phantom .guya/ state
 *   dirs when Claude Code fires hooks from a subdirectory (e.g. guya-plugin/).
 *
 *   Three behaviors:
 *   1. Subdirectory inside a git repo → returns the repo root (not the subdir)
 *   2. Non-git directory → returns the input path unchanged
 *   3. Unexpected git failure (exit != 128) → logs to stderr, returns input path
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { execSync } from 'child_process';

import { resolveProjectRoot } from '../hook-utils.mjs';

// Repo root of this project — resolveProjectRoot called from any subdir should
// return this path.
const REPO_ROOT = execSync('git rev-parse --show-toplevel', { encoding: 'utf-8' }).trim();

describe('resolveProjectRoot: git repo resolution', () => {
  it('returns repo root when called from the repo root itself', () => {
    assert.equal(resolveProjectRoot(REPO_ROOT), REPO_ROOT);
  });

  it('returns repo root when called from a subdirectory', () => {
    const subdir = join(REPO_ROOT, 'guya-plugin', 'hooks');
    assert.equal(resolveProjectRoot(subdir), REPO_ROOT);
  });

  it('returns repo root when called from a deeply nested subdirectory', () => {
    const deep = join(REPO_ROOT, 'guya-plugin', 'hooks', '__tests__');
    assert.equal(resolveProjectRoot(deep), REPO_ROOT);
  });
});

describe('resolveProjectRoot: non-git directory fallback', () => {
  it('returns the input path unchanged for a non-git temp dir', () => {
    const tmpDir = mkdtempSync(join(tmpdir(), 'guya-test-'));
    try {
      const result = resolveProjectRoot(tmpDir);
      assert.equal(result, tmpDir);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('resolveProjectRoot: unexpected failure handling', () => {
  it('returns the input path when git exits with code 128', () => {
    // A temp dir is not a git repo → git exits 128 → fallback, no log
    const tmpDir = mkdtempSync(join(tmpdir(), 'guya-test-'));
    try {
      const result = resolveProjectRoot(tmpDir);
      assert.equal(result, tmpDir);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('returns the input path for a non-existent dir (unexpected failure)', () => {
    // Non-existent cwd → execSync throws with a different error code → fallback
    const nonExistent = '/tmp/guya-nonexistent-dir-xyz-123';
    const result = resolveProjectRoot(nonExistent);
    assert.equal(result, nonExistent);
  });
});
