/*
 * Standalone unit tests for numbo-operations.html's pure logic: no browser,
 * no jsdom. Three separate pure pieces get exercised here, matching
 * CLAUDE.md Code conventions (decideWinner) plus this game's own two
 * extra pure helpers its unusual scoring rule needed:
 *   - decideWinner(humanValue, botValue, target) — the ROUND-level
 *     closest-wins comparison (the fixed contract every game has).
 *   - matchWinnerFromScore(score) — the MATCH-level "first to 5" check,
 *     kept separate from decideWinner since its job is genuinely
 *     different (a running score threshold, not a single comparison).
 *   - applyRoundScore(score, winner) — verifies the real rule ("on a tie,
 *     BOTH players get a point") actually increments both sides, unlike
 *     every other game's tie handling.
 *   - tryParseAndValidate(str, digits) — the expression parser/validator,
 *     covering the failure modes that matter most: concatenation, wrong
 *     digit multiset, divide-by-zero, syntax errors, and operator
 *     precedence actually being respected.
 */

'use strict';

const assert = require('assert');
const { loadPage } = require('./vm-load-page');

const page = loadPage('numbo-operations.html');
const { decideWinner, matchWinnerFromScore, applyRoundScore, tryParseAndValidate, exprString } = page;
['decideWinner', 'matchWinnerFromScore', 'applyRoundScore', 'tryParseAndValidate', 'exprString'].forEach(name => {
  assert.strictEqual(typeof page[name], 'function', `${name} should be defined as a top-level function`);
});

let failures = 0;
function check(label, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} ${label}${pass ? '' : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
}

/* ---------------- decideWinner (round-level) ---------------- */
check('human strictly closer wins the round', decideWinner(48, 40, 50), 'human');
check('bot strictly closer wins the round', decideWinner(40, 48, 50), 'bot');
check('exact same distance is a tie', decideWinner(45, 55, 50), 'tie');
check('both land exactly on target is a tie', decideWinner(50, 50, 50), 'tie');
check('a negative (subtraction) result is just a distance from target, same as a positive one', decideWinner(-3, 3, 0), 'tie'); // both distance 3
check('negative result strictly closer than a positive one', decideWinner(-1, 5, 0), 'human');
// Floating-point near-tie (mirrors the classic 3,3,8,8->24 case landing at
// 23.99999999999999, not exactly 24 — see CLAUDE.md Known traps): within
// EPS should still read as an exact tie against a value that lands exactly
// on target.
check('a value within float-noise of an exact hit still counts as tying an exact hit', decideWinner(24, 23.99999999999999, 24), 'tie');

/* ---------------- matchWinnerFromScore (match-level "first to 5") ---------------- */
check('neither side at 5 yet: match still in progress', matchWinnerFromScore({ human: 3, bot: 4 }), null);
check('human alone reaches 5: human wins the match', matchWinnerFromScore({ human: 5, bot: 3 }), 'human');
check('bot alone reaches 5: bot wins the match', matchWinnerFromScore({ human: 2, bot: 5 }), 'bot');
check('human is past 5 (overshoot from a big lead) still wins', matchWinnerFromScore({ human: 6, bot: 2 }), 'human');
check('BOTH reach 5 at once (a tie round pushed both from 4->5 simultaneously) is a genuine match tie', matchWinnerFromScore({ human: 5, bot: 5 }), 'tie');

/* ---------------- applyRoundScore (the real, non-standard tie rule) ---------------- */
{
  const score = { human: 2, bot: 2 };
  applyRoundScore(score, 'human');
  check('a human round-win increments ONLY human', score, { human: 3, bot: 2 });
}
{
  const score = { human: 2, bot: 2 };
  applyRoundScore(score, 'bot');
  check('a bot round-win increments ONLY bot', score, { human: 2, bot: 3 });
}
{
  const score = { human: 2, bot: 2 };
  applyRoundScore(score, 'tie');
  check("a tie round increments BOTH scores — the real rule (\"all players who were closest get a point\"), not a neither-scores tie bucket like every other game", score, { human: 3, bot: 3 });
}

/* ---------------- tryParseAndValidate (parser + digit/div-by-zero rules) ---------------- */
function parseCheck(label, str, digits, expectOk, expectValue) {
  const r = tryParseAndValidate(str, digits);
  const pass = r.ok === expectOk && (!expectOk || Math.abs(r.value - expectValue) < 1e-9);
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} ${label}: tryParseAndValidate("${str}", [${digits}]) -> ${JSON.stringify(r)}`);
}

parseCheck('explicit parens override precedence', '(7-3)*8+2', [7, 3, 8, 2], true, 34);
parseCheck('implicit standard precedence (* before +/-)', '7-3*8+2', [7, 3, 8, 2], true, 7 - 3 * 8 + 2);
parseCheck('duplicate rolled digit usable twice, matches exactly', '3+3+7+2', [3, 3, 7, 2], true, 15);
parseCheck('concatenating two digits into "37" is rejected, not silently allowed', '37+2', [3, 7, 2], false, null);
parseCheck('using fewer digits than rolled is rejected', '3+7', [3, 7, 2], false, null);
parseCheck('using a digit not actually rolled is rejected', '3+7+9', [3, 7, 2], false, null);
parseCheck('reusing a digit more times than it was rolled is rejected (only one 3 rolled)', '3+3+7+2', [3, 7, 2, 2], false, null);
parseCheck('division by zero anywhere is rejected, not just at the top level', '3/(7-7)+2', [3, 7, 7, 2], false, null);
parseCheck('an expression can\'t start with an operator', '+3-7', [3, 7], false, null);
parseCheck('unbalanced parentheses are rejected', '(3+7', [3, 7], false, null);
parseCheck('a stray character is rejected', '3+7a', [3, 7], false, null);

/* ---------------- exprString (used for both the bot's display and the
   human's own-expression hint — see numbo-operations.html's checkAnswer()) ---------------- */
{
  const r = tryParseAndValidate('7-3*8+2', [7, 3, 8, 2]);
  check('exprString fully parenthesizes to show the REAL interpreted structure (catches order-of-operations mistakes)', exprString(r.tree), '((7 - (3 * 8)) + 2)');
}

if (failures > 0) {
  console.error(`\n  ${failures} case(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log(`\n  all cases passed (numbo-operations.html)`);
}
