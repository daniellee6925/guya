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

import { parseAddArgs, isShellExpansion } from '../guya-pre-commit-review.mjs';

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

  it('normalizes ./ prefix so paths match git diff --name-only output', () => {
    const result = parseAddArgs('./src/a.py ./src/b.py');
    assert.deepEqual(result, ['src/a.py', 'src/b.py']);
  });
});

describe('isShellExpansion: drop unresolvable pre-shell tokens', () => {
  // Regression: `git add "$LOG" && git commit` fed the literal token `$LOG`
  // into the staged set. `$LOG` has no extension, matched no reviewExempt
  // entry, and counted as "1 non-exempt file" — a false review block on every
  // variable-based commit (notably /guya-reflect). These tokens can't be
  // resolved statically; getStagedFiles drops them and relies on the
  // git diff --cached source for the real staged state.
  it('flags an unexpanded variable', () => {
    assert.equal(isShellExpansion('$LOG'), true);
  });

  it('flags command substitution', () => {
    assert.equal(isShellExpansion('$(date +%F).md'), true);
    assert.equal(isShellExpansion('`date`'), true);
  });

  it('flags globs and brace expansion', () => {
    assert.equal(isShellExpansion('*.md'), true);
    assert.equal(isShellExpansion('src/*.js'), true);
    assert.equal(isShellExpansion('f?o.txt'), true);
    assert.equal(isShellExpansion('[abc].md'), true);
    assert.equal(isShellExpansion('{a,b}.md'), true);
  });

  it('treats literal paths (incl. parens) as resolvable', () => {
    assert.equal(isShellExpansion('log/guya/2026-06-08-voice-chat-dd71f0c7.md'), false);
    assert.equal(isShellExpansion('file with spaces.js'), false);
    assert.equal(isShellExpansion('screenshot (1).png'), false);
    assert.equal(isShellExpansion('src/a.py'), false);
  });
});
