#!/usr/bin/env node
import { writeFileSync, appendFileSync } from 'fs';

const chunks = [];
process.stdin.on('data', (chunk) => chunks.push(chunk));
process.stdin.on('end', () => {
  const raw = Buffer.concat(chunks).toString('utf-8');
  appendFileSync('/tmp/guya-hook-debug.log', `\n--- ${new Date().toISOString()} ---\n${raw}\n`);
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
});
setTimeout(() => {
  console.log(JSON.stringify({ continue: true, suppressOutput: true }));
  process.exit(0);
}, 3000);
