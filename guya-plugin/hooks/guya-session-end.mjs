#!/usr/bin/env node

/**
 * Guya SessionEnd Hook
 *
 * CALLING SPEC:
 *   Input:  JSON on stdin with { sessionId, directory }
 *   Output: JSON on stdout with { continue: true }
 *
 *   Step 1: Read unclassified traces from ~/.claude/guya/traces/
 *   Step 2: Classify traces via Haiku (guya-observer)
 *   Step 3: Synthesize guidelines via Sonnet (guya-synthesizer)
 *   Step 4: Write session reflection via Sonnet (guya-reflector)
 *   Step 5: Update session context in core memory
 *
 *   All steps are best-effort — failures are caught and skipped.
 *   Completes in under 30 seconds.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { homedir } from 'os';
import { randomUUID } from 'crypto';
import { rename, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import Anthropic from '@anthropic-ai/sdk';

const GLOBAL_DIR = join(homedir(), '.claude', 'guya');
const PLUGIN_ROOT = process.env.CLAUDE_PLUGIN_ROOT || dirname(new URL(import.meta.url).pathname);

// --- Helpers ---

function readStdinWithTimeout(timeoutMs = 5000) {
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

function stripFrontmatter(content) {
  const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  return match ? match[1].trim() : content.trim();
}

function readAgentPrompt(name) {
  const path = join(PLUGIN_ROOT, 'agents', `${name}.md`);
  const raw = readFileSafe(path);
  if (!raw) return null;
  return stripFrontmatter(raw);
}

async function atomicWrite(filePath, content) {
  const tmp = join(tmpdir(), `guya-${randomUUID()}.tmp`);
  await writeFile(tmp, content, 'utf-8');
  await rename(tmp, filePath);
}

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    try { mkdirSync(dirPath, { recursive: true }); } catch {}
  }
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parseJsonResponse(text) {
  // Try direct parse first
  try { return JSON.parse(text); } catch {}
  // Try extracting from markdown code block
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }
  // Try finding first [ or { and parsing from there
  const start = text.search(/[\[{]/);
  if (start !== -1) {
    try { return JSON.parse(text.slice(start)); } catch {}
  }
  return null;
}

// --- Trace Reading ---

function readAllTraces(tracesDir) {
  if (!existsSync(tracesDir)) return [];
  let files;
  try { files = readdirSync(tracesDir).filter(f => f.endsWith('.jsonl')); } catch { return []; }

  const all = [];
  for (const file of files) {
    const raw = readFileSafe(join(tracesDir, file));
    if (!raw) continue;
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const trace = JSON.parse(trimmed);
        all.push({ trace, file });
      } catch {}
    }
  }
  return all;
}

function filterUnclassified(allTraces, sessionId) {
  return allTraces.filter(({ trace }) => {
    if (trace.classified === true) return false;
    if (sessionId && trace.sessionId && trace.sessionId !== sessionId) return false;
    return true;
  });
}

// Rewrite a JSONL file with updated traces
async function pruneClassifiedTraces(tracesDir, fileGroups) {
  for (const [file, traces] of Object.entries(fileGroups)) {
    const filePath = join(tracesDir, file);
    // Keep only unclassified traces — classified ones have served their purpose
    const remaining = traces.filter(t => !t.classified);
    if (remaining.length === 0) {
      // All traces classified — delete the file
      try { unlinkSync(filePath); } catch {}
    } else {
      const lines = remaining.map(t => JSON.stringify(t)).join('\n') + '\n';
      await atomicWrite(filePath, lines);
    }
  }
}

// --- Pre-filter: skip noise, only classify traces with learning signal ---

function hasLearningSignal(trace) {
  // Always classify corrections and preferences
  if (trace.type === 'correction' || trace.type === 'preference') return true;

  // Always classify reflections
  if (trace.type === 'reflection') return true;

  // Classify edits to Guya's own identity/guideline/memory files
  const ctx = (trace.context || '').toLowerCase();
  if (ctx.includes('.claude/guya/') || ctx.includes('.guya/')) return true;

  // Skip routine read-only tools — no learning signal
  const toolName = (trace.content || '').replace('Tool: ', '').toLowerCase();
  const noiseTools = ['read', 'glob', 'grep', 'bash', 'ls', 'cat', 'head', 'tail', 'toolsearch'];
  if (noiseTools.includes(toolName)) return false;

  // Classify writes — they represent decisions
  if (['write', 'edit', 'notebookedit'].includes(toolName)) return true;

  // Default: skip. Most tool calls are routine.
  return false;
}

function preFilterTraces(unclassified) {
  // Also detect repeated failures: same tool failing 3+ times in a row
  const filtered = [];
  const failureRuns = {};

  for (const entry of unclassified) {
    const { trace } = entry;
    const toolName = (trace.content || '').replace('Tool: ', '');

    // Track consecutive failures
    const output = (trace.toolOutput || '').toLowerCase();
    if (output.includes('error') || output.includes('failed') || output.includes('exit code 1')) {
      failureRuns[toolName] = (failureRuns[toolName] || 0) + 1;
      if (failureRuns[toolName] >= 3) {
        filtered.push(entry); // Repeated failure is a signal
        continue;
      }
    } else {
      failureRuns[toolName] = 0;
    }

    if (hasLearningSignal(trace)) {
      filtered.push(entry);
    }
  }

  return filtered;
}

// --- Step 2: Classify ---

async function classifyTraces(client, unclassified) {
  const systemPrompt = readAgentPrompt('guya-observer');
  if (!systemPrompt) {
    process.stderr.write('[guya-session-end] Missing guya-observer.md, skipping classification\n');
    return null;
  }

  const traces = unclassified.map(({ trace }) => trace);
  const userMessage = JSON.stringify(traces);

  let response;
  try {
    response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (err) {
    process.stderr.write(`[guya-session-end] Classification API error: ${err.message}\n`);
    return null;
  }

  const text = response.content?.[0]?.text ?? '';
  const parsed = parseJsonResponse(text);
  if (!Array.isArray(parsed)) {
    process.stderr.write('[guya-session-end] Classification response was not a JSON array\n');
    return null;
  }
  return parsed;
}

// --- Step 3: Synthesize ---

function readExistingGuidelines() {
  const strategicDir = join(GLOBAL_DIR, 'guidelines', 'strategic');
  if (!existsSync(strategicDir)) return [];
  let files;
  try { files = readdirSync(strategicDir).filter(f => f.endsWith('.md')); } catch { return []; }

  const guidelines = [];
  for (const file of files) {
    const raw = readFileSafe(join(strategicDir, file));
    if (raw) guidelines.push({ file, content: raw });
  }
  return guidelines;
}

async function synthesizeGuidelines(client, highConfidenceTraces, existingGuidelines) {
  const systemPrompt = readAgentPrompt('guya-synthesizer');
  if (!systemPrompt) {
    process.stderr.write('[guya-session-end] Missing guya-synthesizer.md, skipping synthesis\n');
    return null;
  }

  const userMessage = JSON.stringify({ highConfidenceTraces, existingGuidelines });

  let response;
  try {
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (err) {
    process.stderr.write(`[guya-session-end] Synthesis API error: ${err.message}\n`);
    return null;
  }

  const text = response.content?.[0]?.text ?? '';
  const parsed = parseJsonResponse(text);
  if (!parsed || typeof parsed !== 'object') {
    process.stderr.write('[guya-session-end] Synthesis response was not a JSON object\n');
    return null;
  }
  return parsed;
}

function writeGuidelineFile(guideline) {
  const strategicDir = join(GLOBAL_DIR, 'guidelines', 'strategic');
  ensureDir(strategicDir);
  const id = guideline.id || `guideline-${randomUUID()}`;
  const filename = `${id}.md`;
  const frontmatter = [
    '---',
    `id: ${id}`,
    `domain: ${guideline.domain || 'general'}`,
    `confidence: ${guideline.confidence ?? 0.5}`,
    `rank: ${guideline.rank ?? 50}`,
    `created: ${guideline.created || today()}`,
    `lastValidated: ${guideline.lastValidated || today()}`,
    `sourceTraces: ${JSON.stringify(guideline.sourceTraces || [])}`,
    '---',
    '',
    guideline.body || guideline.content || '',
  ].join('\n');
  return atomicWrite(join(strategicDir, filename), frontmatter);
}

function updateGuidelineFile(existingFile, updates) {
  const strategicDir = join(GLOBAL_DIR, 'guidelines', 'strategic');
  const filePath = join(strategicDir, existingFile);
  const raw = readFileSafe(filePath);
  if (!raw) return Promise.resolve();

  // Replace confidence and lastValidated in frontmatter
  let updated = raw;
  if (updates.confidence != null) {
    updated = updated.replace(/^confidence:.*$/m, `confidence: ${updates.confidence}`);
  }
  if (updates.lastValidated != null) {
    updated = updated.replace(/^lastValidated:.*$/m, `lastValidated: ${updates.lastValidated}`);
  }
  return atomicWrite(filePath, updated);
}

// --- Step 4: Reflect ---

async function writeReflection(client, sessionTraces, directory, sessionId) {
  const systemPrompt = readAgentPrompt('guya-reflector');
  if (!systemPrompt) {
    process.stderr.write('[guya-session-end] Missing guya-reflector.md, skipping reflection\n');
    return;
  }

  const userMessage = JSON.stringify(sessionTraces);

  let response;
  try {
    response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (err) {
    process.stderr.write(`[guya-session-end] Reflection API error: ${err.message}\n`);
    return;
  }

  const text = response.content?.[0]?.text ?? '';
  if (!text) return;

  const reflectionsDir = join(directory, '.guya', 'memory', 'reflections');
  ensureDir(reflectionsDir);
  const shortId = (sessionId || 'unknown').slice(0, 8);
  const filename = `${today()}-${shortId}.md`;
  await atomicWrite(join(reflectionsDir, filename), text);
}

// --- Step 5: Session context ---

async function updateSessionContext(directory, sessionTraces, classificationResults) {
  const coreDir = join(directory, '.guya', 'memory', 'core');
  ensureDir(coreDir);

  const traceCount = sessionTraces.length;
  const domains = classificationResults
    ? [...new Set(classificationResults.map(r => r.domain).filter(Boolean))].join(', ')
    : 'unclassified';

  const summary = `Last session (${today()}): ${traceCount} trace(s) captured${domains ? `, domains: ${domains}` : ''}.`;
  await atomicWrite(join(coreDir, 'session-context.md'), summary);
}

// --- Step 6: Archival memory update ---

async function updateArchivalMemory(directory, sessionTraces, classificationResults) {
  const archivalDir = join(directory, '.guya', 'memory', 'archival');
  ensureDir(archivalDir);

  // Detect project from directory name
  const projectName = directory.split('/').pop().toLowerCase().replace(/[^a-z0-9-]/g, '');
  if (!projectName) return;

  const archivalFile = join(archivalDir, `${projectName}.md`);
  const dateStr = today();

  // Build a brief summary from traces
  const toolNames = [...new Set(
    sessionTraces.map(t => (t.content || '').replace('Tool: ', '')).filter(Boolean)
  )];
  const domains = classificationResults
    ? [...new Set(classificationResults.map(r => r.domain).filter(Boolean))]
    : [];

  const summary = `\n\n## Session ${dateStr}\n- Tools used: ${toolNames.slice(0, 10).join(', ') || 'none captured'}\n- Domains: ${domains.join(', ') || 'general'}\n- Traces: ${sessionTraces.length}\n`;

  // Append to existing archival file or create new one
  if (existsSync(archivalFile)) {
    const existing = readFileSync(archivalFile, 'utf-8');
    await atomicWrite(archivalFile, existing + summary);
  } else {
    await atomicWrite(archivalFile, `# ${projectName}\n${summary}`);
  }
}

// --- Helpers for main pipeline ---

function loadApiKey() {
  let apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    try {
      const envFile = readFileSafe(join(GLOBAL_DIR, '.env'));
      if (envFile) {
        const match = envFile.match(/^ANTHROPIC_API_KEY=(.+)$/m);
        if (match) apiKey = match[1].trim().replace(/^["']|["']$/g, '');
      }
    } catch {}
  }
  return apiKey || null;
}

async function persistClassifications(classificationResults, allTracesWithMeta, unclassified, tracesDir) {
  const classById = new Map(classificationResults.map(r => [r.traceId, r]));
  const fileGroups = {};
  for (const { trace, file } of allTracesWithMeta) {
    if (!fileGroups[file]) fileGroups[file] = [];
    const cls = trace.traceId ? classById.get(trace.traceId) : null;
    if (cls && unclassified.some(u => u.trace === trace)) {
      fileGroups[file].push({
        ...trace, classified: true,
        persistence: cls.persistence, confidence: cls.confidence, domain: cls.domain,
      });
    } else {
      fileGroups[file].push(trace);
    }
  }
  await pruneClassifiedTraces(tracesDir, fileGroups);
}

async function runSynthesis(client, classificationResults) {
  const highConf = classificationResults.filter(r => (r.confidence ?? 0) >= 0.85);
  if (highConf.length === 0) return;
  const existingGuidelines = readExistingGuidelines().slice(0, 10);
  const synthesis = await synthesizeGuidelines(client, highConf, existingGuidelines);
  if (!synthesis) return;
  const writes = [];
  for (const g of synthesis.newGuidelines || []) writes.push(writeGuidelineFile(g));
  for (const u of synthesis.updatedGuidelines || []) {
    const match = existingGuidelines.find(eg => eg.content.includes(u.id));
    if (match) writes.push(updateGuidelineFile(match.file, u));
  }
  await Promise.allSettled(writes);
}

// --- Main ---

async function main() {
  const stdinData = await readStdinWithTimeout(5000);

  let sessionId = null;
  let directory = process.cwd();
  try {
    const input = JSON.parse(stdinData);
    sessionId = input.session_id || input.sessionId || sessionId;
    directory = input.cwd || input.directory || directory;
  } catch {}

  const apiKey = loadApiKey();
  if (!apiKey) {
    process.stderr.write('[guya-session-end] ANTHROPIC_API_KEY not set (checked env + ~/.claude/guya/.env), skipping evolution\n');
    return console.log(JSON.stringify({ continue: true }));
  }

  const tracesDir = join(GLOBAL_DIR, 'traces');
  const allTracesWithMeta = readAllTraces(tracesDir);
  const unclassified = filterUnclassified(allTracesWithMeta, sessionId);

  if (unclassified.length === 0) return console.log(JSON.stringify({ continue: true }));

  const client = new Anthropic({ apiKey });

  // Classify traces
  const signalTraces = preFilterTraces(unclassified);
  process.stderr.write(`[guya-session-end] Pre-filter: ${unclassified.length} traces -> ${signalTraces.length} with signal\n`);

  let classificationResults = null;
  if (signalTraces.length === 0) {
    process.stderr.write('[guya-session-end] No traces with learning signal, skipping classification\n');
  } else try {
    classificationResults = await classifyTraces(client, signalTraces);
  } catch (err) {
    process.stderr.write(`[guya-session-end] Classification failed: ${err.message}\n`);
  }

  // Persist classifications
  if (classificationResults) {
    try { await persistClassifications(classificationResults, allTracesWithMeta, unclassified, tracesDir); }
    catch (err) { process.stderr.write(`[guya-session-end] Failed to persist classifications: ${err.message}\n`); }
  }

  // Synthesize guidelines
  if (classificationResults) {
    try { await runSynthesis(client, classificationResults); }
    catch (err) { process.stderr.write(`[guya-session-end] Synthesis failed: ${err.message}\n`); }
  }

  const sessionTraces = allTracesWithMeta
    .filter(({ trace }) => !sessionId || !trace.sessionId || trace.sessionId === sessionId)
    .map(({ trace }) => trace);

  // Reflect, update context, update archival — independent, run all
  try { await writeReflection(client, sessionTraces, directory, sessionId); }
  catch (err) { process.stderr.write(`[guya-session-end] Reflection failed: ${err.message}\n`); }

  try { await updateSessionContext(directory, sessionTraces, classificationResults); }
  catch (err) { process.stderr.write(`[guya-session-end] Session context update failed: ${err.message}\n`); }

  try { await updateArchivalMemory(directory, sessionTraces, classificationResults); }
  catch (err) { process.stderr.write(`[guya-session-end] Archival update failed: ${err.message}\n`); }

  console.log(JSON.stringify({ continue: true }));
}

main().catch((err) => {
  process.stderr.write(`[guya-session-end] Fatal: ${err.message}\n`);
  console.log(JSON.stringify({ continue: true }));
});
