#!/usr/bin/env node

/**
 * Guya UserPromptSubmit Hook — Intent Detection
 *
 * CALLING SPEC:
 *   Input: JSON on stdin with { prompt, session_id, cwd }
 *   Output: JSON on stdout with { continue: true, hookSpecificOutput? }
 *
 *   Reads the user's prompt, checks for project/topic keywords,
 *   and preloads relevant archival memory if found.
 *   No LLM calls. Keyword matching only. Under 100ms.
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const GLOBAL_DIR = join(homedir(), '.claude', 'guya');

// --- Helpers ---

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

function readFileSafe(path) {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf-8').trim();
  } catch {
    return null;
  }
}

// --- Intent Matching ---

function findMatchingArchival(prompt, archivalDir) {
  if (!existsSync(archivalDir)) return null;

  let files;
  try { files = readdirSync(archivalDir).filter(f => f.endsWith('.md')); } catch { return null; }

  const promptLower = prompt.toLowerCase();
  const matches = [];

  const promptWords = promptLower.split(/\s+/).filter(w => w.length >= 2);

  for (const file of files) {
    const name = file.replace('.md', '').toLowerCase();
    const nameParts = name.split(/[-_]/);
    // Match if:
    // 1. The full filename appears in the prompt (e.g., "sdf-dev" in prompt matches "sdf-dev.md")
    // 2. Any prompt word appears in the filename (e.g., "sdf" in prompt matches "sdf-dev.md")
    const matched = promptLower.includes(name)
      || promptWords.some(word => nameParts.some(part => part === word));
    if (matched) {
      const content = readFileSafe(join(archivalDir, file));
      if (content) {
        matches.push({ name, content });
      }
    }
  }

  return matches.length > 0 ? matches : null;
}

// --- Main ---

async function main() {
  try {
    const stdinData = await readStdinSync(3000);
    let input = {};
    try { input = JSON.parse(stdinData); } catch {}

    const prompt = input.prompt || input.message || '';
    const directory = input.cwd || input.directory || process.cwd();

    if (!prompt || prompt.length < 3) {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
      return;
    }

    // Check project-local archival memory
    const localArchival = join(directory, '.guya', 'memory', 'archival');
    const localMatches = findMatchingArchival(prompt, localArchival);

    // Check global archival memory (future: ~/.claude/guya/archival/)
    // For now, only project-local

    if (!localMatches) {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
      return;
    }

    // Truncate to ~2000 chars to avoid bloating context
    let contextText = '';
    for (const match of localMatches) {
      const truncated = match.content.length > 2000
        ? match.content.slice(0, 2000) + '\n\n[...truncated]'
        : match.content;
      contextText += `\n## Archival: ${match.name}\n\n${truncated}\n`;
    }

    console.log(JSON.stringify({
      continue: true,
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: `<guya-intent>\nRelevant context preloaded from archival memory:\n${contextText}\n</guya-intent>`
      }
    }));
  } catch {
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

main();
