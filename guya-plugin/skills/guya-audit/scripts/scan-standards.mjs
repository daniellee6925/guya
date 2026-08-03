#!/usr/bin/env node

/**
 * scan-standards.mjs — Deterministic mechanical-standards scanner.
 *
 * CALLING SPEC
 * ============
 *   Usage:  node scan-standards.mjs <repo-root>
 *   Input:  a git repo root
 *   Output: JSON findings array on stdout; human summary on stderr
 *   Exit:   0 always (findings are data, not failure). Non-zero only on
 *           unusable input (not a repo, unreadable config).
 *
 *   Files that cannot be read or traversed are reported on stderr and
 *   counted in the summary. They are never silently dropped: this script
 *   claims full coverage of the repo, and a silent skip would turn an
 *   unaudited subtree into a clean bill of health.
 *
 * WHY THIS IS A SCRIPT AND NOT A PROMPT
 * -------------------------------------
 * The whole point of /guya-audit is that two runs over an unchanged repo
 * produce the SAME report. An LLM asked to "check file sizes" samples
 * differently every time — different files, different thresholds applied
 * inconsistently, different phrasing. That variance is the bug Daniel is
 * trying to kill.
 *
 * Every check in here is a pure function of the file bytes. Same repo in,
 * byte-identical JSON out. No model involved, so no variance to manage.
 * Checks that genuinely need judgment do NOT belong here — they belong in
 * the LLM lenses, which the skill runs separately and dedupes by fingerprint.
 *
 * DETERMINISM RULES (violating any of these breaks the feature)
 * -------------------------------------------------------------
 *   1. Files are processed in sorted order. Never rely on readdir order,
 *      which is filesystem-dependent.
 *   2. No timestamps, no random, no absolute paths in output. Findings are
 *      keyed on repo-relative paths so the same repo hashes the same on any
 *      machine.
 *   3. Fingerprints exclude line numbers. Line numbers shift on every edit;
 *      including them would re-file an "already fixed" issue as new after
 *      any unrelated change above it.
 *
 * FINDING SHAPE
 * -------------
 *   {
 *     id:       stable 16-hex fingerprint (dedup key)
 *     check:    check id, e.g. "file-too-long"
 *     class:    always "mechanical" from this script
 *     file:     repo-relative path
 *     anchor:   symbol name or path-level anchor (NOT a line number)
 *     standard: the rule being violated, in plain language
 *     detail:   the specific measurement, e.g. "912 lines (max 800)"
 *   }
 */

import { readFileSync, readdirSync, statSync, existsSync, realpathSync } from 'fs';
import { join, relative, extname, basename, dirname } from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';

// --- configuration ---------------------------------------------------------

// Directories never worth auditing: vendored, generated, or VCS internals.
// Excluded by name at any depth. Keeping this list fixed (rather than
// inferred) is itself a determinism requirement — an inferred ignore list
// would change as the repo changes and silently alter coverage.
const IGNORED_DIRS = new Set([
  '.git', 'node_modules', '.venv', 'venv', '__pycache__', '.mypy_cache',
  '.pytest_cache', '.ruff_cache', 'dist', 'build', '.next', 'out',
  'coverage', '.turbo', 'vendor', 'third_party', '.claude', '.omc',
]);

const CODE_EXTENSIONS = new Set(['.py', '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.go', '.rs']);

// Files that are structurally exempt from "needs a test" — entry points,
// package markers, and config-as-code carry no logic worth pinning.
const TEST_EXEMPT_BASENAMES = new Set([
  '__init__.py', 'conftest.py', 'setup.py', 'index.ts', 'index.js',
  'main.ts', 'main.js', 'types.ts', 'constants.ts', 'schema.ts',
]);

// Default marker strings live in an adjacent DATA file, never inline here.
//
// Any source file that spells these strings literally is flagged by every
// marker-scanning tool pointed at this repo — this scanner, and the repo's
// own .git/hooks/pre-commit cleanup check, which blocked this very commit
// until the strings moved out. That is the use-mention problem: text naming
// a convention is not an instance of it. Moving the data out of the code
// dissolves it for every such tool at once, rather than teaching each one a
// special case.
//
// Only code extensions are scanned, so the .json file itself is inert.
/**
 * Keep only usable marker patterns.
 *
 * Two concrete hazards, both cheap to eliminate here and expensive to debug
 * later:
 *   - a non-string entry reaches `marker.replace(...)` and throws mid-scan,
 *     taking down an audit that promises to degrade rather than die
 *   - an empty string makes `includes('')` true for every line, so every
 *     line of every file becomes a finding
 * Same class as the `pathExempt: [""]` guard in the review gate's config
 * normalizer: valid JSON that quietly destroys the check.
 */
function usableMarkers(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((m) => typeof m === 'string' && m.length > 0);
}

const DEFAULT_MARKERS = (() => {
  try {
    const p = join(dirname(fileURLToPath(import.meta.url)), 'default-markers.json');
    const parsed = JSON.parse(readFileSync(p, 'utf-8'));
    const markers = usableMarkers(parsed?.markers);
    if (markers.length > 0) return markers;
    process.stderr.write('[audit] default-markers.json has no usable "markers" array — marker check disabled\n');
  } catch (err) {
    // Fail loud but keep scanning: losing one check is better than losing
    // the whole audit, and a silent empty list would look like a clean repo.
    process.stderr.write(`[audit] could not read default-markers.json (${err?.message || err}) — marker check disabled\n`);
  }
  return [];
})();

const DEFAULTS = {
  maxFileLOC: 800,
  maxFunctionLines: 80,
  markers: DEFAULT_MARKERS,
};

// --- helpers ---------------------------------------------------------------

/**
 * Stable fingerprint for a finding. Deliberately excludes line numbers and
 * measurements: a file that is 912 lines today and 905 tomorrow is the SAME
 * unfixed problem, and re-filing it as new every night would bury the issue
 * tracker. Identity is (check, file, anchor) only.
 */
function fingerprint(check, file, anchor) {
  return createHash('sha256').update(`${check}\x00${file}\x00${anchor}`).digest('hex').slice(0, 16);
}

function finding(check, file, anchor, standard, detail) {
  return { id: fingerprint(check, file, anchor), check, class: 'mechanical', file, anchor, standard, detail };
}

/**
 * Read the repo's own standards. The skill audits a repo against ITS OWN
 * written rules, not a hardcoded house style — that is what makes it
 * portable across Daniel's repos. `.guya/pre-commit-config.json` already
 * encodes the numeric limits, so reuse it rather than inventing a second
 * source of truth that can drift from the gate.
 */
function loadStandards(root) {
  // Copy the markers array, not just the wrapper. `{ ...DEFAULTS }` is
  // shallow, so the returned object would otherwise hand every caller the
  // same module-level array — and this function is exported, so one caller
  // mutating its `markers` would silently change the defaults for every
  // later call in the process. Cheap to prevent, miserable to diagnose.
  const out = { ...DEFAULTS, markers: [...DEFAULTS.markers] };
  const configPath = join(root, '.guya', 'pre-commit-config.json');
  if (!existsSync(configPath)) return out;
  try {
    const cfg = JSON.parse(readFileSync(configPath, 'utf-8'));
    if (Number.isFinite(cfg?.complexity?.maxFileLOC)) out.maxFileLOC = cfg.complexity.maxFileLOC;
    if (Number.isFinite(cfg?.complexity?.maxFunctionLines)) out.maxFunctionLines = cfg.complexity.maxFunctionLines;
    // Filter the repo's patterns too — this config is user-editable, so a
    // stray empty string or number here would otherwise flag every line or
    // crash the scan.
    const repoMarkers = usableMarkers([
      ...(cfg?.cleanup?.patterns?.python || []),
      ...(cfg?.cleanup?.patterns?.javascript || []),
    ]);
    if (repoMarkers.length > 0) out.markers = [...new Set(repoMarkers)];
  } catch {
    // Malformed config → fall back to defaults rather than aborting the
    // whole audit. The gate itself already fails closed on a broken config,
    // so the user will hear about it from there; the audit going silent
    // would just remove a second signal.
    process.stderr.write('[audit] .guya/pre-commit-config.json unreadable — using default standards\n');
  }
  return out;
}

/**
 * Recursively collect code files, sorted, ignoring vendored/generated trees.
 *
 * Unreadable directories are pushed to `skipped` rather than swallowed. The
 * audit's promise is full coverage of the repo; a permission error that
 * silently removes a subtree would report "no findings there" when the truth
 * is "never looked". Callers surface `skipped` in the run summary.
 */
function collectFiles(root, skipped = []) {
  const files = [];
  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir);
    } catch (err) {
      skipped.push({ path: relative(root, dir) || '.', reason: err?.message || String(err) });
      return;
    }
    // Sort at every level so traversal order is identical on every run and
    // on every machine, regardless of filesystem readdir ordering.
    for (const name of entries.slice().sort()) {
      const full = join(dir, name);
      let st;
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) {
        if (IGNORED_DIRS.has(name)) continue;
        walk(full);
      } else if (CODE_EXTENSIONS.has(extname(name))) {
        files.push(full);
      }
    }
  }
  walk(root);
  return files.sort();
}

function isTestFile(rel) {
  return /(^|\/)tests?\//.test(rel) || /(^|\/)__tests__\//.test(rel)
    || /\.(test|spec)\.[a-z]+$/.test(rel) || /(^|\/)test_[^/]+$/.test(rel);
}

// --- checks ----------------------------------------------------------------
//
// Each check is a pure function (file, rel, lines, text, standards) → findings.
// Registry-dispatched rather than if-else chained so adding a check is one
// entry and the run order stays fixed.

function checkFileTooLong(_f, rel, lines, _t, std) {
  if (lines.length <= std.maxFileLOC) return [];
  return [finding('file-too-long', rel, rel,
    `Files must stay under ${std.maxFileLOC} lines (one file, one responsibility)`,
    `${lines.length} lines (max ${std.maxFileLOC})`)];
}

/**
 * Function-length check.
 *
 * End detection is INDENTATION-based, not "start of the next definition".
 * The naive version measures def-to-next-def, which counts every nested
 * closure and every sibling block in between: on this repo's own test files
 * it reported a 3-line `makeTmpDir()` as 121 lines, and 13 of 25 findings
 * were fiction. A mechanical check that is wrong half the time is worse than
 * no check, because it teaches you to skim past the whole category.
 *
 * A function ends at the first non-blank, non-comment line whose indentation
 * returns to at most the definition's own indentation. That is exact for
 * Python and reliable for brace languages under any standard formatter,
 * which is what these repos use.
 *
 * Test files are skipped outright: long `describe`/`it` bodies are normal
 * structure rather than rot, and nested arrow callbacks defeat any
 * indentation heuristic.
 */
function checkFunctionTooLong(_f, rel, lines, _t, std) {
  if (isTestFile(rel)) return [];

  const out = [];
  const isPy = extname(rel) === '.py';
  const defRe = isPy
    ? /^(\s*)(?:async\s+)?def\s+([A-Za-z_][\w]*)/
    : /^(\s*)(?:export\s+)?(?:async\s+)?(?:function\s+([A-Za-z_$][\w$]*)|const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\(|function))/;

  const isSkippable = (s) => {
    const t = s.trim();
    return t === '' || t.startsWith('#') || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
  };

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(defRe);
    if (!m) continue;
    const name = m[2] || m[3] || 'anonymous';
    const indent = m[1].length;

    let end = lines.length;
    for (let j = i + 1; j < lines.length; j++) {
      if (isSkippable(lines[j])) continue;
      const lineIndent = lines[j].search(/\S/);
      if (lineIndent <= indent) { end = j; break; }
    }

    const len = end - i;
    if (len > std.maxFunctionLines) {
      out.push(finding('function-too-long', rel, name,
        `Functions must stay under ${std.maxFunctionLines} lines`,
        `${name}() is ${len} lines (max ${std.maxFunctionLines})`));
    }
  }
  return out;
}

/**
 * True when `marker` appears on the line OUTSIDE of any quoted string.
 *
 * A quoted occurrence is a marker being *named* rather than *left behind* —
 * a lint config listing one as data, for instance. Flagging those is a
 * self-inflicted false positive, and a check that cries wolf on config files
 * teaches you to skim past the whole category, which costs more than the
 * check is worth.
 *
 * Strips quoted occurrences first, then asks whether any remain — so a line
 * that both names a marker and leaves one still reports correctly.
 */
function hasUnquotedMarker(line, marker) {
  const esc = marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const stripped = line.replace(new RegExp(`['"\`]${esc}['"\`]`, 'g'), '');
  // Word-like markers match on word boundaries so prose *about* a marker does
  // not trip it: a comment discussing them in the plural is a sentence, not a
  // leftover. Markers that are code fragments end in punctuation, where \b
  // would be wrong, so those match literally.
  if (/^\w+$/.test(marker)) {
    return new RegExp(`\\b${esc}\\b`).test(stripped);
  }
  return stripped.includes(marker);
}

function checkLeftoverMarkers(_f, rel, lines, _t, std) {
  // Test files are exempt: fixtures legitimately contain marker text as data,
  // and a debug statement inside a test is not shipping code. Same reasoning
  // as the function-length check skipping tests — a check that fires on its
  // own test suite is a check people learn to ignore.
  //
  // No self-exclusion is needed any more: moving the default list into
  // default-markers.json means this file no longer spells any marker, so
  // there is nothing here to falsely match.
  if (isTestFile(rel)) return [];

  const out = [];
  const seen = new Set();
  for (const line of lines) {
    for (const marker of std.markers) {
      // Anchor on the marker, not the line number, so the finding keeps its
      // identity as the file shifts around it. One finding per marker per
      // file — ten FIXMEs in one file is one cleanup task, not ten issues.
      if (!seen.has(marker) && hasUnquotedMarker(line, marker)) {
        seen.add(marker);
        out.push(finding('leftover-marker', rel, marker,
          'Debug and placeholder markers must not ship',
          `contains ${marker}`));
      }
    }
  }
  return out;
}

/**
 * Missing calling spec — the LOD rule "every module starts with a calling
 * spec (inputs, outputs, side effects)". Approximated as "the file opens
 * with a block comment or docstring". Approximate is fine here: the failure
 * mode is a false positive on an unusual header style, which costs one
 * dismissed issue, not a silent miss.
 */
function checkMissingCallingSpec(_f, rel, lines, _t, _std) {
  if (isTestFile(rel)) return [];
  const head = lines.slice(0, 40).join('\n');
  const hasSpec = /"""|'''|\/\*\*|^\s*\/\/|^\s*#/m.test(head);
  if (hasSpec) return [];
  return [finding('missing-calling-spec', rel, rel,
    'Every module starts with a calling spec (inputs, outputs, side effects)',
    'no module-level docstring or header comment found')];
}

function checkMissingTest(_f, rel, lines, _t, _std) {
  if (isTestFile(rel)) return [];
  if (TEST_EXEMPT_BASENAMES.has(basename(rel))) return [];
  // Only flag files substantial enough to be worth pinning. A 20-line helper
  // demanding its own test file is noise, and noise is what makes people
  // stop reading the report.
  if (lines.length < 40) return [];
  return [{ __needsTestLookup: true, rel, lines: lines.length }];
}

const CHECKS = [
  checkFileTooLong,
  checkFunctionTooLong,
  checkLeftoverMarkers,
  checkMissingCallingSpec,
  checkMissingTest,
];

// --- main ------------------------------------------------------------------

function main() {
  const root = process.argv[2];
  if (!root || !existsSync(root)) {
    process.stderr.write('usage: node scan-standards.mjs <repo-root>\n');
    process.exit(2);
  }
  if (!existsSync(join(root, '.git'))) {
    process.stderr.write(`[audit] ${root} is not a git repo\n`);
    process.exit(2);
  }

  const std = loadStandards(root);
  const skipped = [];
  const files = collectFiles(root, skipped);
  const relFiles = files.map((f) => relative(root, f));

  const findings = [];
  const pendingTest = [];

  for (const abs of files) {
    const rel = relative(root, abs);
    let text;
    try {
      text = readFileSync(abs, 'utf-8');
    } catch (err) {
      // Never `continue` silently — an unreadable file that vanishes from
      // the report is indistinguishable from a clean one.
      skipped.push({ path: rel, reason: err?.message || String(err) });
      continue;
    }
    const lines = text.split('\n');
    for (const check of CHECKS) {
      for (const f of check(abs, rel, lines, text, std)) {
        if (f.__needsTestLookup) pendingTest.push(f);
        else findings.push(f);
      }
    }
  }

  // Test-file existence needs the full file set, so it resolves after the
  // per-file pass rather than inside it.
  for (const p of pendingTest) {
    const base = basename(p.rel).replace(/\.[^.]+$/, '');
    const dir = dirname(p.rel);
    // Scan `relFiles` directly. The previous form spread a Set into a fresh
    // array on every iteration — on lina_platform that was ~84 allocations of
    // a 782-element array to answer a question the existing array already
    // holds.
    const hasTest = relFiles.some((c) =>
      isTestFile(c) && (c.includes(`test_${base}.`) || c.includes(`${base}.test.`)
        || c.includes(`${base}.spec.`) || c.includes(`/${base}/`) || c.endsWith(`/${base}_test.py`)));
    if (!hasTest) {
      findings.push(finding('missing-test', p.rel, p.rel,
        'Substantial modules need a test file',
        `${p.lines} lines, no matching test found (searched for test_${base}.*, ${base}.test.*, ${base}.spec.*) in ${dir}`));
    }
  }

  // Sort by (file, check, anchor) so output ordering is content-derived, not
  // traversal-derived. Two runs must produce byte-identical JSON.
  findings.sort((a, b) =>
    a.file.localeCompare(b.file) || a.check.localeCompare(b.check) || a.anchor.localeCompare(b.anchor));

  process.stdout.write(JSON.stringify(findings, null, 2) + '\n');

  const byCheck = {};
  for (const f of findings) byCheck[f.check] = (byCheck[f.check] || 0) + 1;
  process.stderr.write(`[audit] scanned ${files.length} files, ${findings.length} mechanical findings\n`);
  for (const [k, v] of Object.entries(byCheck).sort()) {
    process.stderr.write(`[audit]   ${k}: ${v}\n`);
  }
  if (skipped.length > 0) {
    // Loud, and last, so it is the thing you see. A partial scan reported as
    // a clean one is the worst outcome this script can produce.
    process.stderr.write(`[audit] WARNING: ${skipped.length} path(s) could not be read — coverage is INCOMPLETE\n`);
    for (const s of skipped) process.stderr.write(`[audit]   skipped ${s.path}: ${s.reason}\n`);
  }
}

// Only run main() when executed as a script, never on import — otherwise the
// test suite importing this module would run a full scan with no argv[2] and
// exit(2), killing the test process.
//
// Both sides go through realpathSync: Node resolves `import.meta.url` to the
// realpath while `process.argv[1]` keeps the symlink path, so a naive `===`
// silently fails under symlinked plugin installs and main() never runs. That
// exact bug (ADR-013) disabled five hooks here for weeks — see
// hooks/CLAUDE.md "Regression History".
const isMain = (() => {
  try { return realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]); }
  catch { return false; }
})();

if (isMain) {
  main();
}

export { fingerprint, collectFiles, isTestFile, loadStandards, hasUnquotedMarker, CHECKS };
