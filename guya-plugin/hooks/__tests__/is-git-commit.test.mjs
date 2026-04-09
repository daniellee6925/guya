/**
 * is-git-commit.test.mjs — Shared git-commit detector contract
 *
 * PURPOSE:
 *   Pins the hardened isGitCommit helper. Two layers of defense:
 *
 *   1. Strip single/double-quoted substrings before testing, so literal
 *      `git commit` inside `echo '...'` payloads doesn't match. This
 *      was the original burn-the-evidence trigger — my smoke test
 *      ran an echo with `git commit` in the JSON arg, the scribe fired
 *      spuriously, and wiped the gate.
 *
 *   2. Require `git commit` to sit at a shell statement boundary (start
 *      of command or after &&/||/;/|/(/newline). This rejects unquoted
 *      cases like `echo git commit`, `grep git commit file`, and shell
 *      comments where `git commit` is an argument to another program,
 *      not an invocation.
 *
 *   Pairs with a HEAD-advance check in post-commit-scribe for defense
 *   in depth: even if this regex slips, the scribe verifies the commit
 *   actually landed before wiping state. That means the regex can stay
 *   heuristic without being catastrophic.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { isGitCommit } from '../hook-utils.mjs';

describe('isGitCommit: tool name filter', () => {
  it('rejects non-Bash tools outright', () => {
    assert.equal(isGitCommit('Write', { command: 'git commit -m foo' }), false);
    assert.equal(isGitCommit('Edit', { command: 'git commit -m foo' }), false);
    assert.equal(isGitCommit('Skill', { skill: 'git commit' }), false);
  });

  it('accepts both "Bash" and "bash" tool names', () => {
    assert.equal(isGitCommit('Bash', { command: 'git commit -m foo' }), true);
    assert.equal(isGitCommit('bash', { command: 'git commit -m foo' }), true);
  });

  it('handles string toolInput (not object)', () => {
    assert.equal(isGitCommit('Bash', 'git commit -m foo'), true);
  });

  it('handles missing or undefined command gracefully', () => {
    assert.equal(isGitCommit('Bash', {}), false);
    assert.equal(isGitCommit('Bash', null), false);
    assert.equal(isGitCommit('Bash', undefined), false);
  });
});

describe('isGitCommit: layer 1 — quoted-substring rejection', () => {
  it('rejects `git commit` literal inside single-quoted echo payload (the original bug)', () => {
    const cmd = `echo '{"command":"git commit -m test"}' | node hooks/foo.mjs`;
    assert.equal(isGitCommit('Bash', { command: cmd }), false);
  });

  it('rejects `git commit` literal inside double-quoted string', () => {
    const cmd = `echo "pretend git commit" | cat`;
    assert.equal(isGitCommit('Bash', { command: cmd }), false);
  });

  it('rejects `git commit` literal inside a grep pattern (single quotes)', () => {
    const cmd = `grep -q 'git commit' file.txt`;
    assert.equal(isGitCommit('Bash', { command: cmd }), false);
  });
});

describe('isGitCommit: layer 2 — shell statement boundary (Codex catch)', () => {
  // Codex pointed out that even after quote-stripping, unquoted commands
  // like `echo git commit` still matched via the naive /\bgit\s+commit\b/
  // regex. The hardened regex requires a shell statement boundary before
  // `git commit`. These cases all failed before the layer-2 tightening.

  it('rejects unquoted `echo git commit`', () => {
    assert.equal(isGitCommit('Bash', { command: 'echo git commit' }), false);
  });

  it('rejects unquoted `grep git commit filename`', () => {
    assert.equal(isGitCommit('Bash', { command: 'grep git commit README.md' }), false);
  });

  it('rejects `printf %s git commit`', () => {
    assert.equal(isGitCommit('Bash', { command: 'printf %s git commit' }), false);
  });

  it('rejects `man git commit` (reading docs, not committing)', () => {
    assert.equal(isGitCommit('Bash', { command: 'man git commit' }), false);
  });

  it('rejects trailing `git commit` as argument to other commands', () => {
    assert.equal(isGitCommit('Bash', { command: 'which git commit' }), false);
  });
});

describe('isGitCommit: positive cases — real commits still match', () => {
  it('matches bare `git commit` at start of line', () => {
    assert.equal(isGitCommit('Bash', { command: 'git commit' }), true);
  });

  it('matches `git commit -m "fix"` (double-quoted message)', () => {
    assert.equal(isGitCommit('Bash', { command: `git commit -m "fix: something"` }), true);
  });

  it('matches `git commit -m \'fix\'` (single-quoted message)', () => {
    assert.equal(isGitCommit('Bash', { command: `git commit -m 'fix: something'` }), true);
  });

  it('matches chained `cd foo && git commit`', () => {
    assert.equal(isGitCommit('Bash', { command: 'cd foo && git commit -m bar' }), true);
  });

  it('matches `git add . && git commit`', () => {
    assert.equal(isGitCommit('Bash', { command: 'git add . && git commit -m wip' }), true);
  });

  it('matches `x || git commit`', () => {
    assert.equal(isGitCommit('Bash', { command: 'true || git commit -m x' }), true);
  });

  it('matches `x ; git commit`', () => {
    assert.equal(isGitCommit('Bash', { command: 'true ; git commit -m x' }), true);
  });

  it('matches `git commit --amend` and other flag variants', () => {
    assert.equal(isGitCommit('Bash', { command: 'git commit --amend' }), true);
    assert.equal(isGitCommit('Bash', { command: 'git commit -am "wip"' }), true);
  });

  it('does not match unrelated git commands', () => {
    assert.equal(isGitCommit('Bash', { command: 'git status' }), false);
    assert.equal(isGitCommit('Bash', { command: 'git diff --cached' }), false);
    assert.equal(isGitCommit('Bash', { command: 'git log -1' }), false);
    assert.equal(isGitCommit('Bash', { command: 'git add file.txt' }), false);
  });

  it('does not match commands that mention "commit" without "git"', () => {
    assert.equal(isGitCommit('Bash', { command: 'echo commit' }), false);
    assert.equal(isGitCommit('Bash', { command: 'cat COMMIT_EDITMSG' }), false);
  });
});
