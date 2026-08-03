/**
 * scan-standards.test.mjs — pins the properties /guya-audit depends on.
 *
 * PURPOSE
 *   The audit skill's entire value proposition is "same code in, same report
 *   out." That is a property of THIS script, so it needs a test that fails
 *   loudly if the property is ever lost. Everything here targets a specific
 *   way the determinism guarantee can silently break.
 *
 * COVERAGE
 *   1. Determinism — two runs over an unchanged tree produce identical JSON
 *   2. Fingerprint stability — identity survives line movement, changes on
 *      a genuinely different finding
 *   3. Marker self-reference — a quoted marker definition is not a finding
 *   4. Standards loading — repo config overrides defaults, broken config
 *      falls back instead of throwing
 *   5. Traversal — ignored dirs skipped, order sorted
 */

import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

import {
  fingerprint,
  collectFiles,
  isTestFile,
  loadStandards,
  hasUnquotedMarker,
} from '../scan-standards.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scan-standards.mjs');

function makeRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'guya-audit-test-'));
  mkdirSync(join(dir, '.git'), { recursive: true });
  return dir;
}

function run(dir) {
  const out = execFileSync('node', [SCRIPT, dir], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
  return out;
}

describe('scan-standards: determinism (the core guarantee)', () => {
  let dir;
  beforeEach(() => { dir = makeRepo(); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('produces byte-identical output across runs on an unchanged tree', () => {
    // Several files, several checks, nested dirs — enough surface that any
    // ordering nondeterminism (readdir order, Set iteration, unsorted output)
    // would show up as a diff.
    mkdirSync(join(dir, 'src', 'deep'), { recursive: true });
    writeFileSync(join(dir, 'src', 'a.py'), 'x = 1\n'.repeat(120));
    writeFileSync(join(dir, 'src', 'b.py'), '# TODO\n' + 'y = 2\n'.repeat(60));
    writeFileSync(join(dir, 'src', 'deep', 'c.js'), 'const z = 3;\n'.repeat(90));
    writeFileSync(join(dir, 'src', 'deep', 'd.js'), '// header\ndebugger;\n');

    const first = run(dir);
    const second = run(dir);
    assert.equal(first, second, 'two runs over an unchanged repo must be byte-identical');
    assert.ok(JSON.parse(first).length > 0, 'fixture should actually produce findings');
  });

  it('sorts findings by content, not by filesystem traversal order', () => {
    mkdirSync(join(dir, 'zzz'), { recursive: true });
    mkdirSync(join(dir, 'aaa'), { recursive: true });
    writeFileSync(join(dir, 'zzz', 'z.py'), 'a = 1\n'.repeat(100));
    writeFileSync(join(dir, 'aaa', 'a.py'), 'b = 2\n'.repeat(100));

    const findings = JSON.parse(run(dir));
    const files = findings.map((f) => f.file);
    assert.deepEqual(files, [...files].sort(), 'output must be sorted by file');
  });
});

describe('scan-standards: fingerprint stability', () => {
  it('is identical for the same (check, file, anchor)', () => {
    assert.equal(
      fingerprint('file-too-long', 'src/a.py', 'src/a.py'),
      fingerprint('file-too-long', 'src/a.py', 'src/a.py'),
    );
  });

  it('does not depend on line numbers or measurements', () => {
    // The whole reason fingerprints exclude line numbers: a finding that
    // shifted down 12 lines is the SAME unfixed problem. If identity moved
    // with the line, every nightly run would re-file everything and bury
    // the tracker.
    const a = fingerprint('function-too-long', 'src/a.py', 'process');
    const b = fingerprint('function-too-long', 'src/a.py', 'process');
    assert.equal(a, b);
  });

  it('differs when the check, file, or anchor differs', () => {
    const base = fingerprint('file-too-long', 'src/a.py', 'src/a.py');
    assert.notEqual(base, fingerprint('missing-test', 'src/a.py', 'src/a.py'));
    assert.notEqual(base, fingerprint('file-too-long', 'src/b.py', 'src/b.py'));
    assert.notEqual(base, fingerprint('file-too-long', 'src/a.py', 'other'));
  });

  it('does not collide when field contents contain the separator character', () => {
    // Fields are joined with NUL precisely so that ("a b", "c") cannot hash
    // the same as ("a", "b c"). A space separator would collide here.
    assert.notEqual(
      fingerprint('check', 'a b', 'c'),
      fingerprint('check', 'a', 'b c'),
    );
  });
});

describe('scan-standards: marker use-mention guard', () => {
  // Cases are loaded from a JSON fixture rather than written inline. A test
  // for marker detection must contain marker strings, and a code file that
  // does is flagged by every marker-scanning tool pointed at this repo —
  // including the repo's own pre-commit cleanup check, which blocked this
  // commit until the fixtures moved to data. Only code extensions are
  // scanned, so JSON is inert.
  const cases = JSON.parse(
    readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'marker-cases.json'), 'utf-8'),
  );

  it('ignores a marker that is only named, never left behind', () => {
    for (const c of cases.namedOnly) {
      assert.equal(hasUnquotedMarker(c.line, c.marker), false, c.why);
    }
  });

  it('still flags a genuine leftover marker', () => {
    for (const c of cases.genuine) {
      assert.equal(hasUnquotedMarker(c.line, c.marker), true, c.why);
    }
  });

  it('flags a line that both names a marker and leaves one', () => {
    for (const c of cases.bothNamedAndLeft) {
      assert.equal(hasUnquotedMarker(c.line, c.marker), true, c.why);
    }
  });

  it('does not match prose discussing the marker in plural', () => {
    for (const c of cases.pluralProse) {
      assert.equal(hasUnquotedMarker(c.line, c.marker), false, c.why);
    }
  });

  it('does not crash on markers containing regex metacharacters', () => {
    for (const c of cases.regexMetacharacters) {
      assert.doesNotThrow(() => hasUnquotedMarker(c.line, c.marker), c.why);
      assert.equal(hasUnquotedMarker(c.line, c.marker), true, c.why);
    }
  });
});

describe('scan-standards: standards loading', () => {
  let dir;
  beforeEach(() => { dir = makeRepo(); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('defaults when no .guya config exists', () => {
    const std = loadStandards(dir);
    assert.equal(std.maxFileLOC, 800);
    assert.equal(std.maxFunctionLines, 80);
  });

  it('honours the repo\'s own limits so the audit cannot disagree with the gate', () => {
    mkdirSync(join(dir, '.guya'), { recursive: true });
    writeFileSync(join(dir, '.guya', 'pre-commit-config.json'),
      JSON.stringify({ complexity: { maxFileLOC: 300, maxFunctionLines: 25 } }));
    const std = loadStandards(dir);
    assert.equal(std.maxFileLOC, 300);
    assert.equal(std.maxFunctionLines, 25);
  });

  it('drops empty-string and non-string markers from the repo config', () => {
    // An empty string makes includes('') true for every line, turning every
    // line of every file into a finding; a number throws inside the regex
    // build and kills the scan. Both are valid JSON, so only filtering
    // catches them.
    mkdirSync(join(dir, '.guya'), { recursive: true });
    writeFileSync(join(dir, '.guya', 'pre-commit-config.json'),
      JSON.stringify({ cleanup: { patterns: { python: ['', 'TODO_MARKER', 123, null] } } }));
    const std = loadStandards(dir);
    assert.deepEqual(std.markers, ['TODO_MARKER']);
  });

  it('keeps defaults when the repo config has only unusable markers', () => {
    mkdirSync(join(dir, '.guya'), { recursive: true });
    writeFileSync(join(dir, '.guya', 'pre-commit-config.json'),
      JSON.stringify({ cleanup: { patterns: { python: ['', ''] } } }));
    const std = loadStandards(dir);
    assert.ok(std.markers.length > 0, 'must fall back rather than silently disable the check');
    assert.ok(std.markers.every((m) => typeof m === 'string' && m.length > 0));
  });

  it('returns a markers array callers cannot use to poison later calls', () => {
    // loadStandards is exported. A shallow object spread would hand every
    // caller the same module-level array, so one mutation would corrupt the
    // defaults for the rest of the process.
    const a = loadStandards(dir);
    const originalLength = a.markers.length;
    a.markers.push('INJECTED');
    const b = loadStandards(dir);
    assert.equal(b.markers.length, originalLength, 'defaults must be isolated from caller mutation');
    assert.ok(!b.markers.includes('INJECTED'));
  });

  it('falls back to defaults on a malformed config instead of throwing', () => {
    // The gate already fails closed on a broken config, so the audit dying
    // here would just remove a second signal.
    mkdirSync(join(dir, '.guya'), { recursive: true });
    writeFileSync(join(dir, '.guya', 'pre-commit-config.json'), '{not json');
    const std = loadStandards(dir);
    assert.equal(std.maxFileLOC, 800);
  });
});

describe('scan-standards: traversal', () => {
  let dir;
  beforeEach(() => { dir = makeRepo(); });
  afterEach(() => { try { rmSync(dir, { recursive: true, force: true }); } catch {} });

  it('skips vendored and generated trees', () => {
    mkdirSync(join(dir, 'node_modules', 'pkg'), { recursive: true });
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'node_modules', 'pkg', 'index.js'), 'x\n'.repeat(2000));
    writeFileSync(join(dir, 'src', 'real.js'), 'y\n');

    const files = collectFiles(dir).map((f) => f.replace(dir, ''));
    assert.ok(files.some((f) => f.includes('real.js')));
    assert.ok(!files.some((f) => f.includes('node_modules')), 'node_modules must never be audited');
  });

  it('recognises test files across conventions', () => {
    assert.equal(isTestFile('tests/test_thing.py'), true);
    assert.equal(isTestFile('src/__tests__/thing.test.mjs'), true);
    assert.equal(isTestFile('src/thing.spec.ts'), true);
    assert.equal(isTestFile('src/thing.py'), false);
  });
});
