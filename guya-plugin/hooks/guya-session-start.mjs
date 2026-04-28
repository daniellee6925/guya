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

import { existsSync, readFileSync, readdirSync, mkdirSync, statSync, realpathSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

import { resolveConstantiaPath, readTaskManifest } from './constantia-sync.mjs';

const GLOBAL_DIR = join(homedir(), '.claude', 'guya');
const TOKEN_BUDGET = 3000;
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

// --- Reflection backlog (Phase 2 nudge) ---

/**
 * Compute the soft nudge for /guya-evolve based on accumulated reflections
 * since the last manual evolve run.
 *
 * Returns null when there's nothing to nudge about (no backlog, or last
 * evolve was today). Otherwise returns a one-line string suitable for
 * prepending to the <guya-context> block.
 *
 * Pure-ish — only reads the filesystem. Tested by unit + verified end-to-end
 * by running /guya-evolve and checking the next session start sees a fresh
 * timestamp + zero backlog.
 */
export function computeReflectionNudge(cwd, opts = {}) {
  const globalDir = opts.globalDir || GLOBAL_DIR;
  const now = opts.now || (() => Date.now());
  const reflectionsDir = join(cwd, '.guya', 'memory', 'reflections');
  const lastEvolvedPath = join(globalDir, '.last-evolved');

  let lastEvolvedMs = 0;
  try {
    if (existsSync(lastEvolvedPath)) {
      const raw = readFileSync(lastEvolvedPath, 'utf-8');
      const parsed = JSON.parse(raw);
      lastEvolvedMs = parsed?.ts ? Date.parse(parsed.ts) : 0;
      if (!Number.isFinite(lastEvolvedMs)) lastEvolvedMs = 0;
    }
  } catch {
    // Treat unreadable/missing as "never evolved" — gives the nudge
    // a chance to surface instead of silently swallowing the signal.
    lastEvolvedMs = 0;
  }

  let reflectionFiles = [];
  try {
    if (existsSync(reflectionsDir)) {
      reflectionFiles = readdirSync(reflectionsDir).filter(f => f.endsWith('.md'));
    }
  } catch (err) {
    // readdirSync can only fail here for non-ENOENT reasons (permissions,
    // filesystem error) since we existsSync'd above. Silently returning null
    // would rot the backlog nudge — Daniel would never know evolve was
    // accumulating state. Surface it to stderr so a failing dir shows up
    // in hook debug output instead of disappearing.
    process.stderr.write(`[guya-session-start] computeReflectionNudge: readdir failed for ${reflectionsDir}: ${err.message}\n`);
    return null;
  }
  if (reflectionFiles.length === 0) return null;

  // Count reflections newer than last-evolved (or all reflections if never evolved).
  let backlog = 0;
  for (const f of reflectionFiles) {
    try {
      const stat = statSync(join(reflectionsDir, f));
      if (stat.mtimeMs > lastEvolvedMs) backlog++;
    } catch {}
  }
  if (backlog === 0) return null;

  // Days since last evolve (or null if never).
  let daysClause;
  if (lastEvolvedMs === 0) {
    daysClause = 'no prior /guya-evolve runs recorded';
  } else {
    const days = Math.floor((now() - lastEvolvedMs) / (24 * 60 * 60 * 1000));
    daysClause = days === 0
      ? 'last evolve earlier today'
      : `${days} day${days === 1 ? '' : 's'} since last evolve`;
  }

  return `📝 ${backlog} reflection${backlog === 1 ? '' : 's'} accumulated (${daysClause}). Run /guya-evolve to process them.`;
}

// --- Context Assembly ---

function assembleContext(cwd) {
  const sections = [];
  let totalChars = 0;

  // 0. Soul (includes session behaviors — highest priority)

  // 1. Soul (global — includes core commitments + session behaviors)
  const soul = readFileSafe(join(GLOBAL_DIR, 'soul.md'));
  if (soul) {
    sections.push({ label: 'soul.md', content: soul, priority: 0 });
  }

  // 2. Identity (global)
  const identity = readFileSafe(join(GLOBAL_DIR, 'identity.md'));
  if (identity) {
    sections.push({ label: 'identity.md', content: identity, priority: 1 });
  }

  // 3. User profile (global)
  const userProfile = readFileSafe(join(GLOBAL_DIR, 'user.md'));
  if (userProfile) {
    sections.push({ label: 'user.md', content: userProfile, priority: 0 });
  }

  // 3.5. Growth tracker (global — tracks Daniel across all projects)
  const growthTracker = readFileSafe(join(GLOBAL_DIR, 'growth-tracker.md'));
  if (growthTracker) {
    sections.push({ label: 'growth-tracker.md', content: growthTracker, priority: 2 });
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

  // 8. Constantia active tasks (shared memory — cross-agent truth)
  const constantia = resolveConstantiaPath();
  if (constantia.error) {
    sections.push({ label: 'constantia-alert', content: `⚠️ Constantia unavailable: ${constantia.error}`, priority: -1 });
  } else {
    const taskManifest = readTaskManifest(constantia.path);
    if (taskManifest) {
      sections.push({ label: 'constantia-tasks', content: taskManifest, priority: 0 });
    }
  }

  // 9. Reflection backlog nudge — soft signal that /guya-evolve is overdue.
  // Highest priority so Daniel sees it before scrolling. Single line, only
  // present when there's actually a backlog (computeReflectionNudge returns
  // null otherwise to avoid noisy "all clear" messages every session).
  const nudge = computeReflectionNudge(cwd);
  if (nudge) {
    sections.push({ label: 'reflection-nudge', content: nudge, priority: -1 });
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
      cwd = input.cwd || input.directory || cwd;
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

// Only invoke main() when this file is executed directly as a hook script,
// NOT when it's imported for testing. Without this guard, importing
// computeReflectionNudge from the test suite triggers main() at module load
// — which opens a stdin listener that hangs the test process (caught during
// Phase 2 guya-review verification). fileURLToPath is the cross-platform
// equivalent of comparing __filename === process.argv[1].
//
// Compare realpaths on both sides — Node resolves import.meta.url to the
// realpath, but argv[1] keeps the symlink path (Claude Code plugin marketplace
// installs are symlinks to the source tree). A naive == would silently disable
// main() under symlinked installs. See hooks/CLAUDE.md "Regression History".
const isMain = (() => {
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); }
  catch { return false; }
})();

if (isMain) main();
