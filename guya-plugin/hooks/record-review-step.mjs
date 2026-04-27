#!/usr/bin/env node

/**
 * record-review-step.mjs — CLI wrapper around appendStep.
 *
 * Usage: node record-review-step.mjs <initial|followup> [cwd]
 *
 * Exists so the review skills can record evidence in one mechanical Bash
 * command (Step 0 of guya-review and guya-deep-review), bypassing the
 * PreToolUse:Skill hook path that has been unreliable in practice. The
 * skill itself owns evidence-recording — no human judgment, no manual
 * file edits.
 *
 * Exit codes:
 *   0 — recorded successfully (or step already recorded recently as a no-op)
 *   1 — bad arguments / invalid step
 *   2 — git write-tree failed (probably not in a repo)
 */

import { appendStep } from './review-evidence.mjs';
import { resolveProjectRoot } from './hook-utils.mjs';

const step = process.argv[2];
const cwdArg = process.argv[3] || process.cwd();

if (step !== 'initial' && step !== 'followup') {
  process.stderr.write(`record-review-step: expected "initial" or "followup", got "${step}"\n`);
  process.exit(1);
}

const directory = resolveProjectRoot(cwdArg);

try {
  appendStep(directory, step);
  process.stdout.write(`Recorded ${step} review evidence at ${directory}/.guya/evolution/review-evidence.jsonl\n`);
} catch (err) {
  process.stderr.write(`record-review-step: ${err?.message || String(err)}\n`);
  process.exit(2);
}
