#!/usr/bin/env node

/**
 * Guya PreToolUse Hook — Pre-Commit Quality Harness
 *
 * CALLING SPEC:
 *   Input: JSON on stdin with { tool_name, tool_input, session_id, cwd }
 *   Output: { decision: "allow" } or { decision: "block", reason: "..." }
 *
 *   On git commit, runs automated checks on staged files:
 *     1. Test verification — do test files exist for changed source files?
 *     2. Complexity check — files under 800 LOC, functions under 80 lines?
 *     3. Cleanup scan — no leftover debug code?
 *
 *   If automated checks fail: blocks with report.
 *   If automated checks pass: blocks until karpathy-review + review-followup done.
 *   Report written to .guya/evolution/review-report.json for agents to read.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename, dirname, extname } from 'path';
import { execSync } from 'child_process';

const MAX_FILE_LOC = 800;
const MAX_FUNC_LINES = 80;

// --- stdin ---

function readStdinSync(timeoutMs = 2000) {
  return new Promise((resolve) => {
    const chunks = [];
    let settled = false;
    const timeout = setTimeout(() => {
      if (!settled) { settled = true; resolve(Buffer.concat(chunks).toString('utf-8')); }
    }, timeoutMs);
    process.stdin.on('data', (chunk) => chunks.push(chunk));
    process.stdin.on('end', () => {
      if (!settled) { settled = true; clearTimeout(timeout); resolve(Buffer.concat(chunks).toString('utf-8')); }
    });
    process.stdin.on('error', () => {
      if (!settled) { settled = true; clearTimeout(timeout); resolve(''); }
    });
    if (process.stdin.readableEnded) {
      if (!settled) { settled = true; clearTimeout(timeout); resolve(Buffer.concat(chunks).toString('utf-8')); }
    }
  });
}

// --- git helpers ---

function isGitCommit(toolName, toolInput) {
  if (toolName !== 'Bash' && toolName !== 'bash') return false;
  const cmd = typeof toolInput === 'string' ? toolInput : (toolInput?.command || '');
  return /\bgit\s+commit\b/.test(cmd);
}

function getStagedFiles(directory, toolInput) {
  // First try actual staged files (when git add was a separate command)
  try {
    const out = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: directory, encoding: 'utf-8', timeout: 5000
    });
    const files = out.trim().split('\n').filter(Boolean);
    if (files.length > 0) return files;
  } catch {}

  // Fallback: parse files from "git add ... && git commit" combined commands
  const cmd = typeof toolInput === 'string' ? toolInput : (toolInput?.command || '');
  const addMatch = cmd.match(/\bgit\s+add\s+(.+?)(?:\s*&&|\s*;|\s*\|)/);
  if (addMatch) {
    return addMatch[1].trim().split(/\s+/).filter(f => !f.startsWith('-') && f.length > 0);
  }

  return [];
}

// --- state ---

function getStateDir(directory) {
  const stateDir = join(directory, '.guya', 'evolution');
  if (!existsSync(stateDir)) {
    try { mkdirSync(stateDir, { recursive: true }); } catch {}
  }
  return stateDir;
}

function hashStagedFiles(stagedFiles) {
  // Deterministic hash of sorted file list — proves review matched these files
  return stagedFiles.slice().sort().join('|');
}

const GATE_MAX_AGE_MS = 10 * 60 * 1000; // 10 minutes

function isReviewComplete(gateFile, stagedFiles) {
  try {
    const gate = JSON.parse(readFileSync(gateFile, 'utf-8'));
    if (!gate.reviewed) return false;
    // Verify the review was for THESE files
    if (gate.filesHash !== hashStagedFiles(stagedFiles)) {
      process.stderr.write('[guya-pre-commit] Gate rejected: staged files changed since review\n');
      return false;
    }
    // Verify the review is recent
    const age = Date.now() - (gate.timestamp || 0);
    if (age > GATE_MAX_AGE_MS) {
      process.stderr.write(`[guya-pre-commit] Gate rejected: review expired (${Math.round(age / 60000)}min ago)\n`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

function output(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

// --- Check 1: Test Verification ---

function isSourceFile(file) {
  const ext = extname(file);
  if (!['.py', '.ts', '.js', '.mjs'].includes(ext)) return false;
  if (/test|__init__|conftest|fixture|\.config|\.d\.ts/.test(file)) return false;
  if (file.startsWith('.') || file.includes('node_modules') || file.includes('docs/')) return false;
  // Skip hook files — they don't need unit tests
  if (file.includes('hooks/')) return false;
  return true;
}

function checkTests(stagedFiles, directory) {
  const issues = [];
  for (const file of stagedFiles) {
    if (!isSourceFile(file)) continue;
    const ext = extname(file);
    const base = basename(file, ext);
    const dir = dirname(file);
    const testPaths = [
      join(dir, `test_${base}${ext}`),
      join(dir, `${base}_test${ext}`),
      join(dir, `${base}.test${ext}`),
      join('tests', dir, `test_${base}${ext}`),
      join('tests', dir, `${base}_test${ext}`),
      join('tests', `test_${base}${ext}`),
    ];
    if (!testPaths.some(tp => existsSync(join(directory, tp)))) {
      issues.push(`${file} — no test file found`);
    }
  }
  return { pass: issues.length === 0, issues };
}

// --- Check 2: Complexity ---

function checkComplexity(stagedFiles, directory) {
  const issues = [];
  for (const file of stagedFiles) {
    const ext = extname(file);
    if (!['.py', '.ts', '.js', '.mjs'].includes(ext)) continue;
    const fullPath = join(directory, file);
    if (!existsSync(fullPath)) continue;

    const lines = readFileSync(fullPath, 'utf-8').split('\n');
    if (lines.length > MAX_FILE_LOC) {
      issues.push(`${file} — ${lines.length} LOC (max ${MAX_FILE_LOC})`);
    }

    // Function length: simple heuristic
    const funcPattern = ext === '.py'
      ? /^\s*(?:def|async def)\s+(\w+)/
      : /^\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)/;
    let funcStart = -1;
    let funcName = '';

    for (let i = 0; i < lines.length; i++) {
      const match = lines[i].match(funcPattern);
      if (match) {
        if (funcStart >= 0 && (i - funcStart) > MAX_FUNC_LINES) {
          issues.push(`${file}:${funcStart + 1} — function "${funcName}" is ${i - funcStart} lines (max ${MAX_FUNC_LINES})`);
        }
        funcStart = i;
        funcName = match[1] || 'anonymous';
      }
    }
    if (funcStart >= 0 && (lines.length - funcStart) > MAX_FUNC_LINES) {
      issues.push(`${file}:${funcStart + 1} — function "${funcName}" is ${lines.length - funcStart} lines (max ${MAX_FUNC_LINES})`);
    }
  }
  return { pass: issues.length === 0, issues };
}

// --- Check 3: Cleanup Scan ---

function checkCleanup(stagedFiles, directory) {
  const issues = [];
  const jsPatterns = [/\bHACK\b/, /\bFIXME\b/, /\bdebugger\b/];
  const pyPatterns = [/\bHACK\b/, /\bFIXME\b/, /\bbreakpoint\(\)/, /\bpdb\.set_trace\b/];

  for (const file of stagedFiles) {
    const ext = extname(file);
    if (!['.py', '.ts', '.js', '.mjs', '.jsx', '.tsx'].includes(ext)) continue;
    const fullPath = join(directory, file);
    if (!existsSync(fullPath)) continue;

    const lines = readFileSync(fullPath, 'utf-8').split('\n');
    const patterns = ext === '.py' ? pyPatterns : jsPatterns;

    for (let i = 0; i < lines.length; i++) {
      for (const pattern of patterns) {
        if (pattern.test(lines[i])) {
          issues.push(`${file}:${i + 1} — ${lines[i].trim().slice(0, 80)}`);
        }
      }
    }
  }
  return { pass: issues.length === 0, issues };
}

// --- Run all checks ---

function runChecks(stagedFiles, directory) {
  const tests = checkTests(stagedFiles, directory);
  const complexity = checkComplexity(stagedFiles, directory);
  const cleanup = checkCleanup(stagedFiles, directory);

  return {
    timestamp: new Date().toISOString(),
    staged_files: stagedFiles,
    checks: { tests, complexity, cleanup },
    automated_pass: tests.pass && complexity.pass && cleanup.pass,
    reviewed: false
  };
}

// --- Report formatting ---

function formatBlockReason(report) {
  const allIssues = [
    ...report.checks.tests.issues.map(i => `[tests] ${i}`),
    ...report.checks.complexity.issues.map(i => `[complexity] ${i}`),
    ...report.checks.cleanup.issues.map(i => `[cleanup] ${i}`),
  ];
  return `Automated checks failed. Fix these issues before review:\n${allIssues.join('\n')}\n\nFull report: .guya/evolution/review-report.json`;
}

function formatReviewPrompt(stagedFiles) {
  const filesHash = stagedFiles.slice().sort().join('|');
  return `Automated checks passed (${stagedFiles.length} files). Now run karpathy-review on the staged changes, then review-followup. After both reviews pass, write the gate file and retry the commit:\n\necho '{ "reviewed": true, "filesHash": "${filesHash}", "timestamp": '$(date +%s000)' }' > .guya/evolution/review-gate.json\n\nThe gate expires after 10 minutes and must match the staged files. Do not skip reviews.\n\nStaged files: ${stagedFiles.join(', ')}`;
}

// --- Main ---

async function main() {
  try {
    const stdinData = await readStdinSync(4000);
    let input = {};
    try { input = JSON.parse(stdinData); } catch {
      process.stderr.write(`[guya-pre-commit] stdin parse failed, raw: ${stdinData.slice(0, 200)}\n`);
    }

    const toolName = input.tool_name || input.toolName || '';
    const toolInput = input.tool_input || input.toolInput || '';
    const directory = input.cwd || input.directory || process.cwd();

    process.stderr.write(`[guya-pre-commit] tool=${toolName} isCommit=${isGitCommit(toolName, toolInput)} dir=${directory}\n`);

    if (!isGitCommit(toolName, toolInput)) {
      return output({ continue: true, suppressOutput: true });
    }

    const stateDir = getStateDir(directory);
    const gateFile = join(stateDir, 'review-gate.json');

    const stagedFiles = getStagedFiles(directory, toolInput);
    if (stagedFiles.length === 0) {
      return output({ continue: true, suppressOutput: true });
    }

    if (isReviewComplete(gateFile, stagedFiles)) {
      writeFileSync(gateFile, JSON.stringify({ reviewed: false }));
      return output({ continue: true, suppressOutput: true });
    }

    const report = runChecks(stagedFiles, directory);
    writeFileSync(join(stateDir, 'review-report.json'), JSON.stringify(report, null, 2));

    if (!report.automated_pass) {
      return output({ decision: 'block', reason: formatBlockReason(report) });
    }
    output({ decision: 'block', reason: formatReviewPrompt(stagedFiles) });
  } catch (err) {
    process.stderr.write(`[guya-pre-commit] CATCH-ALL ERROR: ${err?.message || err}\n`);
    output({ continue: true, suppressOutput: true });
  }
}

main();
