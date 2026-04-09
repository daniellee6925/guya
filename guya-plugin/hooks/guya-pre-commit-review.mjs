#!/usr/bin/env node

/**
 * Guya PreToolUse Hook — Review Gate + Evidence Recorder
 *
 * CALLING SPEC:
 *   Input: JSON on stdin with { tool_name, tool_input, session_id, cwd }
 *   Output: { continue: true } or { decision: "block", reason: "..." }
 *
 *   Three jobs:
 *     1. On Skill call (karpathy-review / review-followup) → record evidence
 *     2. On git commit --no-verify → block
 *     3. On git commit → check exemptions, small change, evidence → allow or block
 *
 *   Quality checks (test existence, complexity, cleanup) are handled by
 *   .git/hooks/pre-commit which runs with accurate staged file state.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, extname } from 'path';
import { execSync } from 'child_process';
import { readStdin } from './hook-utils.mjs';

function output(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

// --- config ---

function loadConfig(directory) {
  const configPath = join(directory, '.guya', 'pre-commit-config.json');
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'));
  } catch {
    return null;
  }
}

// --- state ---

function getStateDir(directory) {
  const stateDir = join(directory, '.guya', 'evolution');
  if (!existsSync(stateDir)) {
    try { mkdirSync(stateDir, { recursive: true }); } catch {}
  }
  return stateDir;
}

// --- Job 1: Evidence recording ---

const REVIEW_SKILLS = ['karpathy-review', 'review-followup', 'cr'];

function isReviewSkill(toolName, toolInput) {
  if (toolName !== 'Skill' && toolName !== 'skill') return false;
  const skill = typeof toolInput === 'string' ? toolInput : (toolInput?.skill || toolInput?.name || '');
  return REVIEW_SKILLS.some(s => skill.includes(s));
}

function getSkillStep(toolInput) {
  const skill = typeof toolInput === 'string' ? toolInput : (toolInput?.skill || toolInput?.name || '');
  if (skill.includes('review-followup')) return 'followup';
  return 'initial';
}

function recordEvidence(directory, step) {
  const stateDir = getStateDir(directory);
  const evidencePath = join(stateDir, 'review-evidence.json');

  let evidence = { steps: [] };
  try {
    evidence = JSON.parse(readFileSync(evidencePath, 'utf-8'));
    if (!Array.isArray(evidence.steps)) evidence.steps = [];
  } catch {
    process.stderr.write('[guya-gate] evidence parse failed, resetting\n');
  }

  evidence.steps.push({ step, timestamp: Date.now() });

  // Also capture content hash of currently staged files
  evidence.contentHash = null;
  try {
    const hash = execSync('git diff --cached --name-only --diff-filter=ACMR | sort | git hash-object --stdin', {
      cwd: directory, encoding: 'utf-8', timeout: 5000, shell: true
    }).trim();
    evidence.contentHash = hash;
  } catch {
    process.stderr.write('[guya-gate] content hash failed\n');
  }

  writeFileSync(evidencePath, JSON.stringify(evidence, null, 2));
  process.stderr.write(`[guya-gate] Recorded review evidence: ${step}\n`);
}

// --- Job 2 & 3: Commit gating ---

function isGitCommit(toolName, toolInput) {
  if (toolName !== 'Bash' && toolName !== 'bash') return false;
  const cmd = typeof toolInput === 'string' ? toolInput : (toolInput?.command || '');
  return /\bgit\s+commit\b/.test(cmd);
}

function hasNoVerify(toolInput) {
  const cmd = typeof toolInput === 'string' ? toolInput : (toolInput?.command || '');
  return /--no-verify/.test(cmd);
}

function getStagedFiles(directory, toolInput) {
  // Get currently staged files
  const staged = new Set();
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: directory, encoding: 'utf-8', timeout: 5000
    });
    out.trim().split('\n').filter(Boolean).forEach(f => staged.add(f));
  } catch {
    process.stderr.write('[guya-gate] git diff --cached failed, staged set may be incomplete\n');
  }

  // Also parse git add files from combined commands (TOCTOU mitigation)
  const cmd = typeof toolInput === 'string' ? toolInput : (toolInput?.command || '');
  const addMatch = cmd.match(/\bgit\s+add\s+(.+?)(?:\s*&&|\s*;|\s*\||\s*$)/);
  if (addMatch) {
    addMatch[1].trim().split(/\s+/)
      .filter(f => !f.startsWith('-') && f.length > 0)
      .forEach(f => staged.add(f));
  }

  return [...staged];
}

function isExempt(file, config) {
  // Check path exemptions
  for (const p of config.pathExempt || []) {
    if (file.includes(p)) return true;
  }
  // Check extension exemptions
  const ext = extname(file);
  for (const pattern of config.reviewExempt || []) {
    const patExt = pattern.replace(/\*/g, '');
    if (ext === patExt) return true;
  }
  return false;
}

function isSmallChange(stagedFiles, config, directory) {
  const threshold = config.smallChange || { maxLines: 10 };
  const nonExempt = stagedFiles.filter(f => !isExempt(f, config));

  if (nonExempt.length === 0) return true;

  try {
    const numstat = execSync('git diff --cached --numstat', {
      cwd: directory, encoding: 'utf-8', timeout: 5000
    });
    // Each line: "added\tremoved\tfile" — sum added + removed
    let totalLines = 0;
    for (const line of numstat.trim().split('\n').filter(Boolean)) {
      const [added, removed] = line.split('\t');
      const a = parseInt(added, 10);
      const r = parseInt(removed, 10);
      if (!isNaN(a)) totalLines += a;
      if (!isNaN(r)) totalLines += r;
    }
    return totalLines <= threshold.maxLines;
  } catch {
    return false;
  }
}

function checkEvidence(directory, config) {
  const stateDir = getStateDir(directory);
  const evidencePath = join(stateDir, 'review-evidence.json');
  const maxAge = (config.gateMaxAgeMinutes || 10) * 60 * 1000;

  try {
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf-8'));
    if (!Array.isArray(evidence.steps) || evidence.steps.length === 0) {
      return { valid: false, reason: 'No review evidence found.' };
    }

    const hasInitial = evidence.steps.findLast(s => s.step === 'initial');
    const hasFollowup = evidence.steps.findLast(s => s.step === 'followup');

    if (!hasInitial) {
      return { valid: false, reason: 'Missing initial review (run /karpathy-review or /cr first).' };
    }
    if (!hasFollowup) {
      return { valid: false, reason: 'Missing followup review (run /review-followup after fixing issues).' };
    }

    // Verify order: followup after initial
    if (hasFollowup.timestamp <= hasInitial.timestamp) {
      return { valid: false, reason: 'Followup must happen after initial review.' };
    }

    // Verify recency
    const age = Date.now() - hasInitial.timestamp;
    if (age > maxAge) {
      return { valid: false, reason: `Review expired (${Math.round(age / 60000)}min ago, max ${config.gateMaxAgeMinutes || 10}min).` };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'No review evidence found.' };
  }
}

function formatReviewPrompt(stagedFiles) {
  return `Review required for ${stagedFiles.length} non-exempt files. Follow this process:

1. Run /karpathy-review on the staged files
2. Fix any issues found
3. Run /review-followup on the staged files
4. Fix any issues found
5. Retry the commit

The hook records evidence automatically when you run these skills.
Review expires after 10 minutes.

Staged files: ${stagedFiles.join(', ')}`;
}

// --- Main ---

async function main() {
  let input = {};
  try {
    const stdinData = await readStdin(4000);
    try { input = JSON.parse(stdinData); } catch {
      return output({ continue: true, suppressOutput: true });
    }

    const toolName = input.tool_name || input.toolName || '';
    const toolInput = input.tool_input || input.toolInput || '';
    const directory = input.cwd || input.directory || process.cwd();

    // Job 1: Record evidence for review skills
    if (isReviewSkill(toolName, toolInput)) {
      recordEvidence(directory, getSkillStep(toolInput));
      return output({ continue: true, suppressOutput: true });
    }

    // Only gate git commits from here
    if (!isGitCommit(toolName, toolInput)) {
      return output({ continue: true, suppressOutput: true });
    }

    // Job 2: Block --no-verify
    if (hasNoVerify(toolInput)) {
      return output({ decision: 'block', reason: 'Cannot skip git hooks. Remove --no-verify.' });
    }

    // Job 3: Review gate
    const config = loadConfig(directory);
    if (!config) {
      return output({ continue: true, suppressOutput: true });
    }

    const stagedFiles = getStagedFiles(directory, toolInput);
    if (stagedFiles.length === 0) {
      return output({ continue: true, suppressOutput: true });
    }

    // Check if all files are exempt
    const nonExempt = stagedFiles.filter(f => !isExempt(f, config));
    if (nonExempt.length === 0) {
      process.stderr.write(`[guya-gate] All ${stagedFiles.length} files exempt, skipping review\n`);
      return output({ continue: true, suppressOutput: true });
    }

    // Check if small change
    if (isSmallChange(stagedFiles, config, directory)) {
      process.stderr.write(`[guya-gate] Small change (${nonExempt.length} files), skipping review\n`);
      return output({ continue: true, suppressOutput: true });
    }

    // Check evidence
    const evidence = checkEvidence(directory, config);
    if (evidence.valid) {
      process.stderr.write(`[guya-gate] Review evidence valid, allowing commit\n`);
      return output({ continue: true, suppressOutput: true });
    }

    // Block with review instructions
    output({ decision: 'block', reason: `${evidence.reason}\n\n${formatReviewPrompt(nonExempt)}` });
  } catch (err) {
    process.stderr.write(`[guya-gate] ERROR: ${err?.message || err}\n`);
    output({ continue: true, suppressOutput: true });
  }
}

main();
