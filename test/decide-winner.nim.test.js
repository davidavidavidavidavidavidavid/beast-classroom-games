/*
 * Standalone unit test for nim.html's decideWinner.
 * No browser, no jsdom — decideWinner is pure. Unlike every other game's
 * decideWinner (which compares two competing totals, or a board), Nim's
 * takes a single running total and whoever just moved — the interesting
 * edge cases here are entirely about the TARGET boundary (just under,
 * exactly on, and over), plus confirming there is genuinely no 'tie'
 * outcome anywhere (the total only ever increases, so a tie can't happen —
 * see CLAUDE.md's Nim section).
 */

'use strict';

const assert = require('assert');
const { loadPage } = require('./vm-load-page');

const page = loadPage('nim.html');
const { decideWinner } = page;
assert.strictEqual(typeof decideWinner, 'function', 'decideWinner should be defined as a top-level function');

// `const TARGET` in nim.html is a lexical (not global-object) binding, so
// vm-load-page.js's sandbox doesn't expose it as page.TARGET the way a
// `function` declaration attaches — mirror the value directly (matches
// nim.html's own TARGET = 10) rather than trying to pull it off `page`.
const TARGET = 10;

let failures = 0;
function check(label, total, mover, expected) {
  const actual = decideWinner(total, mover);
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} decideWinner(${total}, ${JSON.stringify(mover)})  (${label}) === ${JSON.stringify(expected)}${pass ? '' : ` — got ${JSON.stringify(actual)}`}`);
}

check('well under target: round still in progress', 0, 'human', null);
check('one below target: still in progress, not a win', TARGET - 1, 'bot', null);
check('lands exactly on target: a win', TARGET, 'human', 'human');
check('overshoots the target by 1: still a win, not busted or ignored', TARGET + 1, 'bot', 'bot');
check('overshoots by more than the max single move: still just a win', TARGET + 5, 'human', 'human');
check('whoever is passed as mover wins, regardless of which side', TARGET, 'bot', 'bot');

if (failures > 0) {
  console.error(`\n  ${failures} case(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log(`\n  all decideWinner cases passed (nim.html) — note there is no 'tie' case: this game cannot draw`);
}
