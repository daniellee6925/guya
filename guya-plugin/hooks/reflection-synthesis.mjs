/**
 * reflection-synthesis.mjs — Reflection-driven self-edit synthesis
 *
 * CALLING SPEC:
 *   Exports:
 *     - synthesizeFromReflections(opts) -> Promise<SynthesisResult | null>
 *     - readReflections(reflectionsDir, max) -> Array<{filename, isManual, body}>
 *     - readGuidelines(strategicDir) -> Array<{filename, frontmatter, body}>
 *     - validateIdentityProposals(result, minSources) -> SanitizedResult
 *
 *   Phase 1 (current): generates proposals + writes them to a dry-run
 *     inspection file at <globalDir>/.last-synthesis.json. Does NOT touch
 *     identity files. Does NOT commit anything.
 *   Phase 2 (next): a separate applySynthesisResult() will route the
 *     three streams to disk + git commits.
 *
 *   Why a separate module: keeps guya-session-end.mjs under the 800 LOC
 *   rule (already at 743), and lets this be unit-tested independently
 *   with a mocked Anthropic client.
 *
 *   Anti-oscillation guardrail: identityProposals with fewer than
 *   minReflectionsForIdentityChange (default 2) source reflections are
 *   silently dropped — see soul.md "Continuity" + 2026-04-11 design
 *   conversation for the rationale.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { fileURLToPath } from 'url';

const DEFAULT_GLOBAL_DIR = join(homedir(), '.claude', 'guya');
const DEFAULT_MAX_REFLECTIONS = 5;
const DEFAULT_MIN_REFLECTIONS_FOR_IDENTITY_CHANGE = 2;
const LOG_PREFIX = '[guya-reflection-synthesis]';

// --- File readers ---

function readFileSafe(path) {
  try {
    if (!existsSync(path)) return null;
    return readFileSync(path, 'utf-8').trim();
  } catch {
    return null;
  }
}

function listMdFiles(dir) {
  try {
    if (!existsSync(dir)) return [];
    return readdirSync(dir).filter(f => f.endsWith('.md'));
  } catch {
    return [];
  }
}

/**
 * Read recent reflections, prioritizing manual ones.
 *
 * Manual reflections (filename contains "-manual") are higher signal —
 * Daniel wrote them deliberately via /guya-reflect, not the auto-reflector.
 * We take ALL manual reflections (up to max) first, then fill remaining
 * slots with auto reflections, both sorted newest-first.
 *
 * Sort key: filename descending. Reflection filenames are
 * `YYYY-MM-DD-{shortid|manual|manual-N}.md` so lexicographic descending
 * ≈ newest first.
 */
export function readReflections(reflectionsDir, max = DEFAULT_MAX_REFLECTIONS) {
  const files = listMdFiles(reflectionsDir).sort().reverse();
  const manual = files.filter(f => f.includes('-manual'));
  const auto = files.filter(f => !f.includes('-manual'));

  // Take manual first (capped at max), then fill from auto.
  const picked = [
    ...manual.slice(0, max),
    ...auto.slice(0, Math.max(0, max - manual.slice(0, max).length)),
  ].slice(0, max);

  return picked.map(filename => ({
    filename,
    isManual: filename.includes('-manual'),
    body: readFileSafe(join(reflectionsDir, filename)) || '',
  })).filter(r => r.body.length > 0);
}

/**
 * Read all strategic guidelines. Returns frontmatter as raw string and body
 * separately so the synthesizer can reference guideline IDs without parsing
 * frontmatter itself.
 */
export function readGuidelines(strategicDir) {
  const files = listMdFiles(strategicDir);
  const out = [];
  for (const filename of files) {
    const raw = readFileSafe(join(strategicDir, filename));
    if (!raw) continue;
    const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (fmMatch) {
      out.push({ filename, frontmatter: fmMatch[1], body: fmMatch[2].trim() });
    } else {
      out.push({ filename, frontmatter: '', body: raw });
    }
  }
  return out;
}

/**
 * Read the last 24h of high-signal traces from the global trace store.
 * Used as supporting evidence for the synthesizer, not as primary input.
 *
 * Reads only today's and yesterday's JSONL files (date-named) to avoid
 * scanning the entire trace history.
 */
export function readRecentTraces(tracesDir, hours = 24) {
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const today = new Date();
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const dateStr = (d) => d.toISOString().slice(0, 10);

  const candidateFiles = [
    join(tracesDir, `${dateStr(today)}.jsonl`),
    join(tracesDir, `${dateStr(yesterday)}.jsonl`),
  ];

  const traces = [];
  for (const file of candidateFiles) {
    if (!existsSync(file)) continue;
    try {
      const lines = readFileSync(file, 'utf-8').split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const trace = JSON.parse(line);
          if (trace.timestamp && trace.timestamp >= cutoff) traces.push(trace);
        } catch {
          // Per-line parse failure is expected for partial appends — drop quietly.
        }
      }
    } catch (err) {
      // File-level read failure is NOT expected (we just existsSync'd) and would
      // silently produce zero traces, defeating the synthesizer's evidence input.
      // Surface it so a permission/encoding bug doesn't rot quietly for days.
      process.stderr.write(`${LOG_PREFIX} readRecentTraces failed for ${file}: ${err.message}\n`);
    }
  }
  return traces;
}

// --- Agent prompt loader ---

function readAgentPrompt(pluginRoot, name) {
  const path = join(pluginRoot, 'agents', `${name}.md`);
  const raw = readFileSafe(path);
  if (!raw) return null;
  // Strip YAML frontmatter if present.
  const match = raw.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1].trim() : raw;
}

// --- Response parsing ---

function parseJsonResponse(text) {
  if (!text) return null;
  // Strip ```json ... ``` fences if the model added them despite the prompt.
  const stripped = text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  try {
    return JSON.parse(stripped);
  } catch {
    // Fallback: try to extract the first JSON object substring. This is a
    // best-effort recovery for models that wrap JSON in prose despite the
    // prompt — it CAN succeed-and-yield-garbage if the prose contains a
    // stray `{}`. Log when this path is hit so a misbehaving model doesn't
    // silently produce normalized-but-meaningless output.
    const match = stripped.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      const parsed = JSON.parse(match[0]);
      process.stderr.write(`${LOG_PREFIX} WARN: primary JSON parse failed, used substring fallback — model likely wrapped JSON in prose\n`);
      return parsed;
    } catch {
      return null;
    }
  }
}

// --- Validation: anti-oscillation guardrail ---

/**
 * Enforce the "identityProposals must have >= minSources reflections" rule.
 * Drops violators silently and reports the count via stderr.
 *
 * Pure function — exported for unit testing.
 */
export function validateIdentityProposals(result, minSources = DEFAULT_MIN_REFLECTIONS_FOR_IDENTITY_CHANGE) {
  if (!result || !Array.isArray(result.identityProposals)) {
    return { ...result, identityProposals: [] };
  }
  const before = result.identityProposals.length;
  const valid = result.identityProposals.filter(p => {
    const sources = Array.isArray(p.sourceReflections) ? p.sourceReflections : [];
    return sources.length >= minSources;
  });
  const dropped = before - valid.length;
  if (dropped > 0) {
    process.stderr.write(`${LOG_PREFIX} dropped ${dropped} identity proposal(s) below ${minSources}-reflection threshold\n`);
  }
  return { ...result, identityProposals: valid };
}

// --- Main synthesis function ---

/**
 * Generate self-edit proposals from recent reflections + current state.
 *
 * @param {object} opts
 * @param {object} opts.client - Anthropic SDK client (or mock with .messages.create)
 * @param {string} opts.reflectionsDir - Path to .guya/memory/reflections (project-local)
 * @param {string} [opts.globalDir] - Path to ~/.claude/guya
 * @param {string} opts.pluginRoot - Path to plugin root (for reading agent prompt)
 * @param {number} [opts.maxReflections=5]
 * @param {number} [opts.minReflectionsForIdentityChange=2]
 * @param {boolean} [opts.dryRun=true] - Phase 1: always true. Phase 2 will flip this.
 * @returns {Promise<object|null>} Synthesis result or null on failure.
 */
export async function synthesizeFromReflections({
  client,
  reflectionsDir,
  globalDir = DEFAULT_GLOBAL_DIR,
  pluginRoot,
  maxReflections = DEFAULT_MAX_REFLECTIONS,
  minReflectionsForIdentityChange = DEFAULT_MIN_REFLECTIONS_FOR_IDENTITY_CHANGE,
  dryRun = true,
} = {}) {
  if (!client || !client.messages || typeof client.messages.create !== 'function') {
    process.stderr.write(`${LOG_PREFIX} no client provided, skipping\n`);
    return null;
  }
  if (!pluginRoot) {
    process.stderr.write(`${LOG_PREFIX} no pluginRoot provided, skipping\n`);
    return null;
  }
  if (!reflectionsDir) {
    process.stderr.write(`${LOG_PREFIX} no reflectionsDir provided, skipping\n`);
    return null;
  }

  const reflections = readReflections(reflectionsDir, maxReflections);
  if (reflections.length === 0) {
    process.stderr.write(`${LOG_PREFIX} no reflections found in ${reflectionsDir}, skipping\n`);
    return null;
  }

  const systemPrompt = readAgentPrompt(pluginRoot, 'guya-reflection-synthesizer');
  if (!systemPrompt) {
    process.stderr.write(`${LOG_PREFIX} missing guya-reflection-synthesizer.md, skipping\n`);
    return null;
  }

  const currentSoul = readFileSafe(join(globalDir, 'soul.md')) || '';
  const currentUser = readFileSafe(join(globalDir, 'user.md')) || '';
  const currentGrowth = readFileSafe(join(globalDir, 'growth-tracker.md')) || '';
  const currentGuidelines = readGuidelines(join(globalDir, 'guidelines', 'strategic'));
  const recentTraces = readRecentTraces(join(globalDir, 'traces'), 24);

  const inputPayload = {
    reflections,
    currentSoul,
    currentUser,
    currentGrowth,
    currentGuidelines,
    recentTraces: recentTraces.slice(0, 100), // cap to keep input bounded
  };

  process.stderr.write(
    `${LOG_PREFIX} synthesizing from ${reflections.length} reflections ` +
    `(${reflections.filter(r => r.isManual).length} manual), ` +
    `${currentGuidelines.length} guidelines, ${recentTraces.length} traces\n`
  );

  let response;
  try {
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: JSON.stringify(inputPayload) }],
    });
  } catch (err) {
    process.stderr.write(`${LOG_PREFIX} API call failed: ${err.message}\n`);
    return null;
  }

  const text = response?.content?.[0]?.text ?? '';
  const parsed = parseJsonResponse(text);
  if (!parsed || typeof parsed !== 'object') {
    process.stderr.write(`${LOG_PREFIX} response was not valid JSON\n`);
    return null;
  }

  // Normalize shape — guarantee the three streams exist as arrays.
  const normalized = {
    guidelineEdits: Array.isArray(parsed.guidelineEdits) ? parsed.guidelineEdits : [],
    userProfileAdditions: Array.isArray(parsed.userProfileAdditions) ? parsed.userProfileAdditions : [],
    identityProposals: Array.isArray(parsed.identityProposals) ? parsed.identityProposals : [],
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
  };

  const validated = validateIdentityProposals(normalized, minReflectionsForIdentityChange);

  process.stderr.write(
    `${LOG_PREFIX} result: ${validated.guidelineEdits.length} guideline edits, ` +
    `${validated.userProfileAdditions.length} user additions, ` +
    `${validated.identityProposals.length} identity proposals (post-filter)\n`
  );

  // Phase 1: dry-run only. Write to inspection file.
  if (dryRun) {
    try {
      const inspectionFile = join(globalDir, '.last-synthesis.json');
      const out = {
        ts: new Date().toISOString(),
        inputs: {
          reflectionCount: reflections.length,
          manualReflectionCount: reflections.filter(r => r.isManual).length,
          guidelineCount: currentGuidelines.length,
          recentTraceCount: recentTraces.length,
        },
        result: validated,
      };
      writeFileSync(inspectionFile, JSON.stringify(out, null, 2), 'utf-8');
      process.stderr.write(`${LOG_PREFIX} dry-run: wrote ${inspectionFile}\n`);
    } catch (err) {
      process.stderr.write(`${LOG_PREFIX} dry-run write failed: ${err.message}\n`);
    }
  }

  return validated;
}
