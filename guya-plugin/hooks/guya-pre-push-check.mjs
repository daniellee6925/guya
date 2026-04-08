#!/usr/bin/env node

/**
 * Guya PreToolUse Hook — Pre-Push PR Readiness Check
 *
 * CALLING SPEC:
 *   Input: JSON on stdin with { tool_name, tool_input, session_id, cwd }
 *   Output: { continue: true } or { decision: "block", reason: "..." }
 *
 *   On git push, runs checks on the codebase:
 *     1. Ruff lint (Python projects)
 *     2. Tests (pytest for Python, npm test for Node)
 *     3. WIP commit detection
 *
 *   If any check fails: blocks with report.
 *   If all pass: allows push.
 */

import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

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

// --- detection ---

function isGitPush(toolName, toolInput) {
  if (toolName !== 'Bash' && toolName !== 'bash') return false;
  const cmd = typeof toolInput === 'string' ? toolInput : (toolInput?.command || '');
  return /\bgit\s+push\b/.test(cmd);
}

function output(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

// --- project detection ---

function detectProject(directory) {
  const hasPython = existsSync(join(directory, 'pyproject.toml'))
    || existsSync(join(directory, 'setup.py'))
    || existsSync(join(directory, 'requirements.txt'));

  const hasNode = existsSync(join(directory, 'package.json'));

  return { hasPython, hasNode };
}

// --- Check 1: Ruff ---

function checkRuff(directory) {
  try {
    execSync('ruff check .', { cwd: directory, encoding: 'utf-8', timeout: 30000, stdio: 'pipe' });
    return { pass: true, issues: [] };
  } catch (err) {
    // ruff not installed
    if (err.message?.includes('ENOENT') || err.message?.includes('not found')) {
      return { pass: true, issues: [], skipped: 'ruff not installed' };
    }
    // ruff found issues
    const output = (err.stdout || '') + (err.stderr || '');
    const lines = output.trim().split('\n').filter(Boolean).slice(0, 20);
    return { pass: false, issues: lines };
  }
}

// --- Check 2: Tests ---

function checkPythonTests(directory) {
  try {
    execSync('pytest --tb=short -q', { cwd: directory, encoding: 'utf-8', timeout: 120000, stdio: 'pipe' });
    return { pass: true, issues: [] };
  } catch (err) {
    if (err.message?.includes('ENOENT') || err.message?.includes('not found')) {
      return { pass: true, issues: [], skipped: 'pytest not installed' };
    }
    const output = (err.stdout || '') + (err.stderr || '');
    const lines = output.trim().split('\n').filter(Boolean).slice(-15);
    return { pass: false, issues: lines };
  }
}

function checkNodeTests(directory) {
  try {
    const pkg = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf-8'));
    if (!pkg.scripts?.test) {
      return { pass: true, issues: [], skipped: 'no test script in package.json' };
    }
    execSync('npm test --silent', { cwd: directory, encoding: 'utf-8', timeout: 120000, stdio: 'pipe' });
    return { pass: true, issues: [] };
  } catch (err) {
    const output = (err.stdout || '') + (err.stderr || '');
    const lines = output.trim().split('\n').filter(Boolean).slice(-15);
    return { pass: false, issues: lines };
  }
}

// --- Check 3: WIP commits ---

function checkWipCommits(directory) {
  try {
    // Check commits on current branch not yet on remote
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      cwd: directory, encoding: 'utf-8', timeout: 5000, stdio: 'pipe'
    }).trim();

    const remote = execSync(`git rev-parse --abbrev-ref ${branch}@{upstream} 2>/dev/null || echo ""`, {
      cwd: directory, encoding: 'utf-8', timeout: 5000, shell: true, stdio: 'pipe'
    }).trim();

    if (!remote) return { pass: true, issues: [] };

    const log = execSync(`git log ${remote}..HEAD --oneline --grep="^WIP"`, {
      cwd: directory, encoding: 'utf-8', timeout: 5000, stdio: 'pipe'
    }).trim();

    if (log) {
      return { pass: false, issues: log.split('\n').filter(Boolean).map(l => `WIP commit: ${l}`) };
    }
    return { pass: true, issues: [] };
  } catch {
    return { pass: true, issues: [] };
  }
}

// --- format ---

function formatReport(results) {
  const lines = [];
  for (const [name, result] of Object.entries(results)) {
    if (result.skipped) continue;
    if (!result.pass) {
      lines.push(`\n[${name}] FAILED:`);
      result.issues.forEach(i => lines.push(`  ${i}`));
    }
  }
  return `Pre-push checks failed. Fix before pushing:\n${lines.join('\n')}`;
}

// --- run checks ---

function runAllChecks(directory) {
  const { hasPython, hasNode } = detectProject(directory);
  const results = {};

  results.wip = checkWipCommits(directory);

  if (hasPython) {
    results.ruff = checkRuff(directory);
    results.pytest = checkPythonTests(directory);
  }

  if (hasNode) {
    results['npm-test'] = checkNodeTests(directory);
  }

  return results;
}

// --- main ---

async function main() {
  try {
    const stdinData = await readStdinSync(4000);
    let input = {};
    try { input = JSON.parse(stdinData); } catch {
      process.stderr.write(`[guya-pre-push] stdin parse failed\n`);
    }

    const toolName = input.tool_name || input.toolName || '';
    const toolInput = input.tool_input || input.toolInput || '';
    const directory = input.cwd || input.directory || process.cwd();

    if (!isGitPush(toolName, toolInput)) {
      return output({ continue: true, suppressOutput: true });
    }

    process.stderr.write(`[guya-pre-push] Running pre-push checks in ${directory}\n`);

    const results = runAllChecks(directory);
    const allPass = Object.values(results).every(r => r.pass);

    if (allPass) {
      const summary = Object.entries(results)
        .map(([name, r]) => r.skipped ? `${name}: skipped (${r.skipped})` : `${name}: passed`)
        .join(', ');
      process.stderr.write(`[guya-pre-push] All checks passed: ${summary}\n`);
      return output({
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext: `<guya-pre-push>\nAll pre-push checks passed: ${summary}\n</guya-pre-push>`,
        },
      });
    }

    output({ decision: 'block', reason: formatReport(results) });
  } catch (err) {
    process.stderr.write(`[guya-pre-push] ERROR: ${err?.message || err}\n`);
    output({ continue: true, suppressOutput: true });
  }
}

main();
