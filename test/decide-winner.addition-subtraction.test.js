/*
 * Standalone unit test for scuttle-addition-subtraction.html's decideWinner.
 * No browser, no jsdom — decideWinner is pure, so this is plain Node.
 */

'use strict';

const assert = require('assert');
const { loadPage } = require('./vm-load-page');

const page = loadPage('scuttle-addition-subtraction.html');
const { decideWinner } = page;
assert.strictEqual(typeof decideWinner, 'function', 'decideWinner should be defined as a top-level function');

const cases = [
  // [humanDist, botDist, expected, label]
  [0, 0, 'tie', 'both exact hits on the target'],
  [7, 7, 'tie', 'equal nonzero distances'],
  [3, 10, 'human', 'human strictly closer'],
  [10, 3, 'bot', 'bot strictly closer'],
  [1, 0, 'bot', 'bot hits exactly, human off by 1'],
  [0, 1, 'human', 'human hits exactly, bot off by 1'],
  [499, 500, 'human', 'both far away, human still closer by 1'],
];

let failures = 0;
for (const [humanDist, botDist, expected, label] of cases) {
  const actual = decideWinner(humanDist, botDist);
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} decideWinner(${humanDist}, ${botDist}) === '${expected}'  (${label})${pass ? '' : ` — got '${actual}'`}`);
}

if (failures > 0) {
  console.error(`\n  ${failures}/${cases.length} case(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log(`\n  all ${cases.length} decideWinner cases passed (scuttle-addition-subtraction.html)`);
}
