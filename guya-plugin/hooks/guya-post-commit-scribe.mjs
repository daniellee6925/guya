#!/usr/bin/env node

/**
 * Guya PostToolUse Hook — Post-Commit Scribe
 *
 * CALLING SPEC:
 *   Input: JSON on stdin with { tool_name, tool_input, tool_output, session_id, cwd }
 *   Output: { continue: true, suppressOutput: true } (always passes through)
 *
 *   After a git commit, appends the commit message to STATUS.md's Recent Changes.
 *   Creates STATUS.md with a minimal skeleton if it doesn't exist.
 *   No LLM calls — pure file I/O. Completes in under 50ms.
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, basename } from 'path';
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

function isGitCommit(toolName, toolInput) {
  if (toolName !== 'Bash' && toolName !== 'bash') return false;
  const cmd = typeof toolInput === 'string' ? toolInput : (toolInput?.command || '');
  return /\bgit\s+commit\b/.test(cmd);
}

function output(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n');
}

// --- git ---

function getLatestCommit(directory) {
  try {
    const log = execSync('git log -1 --format="%h|%s|%aI"', {
      cwd: directory, encoding: 'utf-8', timeout: 5000, stdio: 'pipe'
    }).trim();
    const [hash, message, date] = log.split('|');
    return { hash, message, date: date.slice(0, 10) };
  } catch {
    return null;
  }
}

function getProjectName(directory) {
  // Try package.json
  try {
    const pkg = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf-8'));
    if (pkg.name) return pkg.name;
  } catch {}

  // Try pyproject.toml
  try {
    const toml = readFileSync(join(directory, 'pyproject.toml'), 'utf-8');
    const match = toml.match(/^name\s*=\s*"([^"]+)"/m);
    if (match) return match[1];
  } catch {}

  // Fall back to directory name
  return basename(directory);
}

// --- STATUS.md ---

const SKELETON = (name) => `# ${name} — Status

> Last updated: ${new Date().toLocaleDateString('en-CA')}

## Current Focus
(not set)

## Recent Changes

## In Progress

## TODO

## Decisions & Notes
`;

function appendCommit(directory, commit) {
  const statusPath = join(directory, 'STATUS.md');
  const entry = `- [${commit.date}] \`${commit.hash}\` — ${commit.message}`;

  if (!existsSync(statusPath)) {
    const name = getProjectName(directory);
    const content = SKELETON(name).replace(
      '## Recent Changes\n',
      `## Recent Changes\n${entry}\n`
    );
    writeFileSync(statusPath, content);
    return;
  }

  const content = readFileSync(statusPath, 'utf-8');

  // Update timestamp
  let updated = content.replace(
    /> Last updated: .*/,
    `> Last updated: ${new Date().toLocaleDateString('en-CA')}`
  );

  // Append after "## Recent Changes" header
  const marker = '## Recent Changes';
  const idx = updated.indexOf(marker);
  if (idx === -1) {
    // No Recent Changes section — append at end
    updated += `\n${marker}\n${entry}\n`;
  } else {
    const insertPos = idx + marker.length;
    // Find the next newline after the header
    const nextNewline = updated.indexOf('\n', insertPos);
    updated = updated.slice(0, nextNewline + 1) + entry + '\n' + updated.slice(nextNewline + 1);
  }

  // Deduplicate — don't add the same commit hash twice
  if (content.includes(commit.hash)) return;

  writeFileSync(statusPath, updated);
}

// --- main ---

async function main() {
  try {
    const stdinData = await readStdinSync(3000);
    let input = {};
    try { input = JSON.parse(stdinData); } catch {
      return output({ continue: true, suppressOutput: true });
    }

    const toolName = input.tool_name || input.toolName || '';
    const toolInput = input.tool_input || input.toolInput || '';
    const directory = input.cwd || input.directory || process.cwd();

    if (!isGitCommit(toolName, toolInput)) {
      return output({ continue: true, suppressOutput: true });
    }

    const commit = getLatestCommit(directory);
    if (!commit) {
      return output({ continue: true, suppressOutput: true });
    }

    appendCommit(directory, commit);

    output({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'PostToolUse',
        additionalContext: `<guya-scribe>\nLogged commit ${commit.hash} (${commit.message}) to STATUS.md\n</guya-scribe>`,
      },
    });
  } catch (err) {
    process.stderr.write(`[guya-scribe] ERROR: ${err?.message || err}\n`);
    output({ continue: true, suppressOutput: true });
  }
}

main();
