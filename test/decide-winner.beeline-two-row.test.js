/*
 * Standalone unit test for every TWO-ROW Beeline variant's decideWinner —
 * beeline-difference.html, beeline-addition.html, beeline-decimal.html,
 * beeline-rounding.html, beeline-equivalent-fraction.html. Each file's own
 * `decideWinner` is a thin one-line wrapper around shared-game.js's
 * `beelineDecideWinner` (see CLAUDE.md Code conventions and shared-game.js's
 * own "Beeline two-row engine" comment for why the win-detection logic
 * itself is centralized, not re-derived per file) — the SAME board-state
 * cases from test/decide-winner.beeline-product.test.js apply unchanged to
 * every one of them, since none of it depends on what a "move" or "value"
 * means, only on `owner`/grid geometry. This test confirms each file's own
 * wrapper is actually wired up correctly, not just that the shared function
 * itself works (already covered by beeline-product's own test).
 */

'use strict';

const assert = require('assert');
const { loadPage } = require('./vm-load-page');

const FILES = [
  'beeline-difference.html',
  'beeline-addition.html',
  'beeline-decimal.html',
  'beeline-rounding.html',
  'beeline-equivalent-fraction.html',
];

function emptyBoard() { return Array(36).fill(null); }

let failures = 0;
function check(file, label, owner, expected, decideWinner) {
  const actual = decideWinner(owner);
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} [${file}] ${label}: decideWinner(...) === ${JSON.stringify(expected)}${pass ? '' : ` — got ${JSON.stringify(actual)}`}`);
}

FILES.forEach(file => {
  const page = loadPage(file);
  const { decideWinner } = page;
  assert.strictEqual(typeof decideWinner, 'function', `${file}: decideWinner should be defined as a top-level function`);

  {
    const owner = emptyBoard();
    [0, 1, 2, 3].forEach(i => owner[i] = 'human');
    check(file, 'horizontal human win', owner, 'human', decideWinner);
  }
  {
    const owner = emptyBoard();
    [2, 8, 14, 20].forEach(i => owner[i] = 'bot');
    check(file, 'vertical bot win', owner, 'bot', decideWinner);
  }
  {
    const owner = emptyBoard();
    [0, 7, 14, 21].forEach(i => owner[i] = 'human');
    check(file, 'diagonal (down-right) human win', owner, 'human', decideWinner);
  }
  {
    const owner = emptyBoard();
    [5, 10, 15, 20].forEach(i => owner[i] = 'bot');
    check(file, 'anti-diagonal (down-left) bot win', owner, 'bot', decideWinner);
  }
  {
    const owner = emptyBoard();
    [0, 1, 2].forEach(i => owner[i] = 'human');
    check(file, '3-in-a-row is not a win, game still in progress', owner, null, decideWinner);
  }
  check(file, 'empty board is still in progress', emptyBoard(), null, decideWinner);
  {
    const owner = ["human","human","bot","bot","human","human","bot","bot","human","human","bot","bot","human","human","bot","bot","human","human","bot","bot","human","human","bot","bot","human","human","bot","bot","human","human","bot","bot","human","human","bot","bot"];
    check(file, 'full board, no line for either side -> tie', owner, 'tie', decideWinner);
  }
});

if (failures > 0) {
  console.error(`\n  ${failures} case(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log(`\n  all decideWinner cases passed for every two-row Beeline variant`);
}
