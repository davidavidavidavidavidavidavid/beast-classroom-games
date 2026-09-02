/*
 * Standalone unit test for pop-addition.html's decideWinner.
 * No browser, no jsdom — decideWinner is pure. Covers bust vs bust vs
 * safe-comparison combinations, per CLAUDE.md Testing methodology point 4.
 */

'use strict';

const assert = require('assert');
const { loadPage } = require('./vm-load-page');

const page = loadPage('pop-addition.html');
const { decideWinner } = page;
assert.strictEqual(typeof decideWinner, 'function', 'decideWinner should be defined as a top-level function');

const TARGET = 50;
const cases = [
  // [humanSum, humanBusted, botSum, botBusted, expected, label]
  [45, false, 40, false, 'human', 'both safe: human is closer to target'],
  [40, false, 45, false, 'bot', 'both safe: bot is closer to target'],
  [45, false, 45, false, 'tie', 'both safe, exact same sum'],
  [50, false, 45, false, 'human', 'human lands exactly on target, beats a safe-but-lower bot'],
  [55, true, 40, false, 'bot', 'human busted, bot safe: bot wins outright regardless of margin'],
  [40, false, 55, true, 'human', 'bot busted, human safe: human wins outright regardless of margin'],
  [55, true, 90, true, 'tie', 'both busted: friendly tie (not covered by source rules as a comparison, so treated as a tie)'],
  [51, true, 99, true, 'tie', 'both busted by very different margins — still a tie, margin never matters once busted'],
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
  console.log(`\n  all ${cases.length} decideWinner cases passed (pop-addition.html)`);
}
