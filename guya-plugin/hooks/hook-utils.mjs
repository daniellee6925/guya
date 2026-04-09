/**
 * hook-utils.mjs — Shared utilities for Guya hooks
 *
 * CALLING SPEC:
 *   Exports: readStdin(timeoutMs) -> Promise<string>
 *   Used by: guya-decision-gate.mjs, guya-pre-commit-review.mjs, and any future hooks
 */

/**
 * Read stdin with timeout (async, event-based).
 * Resolves to raw string — caller is responsible for JSON.parse.
 */
export function readStdin(timeoutMs = 2000) {
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
    process.stdin.on('error', (err) => {
      if (!settled) {
        settled = true;
        clearTimeout(timeout);
        console.error('[hook-utils] stdin error:', err.message);
        resolve('');
      }
    });
    if (process.stdin.readableEnded) {
      if (!settled) { settled = true; clearTimeout(timeout); resolve(Buffer.concat(chunks).toString('utf-8')); }
    }
  });
}
