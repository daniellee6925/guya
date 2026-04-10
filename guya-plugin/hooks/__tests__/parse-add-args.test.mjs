/**
 * parse-add-args.test.mjs — Shell-aware git add argument tokenizer
 *
 * PURPOSE:
 *   Pins the parseAddArgs tokenizer that feeds getStagedFiles TOCTOU
 *   mitigation. The original split(/\s+/) parser broke on quoted paths
 *   (e.g. "file with spaces.js") — each token became a garbage fragment,
 *   the staged set ended up empty, and isSmallChange returned true,
 *   bypassing the review gate.
 *
 *   Codex caught this during the allowlist drift fix session (2026-04-09).
 *   Fix: shell-aware regex tokenizer that handles double-quoted,
 *   single-quoted, and unquoted tokens, stripping flag arguments.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseAddArgs } from '../guya-pre-commit-review.mjs';

describe('parseAddArgs: shell-aware tokenizer', () => {
  it('parses a double-quoted path with spaces', () => {
    const result = parseAddArgs('"file with spaces.js"');
    assert.deepEqual(result, ['file with spaces.js']);
  });

  it('parses a single-quoted path with spaces', () => {
    const result = parseAddArgs("'another spaced file.js'");
    assert.deepEqual(result, ['another spaced file.js']);
  });

  it('parses mixed quoted and unquoted paths', () => {
    const result = parseAddArgs('normal.js "quoted file.js" other.js');
    assert.deepEqual(result, ['normal.js', 'quoted file.js', 'other.js']);
  });

  it('regression: multiple unquoted paths still work', () => {
    const result = parseAddArgs('hooks/guya-pre-commit-review.mjs hooks/hook-utils.mjs');
    assert.deepEqual(result, [
      'hooks/guya-pre-commit-review.mjs',
      'hooks/hook-utils.mjs',
    ]);
  });

  it('filters out flag arguments', () => {
    const result = parseAddArgs('-A "file with spaces.js" --force normal.js');
    assert.deepEqual(result, ['file with spaces.js', 'normal.js']);
  });

  it('returns empty array for empty string', () => {
    assert.deepEqual(parseAddArgs(''), []);
  });
});
