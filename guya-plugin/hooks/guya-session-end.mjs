#!/usr/bin/env node

/**
 * Guya SessionEnd Hook
 *
 * CALLING SPEC:
 *   Input:  JSON on stdin with { sessionId, directory }
 *   Output: JSON on stdout with { continue: true }
 *
 *   Step 1: Read unclassified traces from {directory}/.guya/evolution/traces/
 *   Step 2: Classify traces via Haiku (guya-observer)
 *   Step 3: Synthesize guidelines via Sonnet (guya-synthesizer)
 *   Step 4: Write session reflection via Sonnet (guya-reflector)
 *   Step 5: Update session context in core memory
 *
 *   All steps are best-effort — failures are caught and skipped.
 *   Completes in under 30 seconds.
 */

import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
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
async function markTracesClassified(tracesDir, fileGroups) {
  for (const [file, traces] of Object.entries(fileGroups)) {
    const filePath = join(tracesDir, file);
    const lines = traces.map(t => JSON.stringify(t)).join('\n') + '\n';
    await atomicWrite(filePath, lines);
  }
}

// --- Step 2: Classify ---

async function classifyTraces(client, unclassified) {
  const systemPrompt = readAgentPrompt('guya-observer');
  if (!systemPrompt) {
    process.stderr.write('[guya-session-end] Missing guya-observer.md, skipping classification\n');
    return null;
  }

  const traces = unclassified.map(({ trace }) => trace);
  const userMessage = JSON.stringify(traces, null, 2);

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

  const userMessage = JSON.stringify({ highConfidenceTraces, existingGuidelines }, null, 2);

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

  const userMessage = JSON.stringify(sessionTraces, null, 2);

  let response;
  try {
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    process.stderr.write('[guya-session-end] ANTHROPIC_API_KEY not set, skipping evolution\n');
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  const tracesDir = join(directory, '.guya', 'evolution', 'traces');
  const allTracesWithMeta = readAllTraces(tracesDir);
  const unclassified = filterUnclassified(allTracesWithMeta, sessionId);

  if (unclassified.length === 0) {
    console.log(JSON.stringify({ continue: true }));
    return;
  }

  const client = new Anthropic({ apiKey });

  // Step 2: Classify
  let classificationResults = null;
  try {
    classificationResults = await classifyTraces(client, unclassified);
  } catch (err) {
    process.stderr.write(`[guya-session-end] Step 2 failed: ${err.message}\n`);
  }

  // Mark traces as classified and rewrite JSONL files
  if (classificationResults) {
    // Group by file, merge classification back onto traces
    const classById = new Map(classificationResults.map(r => [r.traceId, r]));
    const fileGroups = {};
    for (const { trace, file } of allTracesWithMeta) {
      if (!fileGroups[file]) fileGroups[file] = [];
      const cls = trace.traceId ? classById.get(trace.traceId) : null;
      if (cls && unclassified.some(u => u.trace === trace)) {
        fileGroups[file].push({
          ...trace,
          classified: true,
          persistence: cls.persistence,
          confidence: cls.confidence,
          domain: cls.domain,
        });
      } else {
        fileGroups[file].push(trace);
      }
    }
    try {
      await markTracesClassified(tracesDir, fileGroups);
    } catch (err) {
      process.stderr.write(`[guya-session-end] Failed to persist classifications: ${err.message}\n`);
    }
  }

  // Step 3: Synthesize
  if (classificationResults) {
    const highConf = classificationResults.filter(r => (r.confidence ?? 0) >= 0.85);
    if (highConf.length > 0) {
      try {
        const existingGuidelines = readExistingGuidelines();
        const synthesis = await synthesizeGuidelines(client, highConf, existingGuidelines);
        if (synthesis) {
          const writes = [];
          for (const g of synthesis.newGuidelines || []) {
            writes.push(writeGuidelineFile(g));
          }
          for (const u of synthesis.updatedGuidelines || []) {
            const match = existingGuidelines.find(eg => eg.content.includes(u.id));
            if (match) writes.push(updateGuidelineFile(match.file, u));
          }
          await Promise.allSettled(writes);
        }
      } catch (err) {
        process.stderr.write(`[guya-session-end] Step 3 failed: ${err.message}\n`);
      }
    }
  }

  // Step 4: Reflect
  const sessionTraces = allTracesWithMeta
    .filter(({ trace }) => !sessionId || !trace.sessionId || trace.sessionId === sessionId)
    .map(({ trace }) => trace);

  try {
    await writeReflection(client, sessionTraces, directory, sessionId);
  } catch (err) {
    process.stderr.write(`[guya-session-end] Step 4 failed: ${err.message}\n`);
  }

  // Step 5: Update session context
  try {
    await updateSessionContext(directory, sessionTraces, classificationResults);
  } catch (err) {
    process.stderr.write(`[guya-session-end] Step 5 failed: ${err.message}\n`);
  }

  console.log(JSON.stringify({ continue: true }));
}

main().catch((err) => {
  process.stderr.write(`[guya-session-end] Fatal: ${err.message}\n`);
  console.log(JSON.stringify({ continue: true }));
});
