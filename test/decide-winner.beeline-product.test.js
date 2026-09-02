/*
 * Standalone unit test for beeline-product.html's decideWinner.
 * No browser, no jsdom — decideWinner is pure. Unlike Scuttle/Pop, this
 * takes a full 36-cell board (not two numeric totals), so cases here are
 * hand-built board layouts covering each of the 4 win directions, a full
 * board with no winner (tie), and mid-game (no winner yet).
 */

'use strict';

const assert = require('assert');
const { loadPage } = require('./vm-load-page');

const page = loadPage('beeline-product.html');
const { decideWinner } = page;
assert.strictEqual(typeof decideWinner, 'function', 'decideWinner should be defined as a top-level function');

function emptyBoard() { return Array(36).fill(null); }

let failures = 0;
function check(label, owner, expected) {
  const actual = decideWinner(owner);
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} ${label}: decideWinner(...) === ${JSON.stringify(expected)}${pass ? '' : ` — got ${JSON.stringify(actual)}`}`);
}

// Horizontal: row 0, cols 0-3 (indices 0,1,2,3)
{
  const owner = emptyBoard();
  [0, 1, 2, 3].forEach(i => owner[i] = 'human');
  check('horizontal human win', owner, 'human');
}

// Vertical: col 2, rows 0-3 (indices 2, 8, 14, 20)
{
  const owner = emptyBoard();
  [2, 8, 14, 20].forEach(i => owner[i] = 'bot');
  check('vertical bot win', owner, 'bot');
}

// Diagonal (down-right): (0,0),(1,1),(2,2),(3,3) -> indices 0,7,14,21
{
  const owner = emptyBoard();
  [0, 7, 14, 21].forEach(i => owner[i] = 'human');
  check('diagonal (down-right) human win', owner, 'human');
}

// Anti-diagonal (down-left): (0,5),(1,4),(2,3),(3,2) -> indices 5,10,15,20
{
  const owner = emptyBoard();
  [5, 10, 15, 20].forEach(i => owner[i] = 'bot');
  check('anti-diagonal (down-left) bot win', owner, 'bot');
}

// Only 3 in a row: not a win yet, board not full -> still in progress (null)
{
  const owner = emptyBoard();
  [0, 1, 2].forEach(i => owner[i] = 'human');
  check('3-in-a-row is not a win, game still in progress', owner, null);
}

// Empty board: definitely still in progress
check('empty board is still in progress', emptyBoard(), null);

// Full board, verified (via the game's own hasFourInRow logic, offline) to
// contain no 4-in-a-row for either symbol -> a tie, not a crash or a
// false winner.
{
  const owner = ["human","human","bot","bot","human","human","bot","bot","human","human","bot","bot","human","human","bot","bot","human","human","bot","bot","human","human","bot","bot","human","human","bot","bot","human","human","bot","bot","human","human","bot","bot"];
  check('full board, no line for either side -> tie', owner, 'tie');
}

if (failures > 0) {
  console.error(`\n  ${failures} case(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log(`\n  all decideWinner cases passed (beeline-product.html)`);
}
