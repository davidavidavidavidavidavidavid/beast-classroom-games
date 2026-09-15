/*
 * Standalone unit test for pop-perimeter.html's decideWinner.
 * No browser, no jsdom — decideWinner is pure. Identical shape to Addition
 * Pop's own decideWinner (only ONE bust cause — over target — since side
 * lengths can't be negative, unlike Subtraction/Expression Pop's two-cause
 * rule) — see CLAUDE.md Testing methodology point 4 and Perimeter Pop's
 * own design note on why this bust shape, not Subtraction/Expression's,
 * applies here.
 */

'use strict';

const assert = require('assert');
const { loadPage } = require('./vm-load-page');

const page = loadPage('pop-perimeter.html');
const { decideWinner } = page;
assert.strictEqual(typeof decideWinner, 'function', 'decideWinner should be defined as a top-level function');

const TARGET = 18;
const cases = [
  // [humanSum, humanBusted, botSum, botBusted, expected, label]
  [16, false, 12, false, 'human', 'both safe: human is closer to target'],
  [12, false, 16, false, 'bot', 'both safe: bot is closer to target'],
  [14, false, 14, false, 'tie', 'both safe, exact same sum'],
  [18, false, 14, false, 'human', 'human lands exactly on target, beats a safe-but-lower bot'],
  [20, true, 10, false, 'bot', 'human busted, bot safe: bot wins outright regardless of margin'],
  [10, false, 24, true, 'human', 'bot busted, human safe: human wins outright regardless of margin'],
  [20, true, 36, true, 'tie', 'both busted: friendly tie (not covered by source rules as a comparison, so treated as a tie)'],
  [19, true, 35, true, 'tie', 'both busted by very different margins — still a tie, margin never matters once busted'],
  [0, false, 0, false, 'tie', 'both empty/zero sums, both safe, exact tie'],
];

let failures = 0;
for (const [humanSum, humanBusted, botSum, botBusted, expected, label] of cases) {
  const actual = decideWinner(humanSum, humanBusted, botSum, botBusted, TARGET);
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} decideWinner(${humanSum}, ${humanBusted}, ${botSum}, ${botBusted}, ${TARGET}) === '${expected}'  (${label})${pass ? '' : ` — got '${actual}'`}`);
}

if (failures > 0) {
  console.error(`\n  ${failures}/${cases.length} case(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log(`\n  all ${cases.length} decideWinner cases passed (pop-perimeter.html)`);
}
