/*
 * Standalone unit test for nim-subtraction.html's decideWinner.
 * No browser, no jsdom — decideWinner is pure, same convention as every
 * other game's (see CLAUDE.md Code conventions).
 *
 * This variant counts DOWN to 0 (not up to a positive target like base Nim
 * or Nickeled & Dimed) — landing exactly on an empty pile (0) wins.
 * Overshoot here would mean a negative total, which nimLegalMoves'
 * reachOrExceed=false already prevents from ever being reachable in real
 * play (you can't remove more tokens than remain) — decideWinner still has
 * to be correct defensively even for an input it should never actually
 * receive, since it's a pure function with no knowledge of how it's called.
 */

'use strict';

const assert = require('assert');
const { loadPage } = require('./vm-load-page');

const page = loadPage('nim-subtraction.html');
const { decideWinner } = page;
assert.strictEqual(typeof decideWinner, 'function', 'decideWinner should be defined as a top-level function');

// `const TARGET`/`PILE_START` are lexical bindings, not exposed as
// page.TARGET — mirror the values directly (matches nim-subtraction.html's
// own TARGET = 0, PILE_START = 20; see CLAUDE.md Known Traps on
// vm-load-page.js not exposing top-level const/let).
const TARGET = 0;
const PILE_START = 20;

let failures = 0;
function check(label, total, mover, expected) {
  const actual = decideWinner(total, mover);
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} decideWinner(${total}, ${JSON.stringify(mover)})  (${label}) === ${JSON.stringify(expected)}${pass ? '' : ` — got ${JSON.stringify(actual)}`}`);
}

check('a fresh, full pile: round still in progress', PILE_START, 'human', null);
check('one token left: still in progress, not a win', 1, 'bot', null);
check('lands exactly on an empty pile: a win', TARGET, 'human', 'human');
check('whoever is passed as mover wins, regardless of which side', TARGET, 'bot', 'bot');

// Overshoot (a negative pile) should never actually occur in play — see the
// file header — but decideWinner is a pure function with no knowledge of
// that upstream guarantee, so it must still get this right on its own
// terms rather than silently treating "close to 0" as good enough.
check('overshoots below empty by 1: NOT a win — should never actually occur in play, but decideWinner must still be correct standalone', -1, 'human', null);
check('overshoots below empty by 3: still not a win', -3, 'bot', null);
check('far below empty: still not a win, no lower bound makes it "close enough"', -15, 'human', null);

if (failures > 0) {
  console.error(`\n  ${failures} case(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log('\n  all decideWinner cases passed (nim-subtraction.html) — confirmed exact-empty-pile-only win condition, no tie case (same as every other Nim variant, the total only ever moves toward 0)');
}
