/**
 * hooks-smoke.test.mjs — Symlink-path dispatch smoke test for every registered hook.
 *
 * PURPOSE:
 *   Catch the next "isMain silently no-op'd" class of bug. Three regressions
 *   in three weeks shared the same shape: a hook was wired up correctly,
 *   the matcher dispatched, the import resolved cleanly — but main() never
 *   ran and the script wrote nothing. The realpathSync fix patches the
 *   specific symlink/argv mismatch, but the class of bug (silent rot of
 *   trusted enforcement) will recur in some other "obviously equivalent"
 *   guard. This test asserts the verifiable side-effect every hook owes:
 *   when invoked through the symlinked plugin install path with a benign
 *   payload, it must produce non-empty stdout (proof main() ran).
 *
 *   Empty stdout is the universal silent-no-op signature. If main() never
 *   runs, the script imports cleanly, exits 0, and writes nothing — exactly
 *   what bit us. This test fails on that signature for every registered
 *   hook in one shot.
 *
 * SCOPE:
 *   - Every hook listed in guya-plugin/hooks/hooks.json that points at an
 *     .mjs script in this directory (excludes shared utility modules).
 *   - Invoked via the symlinked plugin path (~/.claude/plugins/marketplaces/
 *     guya/hooks/...), not the source path. The whole point is to mirror
 *     how Claude Code actually launches hooks.
 *   - guya-session-end is skipped — it makes Anthropic API calls that
 *     cost money and aren't appropriate for a smoke test. Its main() is
 *     covered structurally by importing it.
 *
 * NOT IN SCOPE:
 *   - Functional correctness (the existing per-hook tests cover that).
 *   - Hook config validation (load-config.test.mjs covers that).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'child_process';
import { existsSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOOKS_DIR = join(__dirname, '..');
const SYMLINK_HOOKS_DIR = join(homedir(), '.claude', 'plugins', 'marketplaces', 'guya', 'hooks');
const HOOKS_JSON = join(HOOKS_DIR, 'hooks.json');

// Payload templates by hook event. Each one is benign — should make main()
// reach a return point quickly without recording side effects to the repo.
// The universal assertion is "stdout is non-empty," not "stdout matches X" —
// every hook emits SOMETHING when main() runs (the JSON response, a context
// block, a scribe message). Empty stdout means main() never reached the
// output line, which is the silent-no-op signature.
const PAYLOADS = {
  PreToolUse: { tool_name: 'Bash', tool_input: { command: 'echo smoke' }, session_id: 'smoke', cwd: '/tmp' },
  PostToolUse: { tool_name: 'Write', tool_input: { file_path: '/tmp/smoke.txt' }, tool_response: { success: true }, session_id: 'smoke', cwd: '/tmp' },
  UserPromptSubmit: { prompt: 'smoke test', session_id: 'smoke', cwd: '/tmp' },
  SessionStart: { session_id: 'smoke', cwd: '/tmp' },
  SessionEnd: { session_id: 'smoke', cwd: '/tmp' },
  PreCompact: { session_id: 'smoke', cwd: '/tmp' },
};

// Hooks whose main() makes API calls or has heavy side effects — exclude
// from smoke. The realpath/isMain bug isn't event-specific, so other hooks
// in the same file family adequately cover the regression.
const SKIP_SCRIPTS = new Set(['guya-session-end.mjs']);

function loadRegisteredHooks() {
  const config = JSON.parse(readFileSync(HOOKS_JSON, 'utf-8'));
  const entries = [];
  for (const [event, blocks] of Object.entries(config.hooks || {})) {
    for (const block of blocks) {
      for (const hook of block.hooks || []) {
        // Match the run.cjs invocation pattern: extract the .mjs script name.
        const m = (hook.command || '').match(/hooks\/([\w-]+\.mjs)/);
        if (!m) continue;
        const script = m[1];
        if (SKIP_SCRIPTS.has(script)) continue;
        entries.push({ event, matcher: block.matcher, script });
      }
    }
  }
  return entries;
}

function runHook(scriptPath, payload, timeoutMs = 10_000) {
  const result = spawnSync('node', [scriptPath], {
    input: JSON.stringify(payload),
    encoding: 'utf-8',
    timeout: timeoutMs,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return {
    status: result.status,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
    timedOut: result.error?.code === 'ETIMEDOUT' || result.signal === 'SIGTERM',
  };
}

describe('hooks-smoke: every registered hook produces output via symlinked plugin path', () => {
  it('symlinked plugin hooks dir exists', () => {
    assert.ok(
      existsSync(SYMLINK_HOOKS_DIR),
      `Symlinked plugin path missing: ${SYMLINK_HOOKS_DIR}. ` +
      `Claude Code installs the plugin under marketplaces/; if this path ` +
      `doesn't exist, the smoke test can't reproduce the real dispatch path.`,
    );
  });

  const hooks = loadRegisteredHooks();

  // Pin the count so a future hook that gets added to hooks.json without
  // a smoke entry surfaces here as a count drift instead of being silently
  // skipped. Update when intentionally adding hooks.
  it('hooks.json exposes the expected number of testable scripts', () => {
    assert.ok(hooks.length >= 6, `Expected ≥6 testable hook entries, found ${hooks.length}`);
  });

  for (const { event, matcher, script } of hooks) {
    it(`${event}:${matcher} → ${script} runs main() through symlink`, () => {
      const payload = PAYLOADS[event];
      assert.ok(payload, `No smoke payload defined for event ${event}`);

      const symlinkPath = join(SYMLINK_HOOKS_DIR, script);
      assert.ok(existsSync(symlinkPath), `Hook script missing at symlink: ${symlinkPath}`);

      const result = runHook(symlinkPath, payload);

      assert.ok(!result.timedOut, `${script} timed out — main() may be hanging`);
      assert.equal(result.status, 0, `${script} exited ${result.status}; stderr: ${result.stderr}`);
      assert.ok(
        result.stdout.trim().length > 0,
        `${script} produced empty stdout — main() likely never ran (isMain guard mismatch). ` +
        `This is the silent-no-op signature. stderr: ${result.stderr}`,
      );
    });
  }
});
