/*
 * Standalone unit test for scuttle-product.html's decideWinner.
 * No browser, no jsdom — decideWinner is pure, so this is plain Node.
 * Covers all four over/under-threshold combinations (the real win rule:
 * smallest sum still over the target wins; if nobody clears it, the
 * largest sum wins instead), plus their tie sub-cases and the >target
 * vs >=target boundary.
 */

'use strict';

const assert = require('assert');
const { loadPage } = require('./vm-load-page');

const page = loadPage('scuttle-product.html');
const { decideWinner } = page;
assert.strictEqual(typeof decideWinner, 'function', 'decideWinner should be defined as a top-level function');

const TARGET = 1000;
const cases = [
  // [humanSum, botSum, expected, label]
  [1200, 1500, 'human', 'both over: human is the smaller-over-target sum, so human wins'],
  [1600, 1100, 'bot', 'both over: bot is the smaller-over-target sum, so bot wins'],
  [1300, 1300, 'tie', 'both over, exact tie'],
  [1100, 900, 'human', 'human over, bot under: human wins outright'],
  [900, 1100, 'bot', 'bot over, human under: bot wins outright'],
  [950, 800, 'human', 'both under: nobody clears it, so the larger (human) sum wins'],
  [700, 900, 'bot', 'both under: nobody clears it, so the larger (bot) sum wins'],
  [800, 800, 'tie', 'both under, exact tie'],
  [1000, 1000, 'tie', 'both land exactly on target (not "over") — falls to the under-branch, exact tie'],
  [1000, 900, 'human', 'boundary: exactly-on-target does not count as over, but still beats a lower under-sum'],
];

let failures = 0;
for (const [humanSum, botSum, expected, label] of cases) {
  const actual = decideWinner(humanSum, botSum, TARGET);
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} decideWinner(${humanSum}, ${botSum}, ${TARGET}) === '${expected}'  (${label})${pass ? '' : ` — got '${actual}'`}`);
}

if (failures > 0) {
  console.error(`\n  ${failures}/${cases.length} case(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log(`\n  all ${cases.length} decideWinner cases passed (scuttle-product.html)`);
}
