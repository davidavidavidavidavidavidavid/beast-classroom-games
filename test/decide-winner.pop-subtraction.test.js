/*
 * Standalone unit test for pop-subtraction.html's decideWinner AND
 * isBusted. No browser, no jsdom — both are pure.
 *
 * Busting has two distinct causes for this variant (unlike Addition Pop):
 * going over the target, OR the difference itself coming out negative —
 * per the real Teacher Instructions doc, both are an outright pop. That
 * logic lives in isBusted(), which decideWinner's callers are responsible
 * for computing correctly before calling decideWinner — decideWinner
 * itself just trusts whatever busted flags it's given, so it's tested
 * separately from isBusted here.
 */

'use strict';

const assert = require('assert');
const { loadPage } = require('./vm-load-page');

const page = loadPage('pop-subtraction.html');
const { decideWinner, isBusted } = page;
assert.strictEqual(typeof decideWinner, 'function', 'decideWinner should be defined as a top-level function');
assert.strictEqual(typeof isBusted, 'function', 'isBusted should be defined as a top-level function');

let failures = 0;
function check(label, actual, expected) {
  const pass = actual === expected;
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} ${label} === ${JSON.stringify(expected)}${pass ? '' : ` — got ${JSON.stringify(actual)}`}`);
}

const TARGET = 40;

/* ---------------- isBusted: the actual locus of the real bug ---------------- */
check(`isBusted(-1, ${TARGET}) [a negative difference must bust, not just read as "far below target"]`, isBusted(-1, TARGET), true);
check(`isBusted(-89, ${TARGET}) [a very negative difference still just busts, not a worse kind of loss]`, isBusted(-89, TARGET), true);
check(`isBusted(0, ${TARGET}) [exactly zero is not negative]`, isBusted(0, TARGET), false);
check(`isBusted(${TARGET}, ${TARGET}) [landing exactly on target is safe]`, isBusted(TARGET, TARGET), false);
check(`isBusted(${TARGET + 1}, ${TARGET}) [one over target busts, same as before this fix]`, isBusted(TARGET + 1, TARGET), true);
check(`isBusted(1, ${TARGET}) [a small positive, safely under target]`, isBusted(1, TARGET), false);

/* ---------------- decideWinner: given correctly-computed busted flags ---------------- */
const cases = [
  [35, false, 30, false, 'human', 'both safe: human is closer to target'],
  [30, false, 35, false, 'bot', 'both safe: bot is closer to target'],
  [35, false, 35, false, 'tie', 'both safe, exact same sum'],
  [40, false, 35, false, 'human', 'human lands exactly on target, beats a safe-but-lower bot'],
  [45, true, 30, false, 'bot', 'human busted (over target), bot safe: bot wins outright regardless of margin'],
  [30, false, 45, true, 'human', 'bot busted (over target), human safe: human wins outright regardless of margin'],
  [-5, true, 30, false, 'bot', 'human busted (negative difference), bot safe: bot wins outright regardless of margin'],
  [30, false, -5, true, 'human', 'bot busted (negative difference), human safe: human wins outright regardless of margin'],
  [45, true, 90, true, 'tie', 'both busted (both over target): friendly tie'],
  [-5, true, -20, true, 'tie', 'both busted (both negative): friendly tie, margin never matters once busted'],
  [45, true, -5, true, 'tie', 'both busted, one over target and one negative: still a friendly tie either way'],
  [0, false, 0, false, 'tie', 'both an exact zero difference, safe, exact tie'],
];

for (const [humanSum, humanBusted, botSum, botBusted, expected, label] of cases) {
  const actual = decideWinner(humanSum, humanBusted, botSum, botBusted, TARGET);
  check(`decideWinner(${humanSum}, ${humanBusted}, ${botSum}, ${botBusted}, ${TARGET})  (${label})`, actual, expected);
}

if (failures > 0) {
  console.error(`\n  ${failures} case(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log(`\n  all decideWinner/isBusted cases passed (pop-subtraction.html)`);
}
