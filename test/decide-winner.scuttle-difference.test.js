/*
 * Standalone unit test for scuttle-difference.html's decideWinner.
 * No browser, no jsdom — decideWinner is pure. Identical in shape to
 * Product Scuttle's own decideWinner (see design/game-catalog.csv: "same
 * shell as Product but subtract") — same over/under-threshold combinations,
 * same tie sub-cases, same >target vs >=target boundary. Ported test cases
 * directly from test/decide-winner.product.test.js since the function
 * itself is byte-identical, just called on difference sums instead of
 * products.
 */

'use strict';

const assert = require('assert');
const { loadPage } = require('./vm-load-page');

const page = loadPage('scuttle-difference.html');
const { decideWinner } = page;
assert.strictEqual(typeof decideWinner, 'function', 'decideWinner should be defined as a top-level function');

const TARGET = 100;
const cases = [
  // [humanSum, botSum, expected, label]
  [120, 150, 'human', 'both over: human is the smaller-over-target sum, so human wins'],
  [160, 110, 'bot', 'both over: bot is the smaller-over-target sum, so bot wins'],
  [130, 130, 'tie', 'both over, exact tie'],
  [110, 90, 'human', 'human over, bot under: human wins outright'],
  [90, 110, 'bot', 'bot over, human under: bot wins outright'],
  [95, 80, 'human', 'both under: nobody clears it, so the larger (human) sum wins'],
  [70, 90, 'bot', 'both under: nobody clears it, so the larger (bot) sum wins'],
  [80, 80, 'tie', 'both under, exact tie'],
  [100, 100, 'tie', 'both land exactly on target (not "over") — falls to the under-branch, exact tie'],
  [100, 90, 'human', 'boundary: exactly-on-target does not count as over, but still beats a lower under-sum'],
  [0, 0, 'tie', 'both zero (every digit rolled a 0, or two equal splits) — under-branch exact tie'],
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
  console.log(`\n  all ${cases.length} decideWinner cases passed (scuttle-difference.html)`);
}
