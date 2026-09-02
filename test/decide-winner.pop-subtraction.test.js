/*
 * Standalone unit test for pop-subtraction.html's decideWinner.
 * No browser, no jsdom — decideWinner is pure. Same shape as Addition
 * Pop's, but exercises negative sums too (the case that's actually new
 * for this variant, since a difference can go below zero).
 */

'use strict';

const assert = require('assert');
const { loadPage } = require('./vm-load-page');

const page = loadPage('pop-subtraction.html');
const { decideWinner } = page;
assert.strictEqual(typeof decideWinner, 'function', 'decideWinner should be defined as a top-level function');

const TARGET = 40;
const cases = [
  [35, false, 30, false, 'human', 'both safe: human is closer to target'],
  [30, false, 35, false, 'bot', 'both safe: bot is closer to target'],
  [35, false, 35, false, 'tie', 'both safe, exact same sum'],
  [40, false, 35, false, 'human', 'human lands exactly on target, beats a safe-but-lower bot'],
  [45, true, 30, false, 'bot', 'human busted, bot safe: bot wins outright regardless of margin'],
  [30, false, 45, true, 'human', 'bot busted, human safe: human wins outright regardless of margin'],
  [45, true, 90, true, 'tie', 'both busted: friendly tie'],
  [-50, false, 30, false, 'bot', 'human has a very negative difference (far below target), bot is much closer and still safe'],
  [-10, false, -30, false, 'human', 'both negative differences: -10 is closer to target 40 than -30'],
  [0, false, 0, false, 'tie', 'both an exact zero difference, safe, exact tie'],
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
  console.log(`\n  all ${cases.length} decideWinner cases passed (pop-subtraction.html)`);
}
