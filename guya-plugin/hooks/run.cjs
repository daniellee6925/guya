#!/usr/bin/env node
'use strict';

/**
 * Guya hook runner — spawns ESM hook scripts with inherited stdio.
 * Same pattern as OMC's run.cjs.
 */

const { spawnSync } = require('child_process');
const { existsSync } = require('fs');

const target = process.argv[2];
if (!target || !existsSync(target)) {
  process.exit(0);
}

const result = spawnSync(
  process.execPath,
  [target, ...process.argv.slice(3)],
  { stdio: 'inherit', env: process.env }
);

process.exit(result.status ?? 0);
