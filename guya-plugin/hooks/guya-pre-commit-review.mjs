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
 *     2. Complexity check — files under 800 LOC, functions under 50 lines?
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
const MAX_FUNC_LINES = 50;

// --- stdin ---

function readStdinSync(timeoutMs = 3000) {
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

function getStagedFiles(directory) {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACMR', {
      cwd: directory, encoding: 'utf-8', timeout: 5000
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    return [];
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

function isReviewComplete(gateFile) {
  try {
    const gate = JSON.parse(readFileSync(gateFile, 'utf-8'));
    return gate.reviewed === true;
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
  return `Automated checks passed (${stagedFiles.length} files). Now run karpathy-review on the staged changes, then review-followup. After both pass, write { "reviewed": true } to .guya/evolution/review-gate.json and retry the commit.\n\nStaged files: ${stagedFiles.join(', ')}`;
}

// --- Main ---

async function main() {
  try {
    const stdinData = await readStdinSync(3000);
    let input = {};
    try { input = JSON.parse(stdinData); } catch {}

    const toolName = input.tool_name || input.toolName || '';
    const toolInput = input.tool_input || input.toolInput || '';
    const directory = input.cwd || input.directory || process.cwd();

    if (!isGitCommit(toolName, toolInput)) {
      return output({ decision: 'allow' });
    }

    const stateDir = getStateDir(directory);
    const gateFile = join(stateDir, 'review-gate.json');

    if (isReviewComplete(gateFile)) {
      writeFileSync(gateFile, JSON.stringify({ reviewed: false }));
      return output({ decision: 'allow' });
    }

    const stagedFiles = getStagedFiles(directory);
    if (stagedFiles.length === 0) {
      return output({ decision: 'allow' });
    }

    const report = runChecks(stagedFiles, directory);
    writeFileSync(join(stateDir, 'review-report.json'), JSON.stringify(report, null, 2));

    if (!report.automated_pass) {
      return output({ decision: 'block', reason: formatBlockReason(report) });
    }
    output({ decision: 'block', reason: formatReviewPrompt(stagedFiles) });
  } catch {
    output({ decision: 'allow' });
  }
}

main();
