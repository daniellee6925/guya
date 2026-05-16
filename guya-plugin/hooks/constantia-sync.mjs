#!/usr/bin/env node

/**
 * Constantia Sync Utilities
 *
 * CALLING SPEC:
 *   Shared helpers for reading/writing to the Constantia shared memory repo.
 *   Used by guya-session-start.mjs and guya-session-end.mjs.
 *
 *   Config: ~/.claude/guya/constantia.json — { "path": "/absolute/path/to/constantia" }
 *   If config or path is missing, all functions return null / skip gracefully.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir, tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { rename, writeFile } from 'fs/promises';

const GLOBAL_DIR = join(homedir(), '.claude', 'guya');
const CONSTANTIA_CONFIG = join(GLOBAL_DIR, 'constantia.json');

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    try { mkdirSync(dirPath, { recursive: true }); } catch {}
  }
}

async function atomicWrite(filePath, content) {
  const tmp = join(tmpdir(), `constantia-${randomUUID()}.tmp`);
  await writeFile(tmp, content, 'utf-8');
  await rename(tmp, filePath);
}

export function resolveConstantiaPath() {
  try {
    if (!existsSync(CONSTANTIA_CONFIG)) return { path: null, error: 'constantia.json not found at ~/.claude/guya/' };
    const config = JSON.parse(readFileSync(CONSTANTIA_CONFIG, 'utf-8'));
    if (!config.path) return { path: null, error: 'constantia.json has no "path" field' };
    if (!existsSync(config.path)) return { path: null, error: `Constantia path does not exist: ${config.path}` };
    return { path: config.path, error: null };
  } catch (e) {
    return { path: null, error: `Failed to read constantia.json: ${e.message}` };
  }
}

/**
 * Read the constantia-sync daemon's status file (ADR-024) and return an alert
 * string when something is wrong, or null when healthy or daemon not deployed.
 *
 * Alerts fire on:
 *   - heartbeat stale (>SYNC_STALE_THRESHOLD_MS old) → daemon dead or hung
 *   - last_cycle_outcome == 'conflict' → rebase blocked, manual resolution
 *   - last_cycle_outcome == 'push-failed' / 'fetch-failed' → network/auth
 *
 * Returns null when status file is absent (daemon not deployed on this host —
 * e.g. laptop session reading a constantia checkout that no daemon writes to).
 *
 * Depends on daemon's atomic write contract (tmp + rename) so a concurrent
 * readFileSync never sees a partial file. ENOENT during the rename window is
 * caught and reported as a generic read failure, not silently swallowed.
 *
 * Cheap (one JSON file read). Safe to call on every session-start.
 */
const SYNC_STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export function readSyncStatus(constantiaPath) {
  try {
    const statusPath = join(constantiaPath, '.git', 'sync-status.json');
    if (!existsSync(statusPath)) return null;

    const status = JSON.parse(readFileSync(statusPath, 'utf-8'));
    const lastCycleMs = status.last_cycle_ts ? Date.parse(status.last_cycle_ts) : NaN;

    if (!Number.isFinite(lastCycleMs)) {
      return 'constantia-sync: no heartbeat in status file';
    }

    const ageMs = Date.now() - lastCycleMs;
    if (ageMs > SYNC_STALE_THRESHOLD_MS) {
      const ageMin = Math.floor(ageMs / 60000);
      return `constantia-sync stale: last heartbeat ${ageMin}m ago (daemon dead or hung?)`;
    }
    if (status.last_cycle_outcome === 'conflict') {
      const filesArr = Array.isArray(status.conflict_files) ? status.conflict_files : [];
      const files = filesArr.join(', ') || '(no files captured)';
      return `constantia-sync blocked on rebase conflict: ${files}`;
    }
    if (status.last_cycle_outcome === 'push-failed' || status.last_cycle_outcome === 'fetch-failed') {
      return `constantia-sync last cycle: ${status.last_cycle_outcome} — ${status.last_error || 'no detail'}`;
    }
    return null;
  } catch (e) {
    return `constantia-sync status read failed: ${e.message}`;
  }
}

export function readTaskManifest(constantiaPath) {
  const manifestPath = join(constantiaPath, 'tasks', 'MANIFEST.md');
  const content = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf-8').trim() : null;
  if (!content) return null;

  const lines = content.split('\n').filter(l => l.startsWith('|') && !l.startsWith('| ID') && !l.startsWith('|--'));
  if (lines.length === 0) return null;

  const activeTasks = lines.filter(l => {
    const cols = l.split('|').map(c => c.trim()).filter(Boolean);
    const status = cols[1];
    return status === 'assigned' || status === 'in-progress';
  });

  if (activeTasks.length === 0) return null;

  const formatted = activeTasks.map(l => {
    const cols = l.split('|').map(c => c.trim()).filter(Boolean);
    return `- ${cols[0]} [${cols[1]}] P${cols[2]}: ${cols[5]}`;
  }).join('\n');

  return `## Constantia — Active Tasks\n\n${formatted}`;
}

export async function writeSessionLog(directory, sessionId, sessionTraces, classificationResults) {
  const { path: constantiaPath } = resolveConstantiaPath();
  if (!constantiaPath) {
    process.stderr.write('[constantia-sync] path not configured or missing, skipping log write\n');
    return;
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const shortSessionId = (sessionId || 'unknown').slice(0, 8);
  const logDir = join(constantiaPath, 'log');
  ensureDir(logDir);

  const logFile = join(logDir, `${dateStr}-guya-${shortSessionId}.md`);
  const projectName = directory.split('/').pop();
  const domains = classificationResults
    ? [...new Set(classificationResults.map(r => r.domain).filter(Boolean))]
    : [];
  const toolNames = [...new Set(sessionTraces.map(t => t.content?.split(':')[0]).filter(Boolean))];

  const content = `---
date: ${dateStr}
author: guya
session_project: ${projectName}
tasks_progressed: []
tasks_proposed: []
---

## Summary

Guya session in ${projectName}. Tools: ${toolNames.slice(0, 5).join(', ') || 'none captured'}. Domains: ${domains.join(', ') || 'general'}. Traces: ${sessionTraces.length}.

## Artifacts produced

${sessionTraces.slice(0, 10).map(t => `- ${t.file || t.content || 'unknown'}`).join('\n') || '(none captured)'}
`;

  if (existsSync(logFile)) {
    const existing = readFileSync(logFile, 'utf-8');
    await atomicWrite(logFile, existing + '\n---\n\n' + content);
  } else {
    await atomicWrite(logFile, content);
  }

  try {
    const { execSync } = await import('child_process');
    execSync(`git add "${logFile}" && git commit -m "log: guya session ${dateStr} in ${projectName}" --quiet`, {
      cwd: constantiaPath,
      timeout: 10000,
      stdio: 'pipe',
    });
    process.stderr.write(`[constantia-sync] log written to ${logFile}\n`);
  } catch (err) {
    process.stderr.write(`[constantia-sync] git commit failed: ${err.message}\n`);
  }
}
