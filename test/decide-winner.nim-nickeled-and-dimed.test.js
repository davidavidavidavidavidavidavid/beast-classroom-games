/*
 * Standalone unit test for nim-nickeled-and-dimed.html's decideWinner.
 * No browser, no jsdom — decideWinner is pure, same convention as every
 * other game's (see CLAUDE.md Code conventions).
 *
 * The interesting edge cases here are NOT the same as base Nim's own test
 * (test/decide-winner.nim.test.js) — that's the whole point. Base Nim's
 * win condition is "reach OR EXCEED the target" (overshoot still wins).
 * This variant's real rule is "reach EXACTLY 50¢" — overshoot is not a
 * win, and per the design (see CLAUDE.md's design note), overshoot should
 * never even be reachable in play since only legal, non-overshooting
 * moves are ever offered. decideWinner itself still has to be correct
 * defensively even for an input it should never actually receive in a
 * real game, since it's a pure function with no knowledge of how it's
 * called — see the "overshoot" cases below.
 */

'use strict';

const assert = require('assert');
const { loadPage } = require('./vm-load-page');

const page = loadPage('nim-nickeled-and-dimed.html');
const { decideWinner } = page;
assert.strictEqual(typeof decideWinner, 'function', 'decideWinner should be defined as a top-level function');

// `const TARGET` is a lexical binding, not exposed as page.TARGET — mirror
// the value directly (matches nim-nickeled-and-dimed.html's own TARGET = 50).
const TARGET = 50;

let failures = 0;
function check(label, total, mover, expected) {
  const actual = decideWinner(total, mover);
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} decideWinner(${total}, ${JSON.stringify(mover)})  (${label}) === ${JSON.stringify(expected)}${pass ? '' : ` — got ${JSON.stringify(actual)}`}`);
}

check('well under target: round still in progress', 0, 'human', null);
check('one nickel below target: still in progress, not a win', TARGET - 5, 'bot', null);
check('lands exactly on target: a win', TARGET, 'human', 'human');
check('whoever is passed as mover wins, regardless of which side', TARGET, 'bot', 'bot');

// The critical difference from base Nim: overshoot is NOT a win here. In
// real play this total should never actually occur (the legal-move
// filtering in nimLegalMoves prevents any move that would overshoot — see
// the bot-simulation script's own termination check), but decideWinner is
// a pure function with no knowledge of that upstream guarantee, so it must
// still get this right on its own terms rather than silently inheriting
// base Nim's "overshoot still wins" behavior by copy-paste.
check('overshoots by a nickel: NOT a win (unlike base Nim) — should never actually occur in play, but decideWinner must still be correct standalone', TARGET + 5, 'human', null);
check('overshoots by a dime: still not a win', TARGET + 10, 'bot', null);
check('far past target: still not a win, no upper bound makes it "close enough"', TARGET + 25, 'human', null);

if (failures > 0) {
  console.error(`\n  ${failures} case(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log('\n  all decideWinner cases passed (nim-nickeled-and-dimed.html) — confirmed exact-match-only win condition, no tie case (same as base Nim, the total only ever increases)');
}
