#!/usr/bin/env node

/**
 * Guya PreToolUse:Bash dispatcher.
 *
 * Why this exists: Claude Code 2.1.101+ deduplicates PreToolUse entries by
 * matcher (semantic, post-regex), so two `matcher: "Bash"` blocks collapse
 * into one — only the last hook runs. This wrapper presents a single hook
 * that internally dispatches to both pre-commit-review and pre-push-check.
 *
 * Behavior:
 *   1. Read stdin once.
 *   2. Run pre-commit-review with that stdin. If it blocks, return that.
 *   3. Else run pre-push-check with the same stdin. Return its result.
 *
 * Fail-open on any wrapper-level error — never block the user because the
 * dispatch wrapper itself crashed.
 */

import { spawnSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { readStdin } from './hook-utils.mjs';

const HOOKS_DIR = dirname(fileURLToPath(import.meta.url));
const REVIEW_HOOK = join(HOOKS_DIR, 'guya-pre-commit-review.mjs');
const PUSH_HOOK = join(HOOKS_DIR, 'guya-pre-push-check.mjs');

function output(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

function runHook(scriptPath, stdin, timeoutMs) {
  const result = spawnSync(process.execPath, [scriptPath], {
    input: stdin,
    encoding: 'utf-8',
    timeout: timeoutMs,
  });
  if (result.error || result.status !== 0) {
    process.stderr.write(`[guya-dispatch] ${scriptPath} failed: ${result.error?.message || `exit ${result.status}`}\n`);
    if (result.stderr) process.stderr.write(result.stderr);
    return null;
  }
  if (result.stderr) process.stderr.write(result.stderr);
  try {
    return JSON.parse(result.stdout.trim());
  } catch (err) {
    process.stderr.write(`[guya-dispatch] ${scriptPath} stdout unparseable: ${err.message}\n`);
    return null;
  }
}

async function main() {
  let stdinData;
  try {
    stdinData = await readStdin(4000);
  } catch (err) {
    process.stderr.write(`[guya-dispatch] readStdin failed: ${err?.message || err}\n`);
    return output({ continue: true, suppressOutput: true });
  }

  const review = runHook(REVIEW_HOOK, stdinData, 5000);
  if (review && review.decision === 'block') {
    return output(review);
  }

  const push = runHook(PUSH_HOOK, stdinData, 145000);
  if (push) return output(push);

  if (review) return output(review);
  output({ continue: true, suppressOutput: true });
}

main().catch((err) => {
  process.stderr.write(`[guya-dispatch] ERROR: ${err?.message || err}\n`);
  output({ continue: true, suppressOutput: true });
});
