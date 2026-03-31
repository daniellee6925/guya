#!/usr/bin/env node

/**
 * Guya SessionStart Hook
 *
 * CALLING SPEC:
 *   Input: JSON on stdin with { sessionId, directory, ... }
 *   Output: JSON on stdout with { continue: true, hookSpecificOutput: { hookEventName, additionalContext } }
 *
 *   Reads identity files from ~/.claude/guya/ (global)
 *   Reads core memory from .guya/memory/core/ (project-local)
 *   Reads strategic guidelines from ~/.claude/guya/guidelines/strategic/
 *   Reads tactical guidelines from .guya/evolution/guidelines/tactical/
 *   Assembles into a <guya-context> system-reminder block
 *   Creates .guya/ directory structure if missing (lazy init)
 *   Enforces ~4600 token budget (chars/4 approximation)
 *   Completes in under 5 seconds
 */

import { existsSync, readFileSync, readdirSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const GLOBAL_DIR = join(homedir(), '.claude', 'guya');
const TOKEN_BUDGET = 4600;
const CHAR_BUDGET = TOKEN_BUDGET * 4;

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

function readDir(dirPath) {
  try {
    if (!existsSync(dirPath)) return [];
    return readdirSync(dirPath).filter(f => f.endsWith('.md')).sort();
  } catch {
    return [];
  }
}

function parseGuidelineFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { rank: 999, body: content };
  const frontmatter = match[1];
  const body = match[2].trim();
  const rankMatch = frontmatter.match(/rank:\s*(\d+)/);
  const confidenceMatch = frontmatter.match(/confidence:\s*([\d.]+)/);
  const domainMatch = frontmatter.match(/domain:\s*(.+)/);
  return {
    rank: rankMatch ? parseInt(rankMatch[1]) : 999,
    confidence: confidenceMatch ? parseFloat(confidenceMatch[1]) : 0,
    domain: domainMatch ? domainMatch[1].trim() : 'general',
    body
  };
}

function estimateTokens(text) {
  return Math.ceil(text.length / 4);
}

function truncateToFit(text, maxChars) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 20) + '\n\n[...truncated]';
}

// --- Lazy Init ---

function ensureProjectLocal(cwd) {
  const dirs = [
    join(cwd, '.guya', 'memory', 'core'),
    join(cwd, '.guya', 'memory', 'archival'),
    join(cwd, '.guya', 'memory', 'reflections'),
    join(cwd, '.guya', 'evolution', 'traces'),
    join(cwd, '.guya', 'evolution', 'guidelines', 'tactical'),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) {
      try { mkdirSync(dir, { recursive: true }); } catch {}
    }
  }
}

// --- Context Assembly ---

function assembleContext(cwd) {
  const sections = [];
  let totalChars = 0;

  // 0. Active Session Behaviors (highest priority — never truncated)
  const behaviors = `## Active Session Behaviors

These trigger rules are specific operationalizations of your Soul and Creed. When a trigger below applies, follow it exactly — it takes precedence over the more general guidance.

### Convergence
- If Daniel seems to be jumping between unrelated topics frequently without finishing any, name the pattern directly. Ask which one to commit to. Don't just note it — make him choose.
- If Daniel starts working on something not in his active projects list, ask: "Is this replacing something or adding to your plate?" before diving in.

### Stuck Detection
- If Daniel seems stuck on the same problem across multiple attempts (repeated errors, same approach failing), stop helping with the current approach. Step back and reframe: "We've tried this angle a few times. Let me suggest a different approach." Offer a fundamentally different strategy, not a variation.

### Teaching
- When you write or modify code, briefly explain WHY this approach over alternatives — especially when the choice isn't obvious. Daniel is building toward staff-engineer caliber.
- When Daniel asks "how do I do X," don't just show X. Show X and explain the principle behind it so he can apply it to Y and Z on his own.

### Proactive Awareness
- If you notice Daniel is doing something manually that could be automated, say so.
- If a decision has non-obvious second-order consequences, flag them. Think in systems, not tasks.

### Emotional Awareness
- If Daniel expresses doubt about his abilities, acknowledge briefly, then redirect to evidence of what he's accomplished. Don't dwell — move forward.
- If Daniel is clearly frustrated, match the energy but stay constructive. Don't be cheerful when he's angry.

### Escape Hatch
- If Daniel explicitly says he's exploring, brainstorming, or thinking out loud, suspend convergence rules for this session. Let him explore freely.`;

  sections.push({ label: 'active-behaviors', content: behaviors, priority: 0 });

  // 1. Identity files (global)
  const identityFiles = ['soul.md', 'identity.md'];
  for (const file of identityFiles) {
    const content = readFileSafe(join(GLOBAL_DIR, file));
    if (content) {
      sections.push({ label: file, content, priority: 1 });
    }
  }

  // 2. User profile (global) — high priority, always include
  const userProfile = readFileSafe(join(GLOBAL_DIR, 'user.md'));
  if (userProfile) {
    sections.push({ label: 'user.md', content: userProfile, priority: 0 });
  }

  // 3. Creed (global)
  const creed = readFileSafe(join(GLOBAL_DIR, 'creed.md'));
  if (creed) {
    sections.push({ label: 'creed.md', content: creed, priority: 1 });
  }

  // 4. Core memory blocks (project-local)
  const coreDir = join(cwd, '.guya', 'memory', 'core');
  const coreFiles = readDir(coreDir).filter(f => f !== 'session-context.md');
  for (const file of coreFiles) {
    const content = readFileSafe(join(coreDir, file));
    if (content) {
      sections.push({ label: `core/${file}`, content, priority: 2 });
    }
  }

  // 5. Strategic guidelines (global, top 20 by rank)
  const strategicDir = join(GLOBAL_DIR, 'guidelines', 'strategic');
  const strategicFiles = readDir(strategicDir);
  const guidelines = [];
  for (const file of strategicFiles) {
    const raw = readFileSafe(join(strategicDir, file));
    if (raw) {
      const parsed = parseGuidelineFrontmatter(raw);
      guidelines.push(parsed);
    }
  }
  guidelines.sort((a, b) => a.rank - b.rank);
  const topGuidelines = guidelines.slice(0, 20);
  if (topGuidelines.length > 0) {
    const guidelineText = topGuidelines
      .map((g, i) => `${i + 1}. [${g.domain}] ${g.body} (confidence: ${g.confidence})`)
      .join('\n');
    sections.push({ label: 'strategic-guidelines', content: `## Strategic Guidelines\n\n${guidelineText}`, priority: 3 });
  }

  // 6. Tactical guidelines (project-local)
  const tacticalDir = join(cwd, '.guya', 'evolution', 'guidelines', 'tactical');
  const tacticalFiles = readDir(tacticalDir);
  if (tacticalFiles.length > 0) {
    const tacticalContents = [];
    for (const file of tacticalFiles) {
      const raw = readFileSafe(join(tacticalDir, file));
      if (raw) {
        const parsed = parseGuidelineFrontmatter(raw);
        tacticalContents.push(`- [${parsed.domain}] ${parsed.body}`);
      }
    }
    if (tacticalContents.length > 0) {
      sections.push({ label: 'tactical-guidelines', content: `## Tactical Guidelines (this session)\n\n${tacticalContents.join('\n')}`, priority: 4 });
    }
  }

  // 7. Session context (project-local) — last session continuity
  const sessionCtx = readFileSafe(join(cwd, '.guya', 'memory', 'core', 'session-context.md'));
  if (sessionCtx && !sessionCtx.includes('No previous session recorded')) {
    sections.push({ label: 'session-context', content: sessionCtx, priority: 5 });
  }

  // Sort by priority (lower = higher priority, included first)
  sections.sort((a, b) => a.priority - b.priority);

  // Assemble with budget enforcement
  const parts = [];
  for (const section of sections) {
    const sectionChars = section.content.length;
    if (totalChars + sectionChars > CHAR_BUDGET) {
      const remaining = CHAR_BUDGET - totalChars;
      if (remaining > 200) {
        parts.push(truncateToFit(section.content, remaining));
        totalChars += remaining;
      }
      break;
    }
    parts.push(section.content);
    totalChars += sectionChars;
  }

  return parts.join('\n\n---\n\n');
}

// --- Main ---

async function main() {
  try {
    const stdinData = await readStdinSync(3000);
    let cwd = process.cwd();
    try {
      const input = JSON.parse(stdinData);
      if (input.directory) cwd = input.directory;
    } catch {}

    // Check if global identity exists — if not, suggest bootstrap
    if (!existsSync(join(GLOBAL_DIR, 'user.md'))) {
      console.log(JSON.stringify({
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: '<guya-context>\n\nGuya is not yet initialized. Run the bootstrap interview to set up your identity files.\n\nCreate ~/.claude/guya/ with soul.md, creed.md, identity.md, and user.md to get started.\n\n</guya-context>'
        }
      }));
      return;
    }

    // Lazy init project-local structure
    ensureProjectLocal(cwd);

    // Assemble context
    const context = assembleContext(cwd);

    if (context.length > 0) {
      console.log(JSON.stringify({
        continue: true,
        hookSpecificOutput: {
          hookEventName: 'SessionStart',
          additionalContext: `<guya-context>\n\n${context}\n\n</guya-context>`
        }
      }));
    } else {
      console.log(JSON.stringify({ continue: true, suppressOutput: true }));
    }
  } catch (error) {
    // Never block session start — fail silently
    console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  }
}

main();
