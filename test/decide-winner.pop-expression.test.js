/*
 * Standalone unit test for pop-expression.html's decideWinner AND
 * isBusted. No browser, no jsdom — both are pure. Same shape as
 * Subtraction Pop's tests (same two-cause bust rule), but the sums here
 * come from a real 3-term expression, not 2.
 */

'use strict';

const assert = require('assert');
const { loadPage } = require('./vm-load-page');

const page = loadPage('pop-expression.html');
const { decideWinner, isBusted } = page;
assert.strictEqual(typeof decideWinner, 'function', 'decideWinner should be defined as a top-level function');
assert.strictEqual(typeof isBusted, 'function', 'isBusted should be defined as a top-level function');

let failures = 0;
function check(label, actual, expected) {
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} ${label} === ${JSON.stringify(expected)}${pass ? '' : ` — got ${JSON.stringify(actual)}`}`);
}

const TARGET = 100;

check(`isBusted(-1, ${TARGET}) [a negative expression result must bust]`, isBusted(-1, TARGET), true);
check(`isBusted(0, ${TARGET}) [exactly zero is not negative]`, isBusted(0, TARGET), false);
check(`isBusted(${TARGET}, ${TARGET}) [landing exactly on target is safe]`, isBusted(TARGET, TARGET), false);
check(`isBusted(${TARGET + 1}, ${TARGET}) [one over target busts]`, isBusted(TARGET + 1, TARGET), true);

const cases = [
  [80, false, 60, false, 'human', 'both safe: human is closer to target'],
  [60, false, 80, false, 'bot', 'both safe: bot is closer to target'],
  [80, false, 80, false, 'tie', 'both safe, exact same sum'],
  [100, false, 80, false, 'human', 'human lands exactly on target, beats a safe-but-lower bot'],
  [110, true, 60, false, 'bot', 'human busted (over target), bot safe: bot wins outright'],
  [60, false, 110, true, 'human', 'bot busted (over target), human safe: human wins outright'],
  [-5, true, 60, false, 'bot', 'human busted (negative expression), bot safe: bot wins outright'],
  [60, false, -5, true, 'human', 'bot busted (negative expression), human safe: human wins outright'],
  [110, true, 200, true, 'tie', 'both busted (both over target): friendly tie'],
  [-5, true, -20, true, 'tie', 'both busted (both negative): friendly tie, margin never matters once busted'],
  [0, false, 0, false, 'tie', 'both an exact zero result, safe, exact tie'],
];

for (const [humanSum, humanBusted, botSum, botBusted, expected, label] of cases) {
  const actual = decideWinner(humanSum, humanBusted, botSum, botBusted, TARGET);
  check(`decideWinner(${humanSum}, ${humanBusted}, ${botSum}, ${botBusted}, ${TARGET})  (${label})`, actual, expected);
}

if (failures > 0) {
  console.error(`\n  ${failures} case(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log(`\n  all decideWinner/isBusted cases passed (pop-expression.html)`);
}
