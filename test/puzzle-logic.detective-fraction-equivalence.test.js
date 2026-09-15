/*
 * Standalone unit tests for detective-fraction-equivalence.html's pure
 * logic. No browser, no jsdom.
 *
 * Detective is single-player — there's no decideWinner (no opponent to
 * compare against), so this isn't named `decide-winner.*` like every other
 * game's unit test file. `puzzle-logic.*` is the equivalent naming for a
 * single-player puzzle game (see CLAUDE.md Code conventions) — covering
 * the generator's structural invariants (generatePuzzle is randomized, so
 * these are invariant checks across many trials per level, not fixed
 * expected values) and the Wordle-coloring algorithm's known cases.
 */

'use strict';

const assert = require('assert');
const { loadPage } = require('./vm-load-page');

const page = loadPage('detective-fraction-equivalence.html');
const { gcd, generatePuzzle, colorDigits, flattenDigits, arraysEqual, LEVELS } = page;
['gcd', 'generatePuzzle', 'colorDigits', 'flattenDigits', 'arraysEqual'].forEach(name => {
  assert.strictEqual(typeof page[name], 'function', `${name} should be defined as a top-level function`);
});
// LEVELS is declared with `const` — not exposed as a page property, same
// vm-load-page.js limitation documented for Nim's TARGET (see CLAUDE.md
// Known traps). Mirror the table directly rather than reading it off page.
const LEVEL_SHAPE = {
  1: { improper: false, mustSimplified: true,  factorsOnly: true  },
  2: { improper: false, mustSimplified: true,  factorsOnly: true  },
  3: { improper: false, mustSimplified: false, factorsOnly: true  },
  4: { improper: true,  mustSimplified: false, factorsOnly: true  },
  5: { improper: true,  mustSimplified: false, factorsOnly: false },
  6: { improper: true,  mustSimplified: false, factorsOnly: false },
};

let failures = 0;
function check(label, pass, detail) {
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} ${label}${pass || !detail ? '' : ` — ${detail}`}`);
}

/* ---------------- gcd ---------------- */
check('gcd(12, 18) === 6', gcd(12, 18) === 6);
check('gcd(7, 13) === 1 (coprime)', gcd(7, 13) === 1);
check('gcd(5, 0) === 5', gcd(5, 0) === 5);

/* ---------------- colorDigits — known Wordle cases ---------------- */
check('all correct', JSON.stringify(colorDigits(['1','2'], ['1','2'])) === JSON.stringify(['correct','correct']));
check('all absent', JSON.stringify(colorDigits(['3','4'], ['1','2'])) === JSON.stringify(['absent','absent']));
check('wrong position', JSON.stringify(colorDigits(['2','1'], ['1','2'])) === JSON.stringify(['wrong-pos','wrong-pos']));
// Duplicate-digit edge case (the classic Wordle subtlety): target has ONE
// '5', guess has TWO — only one of the guess's 5s should get credit
// (correct or wrong-pos), the extra must be 'absent', never double-counted.
{
  const colors = colorDigits(['5','5','1'], ['5','2','3']); // target: 5,2,3 (one 5, at position 0)
  check('duplicate digit in guess beyond what target has: only one credited, extra is absent',
    colors[0] === 'correct' && colors[1] === 'absent' && colors[2] === 'absent',
    JSON.stringify(colors));
}
{
  // Same idea, but the guess's extra copy could have been a wrong-pos match
  // instead — confirm it still isn't double-counted once the single
  // available target '5' is consumed by the first pass.
  const colors = colorDigits(['1','5','5'], ['5','2','3']); // target has one 5, at position 0; guess has 5s at 1 and 2
  check('a target digit is only ever matched once across a whole guess, even flattened across multiple parts',
    colors[0] === 'absent' && colors.filter(c => c === 'wrong-pos').length === 1 && colors.filter(c => c === 'absent').length === 2,
    JSON.stringify(colors));
}

/* ---------------- flattenDigits / arraysEqual ---------------- */
check('flattenDigits flattens multi-digit parts into single characters', JSON.stringify(flattenDigits([12, 3, 45, 6])) === JSON.stringify(['1','2','3','4','5','6']));
check('arraysEqual true case', arraysEqual([1,2,3], [1,2,3]) === true);
check('arraysEqual false case (different value)', arraysEqual([1,2,3], [1,2,4]) === false);
check('arraysEqual false case (different length)', arraysEqual([1,2], [1,2,3]) === false);

/* ---------------- generatePuzzle — structural invariants per level ----------------
   generatePuzzle is randomized (rejection sampling) — these check
   invariants that must hold for EVERY generated puzzle at a given level,
   across many trials, not fixed expected values (which would be
   meaningless for a random generator). */
const TRIALS_PER_LEVEL = 300;
for (let lvNum = 1; lvNum <= 6; lvNum++) {
  const shape = LEVEL_SHAPE[lvNum];
  let allOk = true;
  let detail = '';
  for (let i = 0; i < TRIALS_PER_LEVEL; i++) {
    const puzzle = generatePuzzle(lvNum);
    const { parts, meta } = puzzle;
    const [n1, d1, n2, d2] = parts;

    if (parts.some(v => v < 1 || v > 99)) { allOk = false; detail = `L${lvNum}: a part outside [1,99]: ${parts}`; break; }
    if (lvNum === 1 && parts.some(v => v > 9)) { allOk = false; detail = `L1: a part >9 (should be single-digit): ${parts}`; break; }
    if (n1 * d2 !== n2 * d1) { allOk = false; detail = `L${lvNum}: generator produced an invalid equation: ${parts}`; break; }
    if (meta.bN === meta.bD) { allOk = false; detail = `L${lvNum}: base fraction not reduced to lowest terms distinctly (bN===bD)`; break; }
    if (gcd(meta.bN, meta.bD) !== 1) { allOk = false; detail = `L${lvNum}: base fraction bN/bD isn't fully reduced: ${meta.bN}/${meta.bD}`; break; }
    if (meta.k1 < 1 || meta.k2 <= meta.k1) { allOk = false; detail = `L${lvNum}: k1<1 or k2<=k1: k1=${meta.k1} k2=${meta.k2}`; break; }
    if (shape.mustSimplified && meta.k1 !== 1) { allOk = false; detail = `L${lvNum} (mustSimplified): k1 should be exactly 1, got ${meta.k1}`; break; }
    if (shape.factorsOnly && meta.k2 % meta.k1 !== 0) { allOk = false; detail = `L${lvNum} (factorsOnly): k1=${meta.k1} should divide k2=${meta.k2}`; break; }
    if (!shape.improper && meta.bN >= meta.bD) { allOk = false; detail = `L${lvNum} (proper-only): base fraction should be proper (bN<bD), got ${meta.bN}/${meta.bD}`; break; }
    // The equivalence relation the puzzle itself declares must actually
    // hold for its own target (the target trivially "equals itself").
    if (!puzzle.equivalentOrderings(parts).some(arr => arraysEqual(parts, arr))) { allOk = false; detail = `L${lvNum}: puzzle's own target isn't in its own equivalentOrderings`; break; }
    if (!puzzle.isValidGuess(parts)) { allOk = false; detail = `L${lvNum}: puzzle's own target fails its own isValidGuess`; break; }
  }
  check(`generatePuzzle(${lvNum}) satisfies Level ${lvNum}'s constraints across ${TRIALS_PER_LEVEL} trials`, allOk, detail);
}

/* ---------------- getRoundLevel progression (mirrors the table directly —
   it's a `function`, so it IS exposed on `page`, unlike LEVELS/const) ---------------- */
{
  const { getRoundLevel } = page;
  const cases = [[1,1],[3,1],[4,2],[7,2],[8,3],[12,3],[13,4],[17,4],[18,5],[23,5],[24,6],[100,6]];
  const allMatch = cases.every(([round, expected]) => getRoundLevel(round) === expected);
  check('getRoundLevel matches every round-threshold boundary exactly', allMatch, JSON.stringify(cases.map(([r]) => [r, getRoundLevel(r)])));
}

if (failures > 0) {
  console.error(`\n  ${failures} case(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log(`\n  all cases passed (detective-fraction-equivalence.html)`);
}
