/**
 * load-config.test.mjs — Pre-commit gate config loader
 *
 * PURPOSE:
 *   Cover the lookup + merge + normalization behavior of guya-pre-commit-review.mjs
 *   loadConfig.
 *
 *   Two historical bug classes under test:
 *
 *   1. Fail-open on missing config (the original SDF bug): the hook used to
 *      return null when project config was missing, silently disabling the
 *      review gate. Fixed by adding a user-wide fallback at
 *      `~/.claude/guya/pre-commit-config.json`. Tests pin the lookup order
 *      and shallow-merge semantics.
 *
 *   2. Fail-open on broken config (Codex catch during review): the first
 *      implementation collapsed ENOENT and parse errors into the same "null"
 *      state, so a transient partial-write during editor save would pass
 *      commits ungated. Fixed with tri-state readJsonFile + fail-closed
 *      at the caller. Tests pin "broken = error" (not "broken = absent").
 *
 *   Also covers normalizeConfig — minimal guardrails against two concrete
 *   exploits Codex named: empty-string exemption entries and non-numeric
 *   `gateMaxAgeMinutes`.
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

import { loadConfig } from '../guya-pre-commit-review.mjs';

// --- Test fixtures ---

function makeTmpDir(prefix) {
  return mkdtempSync(join(tmpdir(), `guya-load-config-${prefix}-`));
}

function writeProjectConfig(projectDir, config) {
  const guyaDir = join(projectDir, '.guya');
  mkdirSync(guyaDir, { recursive: true });
  writeFileSync(
    join(guyaDir, 'pre-commit-config.json'),
    JSON.stringify(config),
  );
}

function writeProjectConfigRaw(projectDir, rawContent) {
  const guyaDir = join(projectDir, '.guya');
  mkdirSync(guyaDir, { recursive: true });
  writeFileSync(join(guyaDir, 'pre-commit-config.json'), rawContent);
}

function writeUserConfig(userConfigPath, config) {
  writeFileSync(userConfigPath, JSON.stringify(config));
}

// --- Tests ---

describe('loadConfig: lookup order and merge', () => {
  let projectDir;
  let userConfigDir;
  let userConfigPath;

  beforeEach(() => {
    projectDir = makeTmpDir('proj');
    userConfigDir = makeTmpDir('user');
    userConfigPath = join(userConfigDir, 'pre-commit-config.json');
  });

  afterEach(() => {
    try { rmSync(projectDir, { recursive: true, force: true }); } catch {}
    try { rmSync(userConfigDir, { recursive: true, force: true }); } catch {}
  });

  it('returns {config: null, error: null} when both configs are absent (fail-open path)', () => {
    // This is the ONLY path that still fails open — both files missing
    // matches pre-PR behavior for projects opted out entirely.
    const result = loadConfig(projectDir, userConfigPath);
    assert.deepEqual(result, { config: null, error: null });
  });

  it('returns user config when only user-wide exists (SDF scenario)', () => {
    // The exact bug we fixed: a project with no config now picks up the
    // user-wide fallback instead of silently ungating.
    writeUserConfig(userConfigPath, { gateMaxAgeMinutes: 30, smallChange: { maxLines: 10 } });
    const { config, error } = loadConfig(projectDir, userConfigPath);
    assert.equal(error, null);
    assert.deepEqual(config, { gateMaxAgeMinutes: 30, smallChange: { maxLines: 10 } });
  });

  it('returns project config when only project exists', () => {
    writeProjectConfig(projectDir, { gateMaxAgeMinutes: 15 });
    const { config, error } = loadConfig(projectDir, userConfigPath);
    assert.equal(error, null);
    assert.deepEqual(config, { gateMaxAgeMinutes: 15 });
  });

  it('project top-level keys override user-level on collision, shallow merge', () => {
    writeUserConfig(userConfigPath, { gateMaxAgeMinutes: 30, smallChange: { maxLines: 10 } });
    writeProjectConfig(projectDir, { gateMaxAgeMinutes: 15 });
    const { config, error } = loadConfig(projectDir, userConfigPath);
    assert.equal(error, null);
    assert.equal(config.gateMaxAgeMinutes, 15);
    assert.deepEqual(config.smallChange, { maxLines: 10 });
  });

  it('nested objects are replaced wholesale (shallow merge, not deep)', () => {
    // Documents the shallow-merge contract. Overriding complexity at the
    // project level replaces the whole block, losing user-level siblings.
    writeUserConfig(userConfigPath, {
      complexity: { maxFileLOC: 800, maxFunctionLines: 80 },
      gateMaxAgeMinutes: 30,
    });
    writeProjectConfig(projectDir, {
      complexity: { maxFileLOC: 400 },
    });
    const { config } = loadConfig(projectDir, userConfigPath);
    assert.deepEqual(config.complexity, { maxFileLOC: 400 });
    assert.equal(config.complexity.maxFunctionLines, undefined);
    assert.equal(config.gateMaxAgeMinutes, 30);
  });

  it('project-only keys are added on top of the user-level base', () => {
    writeUserConfig(userConfigPath, { gateMaxAgeMinutes: 30 });
    writeProjectConfig(projectDir, { skipOnMerge: true });
    const { config } = loadConfig(projectDir, userConfigPath);
    assert.equal(config.gateMaxAgeMinutes, 30);
    assert.equal(config.skipOnMerge, true);
  });
});

describe('loadConfig: fail-closed on broken files', () => {
  let projectDir;
  let userConfigDir;
  let userConfigPath;

  beforeEach(() => {
    projectDir = makeTmpDir('broken');
    userConfigDir = makeTmpDir('broken-user');
    userConfigPath = join(userConfigDir, 'pre-commit-config.json');
  });

  afterEach(() => {
    try { rmSync(projectDir, { recursive: true, force: true }); } catch {}
    try { rmSync(userConfigDir, { recursive: true, force: true }); } catch {}
  });

  it('malformed user config returns error (NOT treated as absent)', () => {
    // Codex catch: collapsing parse errors into null silently relocates the
    // fail-open bug. A mid-write read or corrupt file must surface as an
    // error so the caller can fail closed.
    writeFileSync(userConfigPath, '{broken json');
    const { config, error } = loadConfig(projectDir, userConfigPath);
    assert.equal(config, null);
    assert.ok(error, 'must return an error string');
    assert.match(error, /pre-commit-config\.json/);
  });

  it('malformed project config returns error even if user config is valid', () => {
    // Project config is checked first in the return-error path. A broken
    // project config should fail closed even when the user fallback would
    // otherwise work — otherwise a partial-write during editor save would
    // silently fall back, which is exactly the fail-open we're fixing.
    writeUserConfig(userConfigPath, { gateMaxAgeMinutes: 30 });
    writeProjectConfigRaw(projectDir, 'not json at all');
    const { config, error } = loadConfig(projectDir, userConfigPath);
    assert.equal(config, null);
    assert.ok(error);
  });

  it('both malformed = error (also fail-closed)', () => {
    writeFileSync(userConfigPath, '{oops');
    writeProjectConfigRaw(projectDir, 'also oops');
    const { config, error } = loadConfig(projectDir, userConfigPath);
    assert.equal(config, null);
    assert.ok(error);
  });

  it('config that is a JSON array fails closed (parses but not an object)', () => {
    // A config file accidentally saved as `[]` or `[{...}]` would spread
    // to `{}` and silently degrade to "no config". Must fail closed.
    writeProjectConfigRaw(projectDir, '[]');
    const { config, error } = loadConfig(projectDir, userConfigPath);
    assert.equal(config, null);
    assert.ok(error);
    assert.match(error, /expected a JSON object.*got array/);
  });

  it('config that is JSON null fails closed', () => {
    // `null` is valid JSON and `typeof null === 'object'` is a famous
    // gotcha. readJsonFile explicitly rejects it.
    writeProjectConfigRaw(projectDir, 'null');
    const { config, error } = loadConfig(projectDir, userConfigPath);
    assert.equal(config, null);
    assert.ok(error);
    assert.match(error, /expected a JSON object.*got object/);
  });

  it('config that is a JSON primitive (number, string, boolean) fails closed', () => {
    writeProjectConfigRaw(projectDir, '42');
    const r1 = loadConfig(projectDir, userConfigPath);
    assert.equal(r1.config, null);
    assert.match(r1.error, /got number/);

    writeProjectConfigRaw(projectDir, '"hello"');
    const r2 = loadConfig(projectDir, userConfigPath);
    assert.equal(r2.config, null);
    assert.match(r2.error, /got string/);

    writeProjectConfigRaw(projectDir, 'true');
    const r3 = loadConfig(projectDir, userConfigPath);
    assert.equal(r3.config, null);
    assert.match(r3.error, /got boolean/);
  });

  it('missing user config + valid project config works normally (ENOENT != error)', () => {
    // Sanity: ENOENT must be distinguished from parse error. A missing
    // file is legitimate absence; a present-but-broken file is an error.
    writeProjectConfig(projectDir, { gateMaxAgeMinutes: 15 });
    const { config, error } = loadConfig(projectDir, userConfigPath);
    assert.equal(error, null);
    assert.equal(config.gateMaxAgeMinutes, 15);
  });
});

describe('loadConfig: normalizeConfig guards against concrete exploits', () => {
  let projectDir;
  let userConfigDir;
  let userConfigPath;

  beforeEach(() => {
    projectDir = makeTmpDir('norm');
    userConfigDir = makeTmpDir('norm-user');
    userConfigPath = join(userConfigDir, 'pre-commit-config.json');
  });

  afterEach(() => {
    try { rmSync(projectDir, { recursive: true, force: true }); } catch {}
    try { rmSync(userConfigDir, { recursive: true, force: true }); } catch {}
  });

  it('empty strings in pathExempt are filtered (Codex exploit: "" matches every file)', () => {
    // file.includes("") is always true, so pathExempt:[""] exempts every
    // file from review. Catch it at the loader, don't trust downstream
    // isExempt to defend itself.
    writeProjectConfig(projectDir, { pathExempt: ['', 'docs/', ''] });
    const { config } = loadConfig(projectDir, userConfigPath);
    assert.deepEqual(config.pathExempt, ['docs/']);
  });

  it('empty strings in reviewExempt are filtered', () => {
    writeProjectConfig(projectDir, { reviewExempt: ['', '*.md', ''] });
    const { config } = loadConfig(projectDir, userConfigPath);
    assert.deepEqual(config.reviewExempt, ['*.md']);
  });

  it('non-string entries in exempt arrays are filtered', () => {
    writeProjectConfig(projectDir, {
      pathExempt: ['docs/', null, 42, {}, '.guya/'],
    });
    const { config } = loadConfig(projectDir, userConfigPath);
    assert.deepEqual(config.pathExempt, ['docs/', '.guya/']);
  });

  it('non-numeric gateMaxAgeMinutes is coerced to default 30 (Codex exploit: NaN * 60000)', () => {
    // Number("foo") = NaN. NaN * 60000 = NaN. "age > NaN" is always false,
    // so evidence would never expire, burning the gate into a permanent
    // pass. Coerce to 30 (matching the pre-existing fallback in checkEvidence).
    writeProjectConfig(projectDir, { gateMaxAgeMinutes: 'foo' });
    const { config } = loadConfig(projectDir, userConfigPath);
    assert.equal(config.gateMaxAgeMinutes, 30);
  });

  it('numeric-string gateMaxAgeMinutes is coerced to number', () => {
    // "15" is harmless but should be normalized so downstream arithmetic
    // doesn't depend on implicit coercion.
    writeProjectConfig(projectDir, { gateMaxAgeMinutes: '15' });
    const { config } = loadConfig(projectDir, userConfigPath);
    assert.equal(config.gateMaxAgeMinutes, 15);
    assert.equal(typeof config.gateMaxAgeMinutes, 'number');
  });

  it('negative or zero gateMaxAgeMinutes is coerced to default 30', () => {
    writeProjectConfig(projectDir, { gateMaxAgeMinutes: -5 });
    const { config } = loadConfig(projectDir, userConfigPath);
    assert.equal(config.gateMaxAgeMinutes, 30);
  });

  it('missing gateMaxAgeMinutes passes through unchanged (defaults applied elsewhere)', () => {
    writeProjectConfig(projectDir, { smallChange: { maxLines: 5 } });
    const { config } = loadConfig(projectDir, userConfigPath);
    assert.equal(config.gateMaxAgeMinutes, undefined);
  });

  it('valid config shapes pass through normalize unchanged', () => {
    const valid = {
      gateMaxAgeMinutes: 30,
      pathExempt: ['docs/', '.guya/'],
      reviewExempt: ['*.md', '*.json'],
      smallChange: { maxLines: 10 },
    };
    writeProjectConfig(projectDir, valid);
    const { config } = loadConfig(projectDir, userConfigPath);
    assert.equal(config.gateMaxAgeMinutes, 30);
    assert.deepEqual(config.pathExempt, ['docs/', '.guya/']);
    assert.deepEqual(config.reviewExempt, ['*.md', '*.json']);
    assert.deepEqual(config.smallChange, { maxLines: 10 });
  });
});
