/*
 * Lightning — pure-logic tests for the drill's question generators.
 *
 * Named `puzzle-logic.*` per CLAUDE.md Code conventions: Lightning is
 * single-player, so there is no decideWinner to test and the
 * `decide-winner.*` name would be dishonest.
 *
 * The generators are RANDOMIZED, so per Testing methodology point 13 these
 * assert STRUCTURAL INVARIANTS across many trials rather than fixed
 * expected outputs — every generated question is in range, its stated
 * answer is arithmetically correct, and (for the multi-step variant) no
 * intermediate or final value goes negative.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage } = require('./jsdom-helpers');

let failures = 0;
function check(label, pass, detail) {
  if (!pass) failures++;
  console.log(`  ${pass ? '✅' : '❌'} ${label}${pass || !detail ? '' : ` — ${detail}`}`);
}

const TRIALS = 400;

/* ---------------- multiplication facts ---------------- */
{
  const dom = loadGame('lightning-multiplication.html');
  Object.entries({ '1-9': [1, 9], '2-9': [2, 9], '6-9': [6, 9] }).forEach(([range, [lo, hi]]) => {
    const r = runInPage(dom, (rangeKey, n) => {
      st.range = rangeKey;
      const bad = [];
      const seenOperands = new Set();
      for (let i = 0; i < n; i++) {
        const q = LIGHTNING_SPEC.generate();
        const m = q.prompt.match(/^(\d+) × (\d+)$/);
        if (!m) { bad.push('unparseable: ' + q.prompt); continue; }
        const a = Number(m[1]), b = Number(m[2]);
        seenOperands.add(a); seenOperands.add(b);
        if (a * b !== q.answer) bad.push(`${q.prompt} claimed ${q.answer}`);
      }
      return { bad, operands: Array.from(seenOperands).sort((x, y) => x - y) };
    }, range, TRIALS);

    check(`multiplication [${range}]: every stated answer is the real product`,
      r.bad.length === 0, r.bad.slice(0, 3).join(', '));
    check(`multiplication [${range}]: every operand stays inside ${lo}-${hi}`,
      r.operands.length > 0 && r.operands[0] >= lo && r.operands[r.operands.length - 1] <= hi,
      JSON.stringify(r.operands));
    // A range that never produces its own endpoints would be a silently
    // broken generator that still passes the bounds check above.
    check(`multiplication [${range}]: the range's endpoints both actually occur`,
      r.operands.indexOf(lo) !== -1 && r.operands.indexOf(hi) !== -1, JSON.stringify(r.operands));
  });
}

/* ---------------- multi-step add/subtract ---------------- */
{
  const dom = loadGame('lightning-multi-step.html');
  ['mixed', 'addonly', 'subonly'].forEach(shape => {
    const r = runInPage(dom, (shapeKey, n) => {
      st.shape = shapeKey;
      const bad = [];
      const opsSeen = new Set();
      let minAnswer = Infinity;
      for (let i = 0; i < n; i++) {
        const q = LIGHTNING_SPEC.generate();
        const m = q.prompt.match(/^(\d+) ([+−]) (\d+) ([+−]) (\d+)$/);
        if (!m) { bad.push('unparseable: ' + q.prompt); continue; }
        const a = Number(m[1]), op1 = m[2], b = Number(m[3]), op2 = m[4], c = Number(m[5]);
        opsSeen.add(op1); opsSeen.add(op2);
        if (a < 100 || a > 999 || b < 100 || b > 999 || c < 100 || c > 999) {
          bad.push('not 3-digit: ' + q.prompt);
        }
        const step1 = op1 === '+' ? a + b : a - b;
        const total = op2 === '+' ? step1 + c : step1 - c;
        if (total !== q.answer) bad.push(`${q.prompt} claimed ${q.answer}, is ${total}`);
        // The drill's own rule: a running total never drops below zero.
        if (step1 < 0) bad.push('negative intermediate: ' + q.prompt);
        if (total < 0) bad.push('negative total: ' + q.prompt);
        minAnswer = Math.min(minAnswer, q.answer);
      }
      return { bad, ops: Array.from(opsSeen), minAnswer };
    }, shape, TRIALS);

    check(`multi-step [${shape}]: three 3-digit operands, answer matches left-to-right evaluation`,
      r.bad.length === 0, r.bad.slice(0, 3).join(' | '));
    check(`multi-step [${shape}]: no intermediate or final value is ever negative`,
      r.minAnswer >= 0, `lowest answer seen: ${r.minAnswer}`);
    const expectedOps = shape === 'addonly' ? ['+'] : shape === 'subonly' ? ['−'] : ['+', '−'];
    check(`multi-step [${shape}]: uses exactly the operators this shape allows`,
      r.ops.length === expectedOps.length && expectedOps.every(o => r.ops.indexOf(o) !== -1),
      JSON.stringify(r.ops));
  });
}

/* ---------------- the shared round builder ---------------- */
{
  const dom = loadGame('lightning-multiplication.html');
  const r = runInPage(dom, () => {
    const rounds = [];
    for (let i = 0; i < 40; i++) {
      const qs = lightningBuildRound(LIGHTNING_SPEC, LIGHTNING_QUESTIONS_PER_ROUND);
      let adjacentRepeat = false;
      for (let j = 1; j < qs.length; j++) if (qs[j].prompt === qs[j - 1].prompt) adjacentRepeat = true;
      rounds.push({ n: qs.length, adjacentRepeat });
    }
    return {
      perRound: LIGHTNING_QUESTIONS_PER_ROUND,
      allTen: rounds.every(x => x.n === LIGHTNING_QUESTIONS_PER_ROUND),
      anyAdjacentRepeat: rounds.some(x => x.adjacentRepeat),
    };
  });
  check('a round is exactly 10 questions', r.perRound === 10 && r.allTen === true, JSON.stringify(r));
  // Back-to-back duplicates read as a bug even when they are legitimate
  // draws, so the builder rejects them.
  check('no round ever serves the same question twice in a row',
    r.anyAdjacentRepeat === false, JSON.stringify(r));
}

/* ---------------- the summary is about the work, not praise ---------- */
{
  const dom = loadGame('lightning-multiplication.html');
  const r = runInPage(dom, () => ({
    perfect: lightningSummary(10, 10),
    strong: lightningSummary(9, 10),
    mid: lightningSummary(6, 10),
    poor: lightningSummary(2, 10),
    acc: [lightningAccuracy(7, 10), lightningAccuracy(0, 0), lightningAccuracy(3, 4)],
  }));
  check('the round summary differs by how the round actually went',
    new Set([r.perfect, r.strong, r.mid, r.poor]).size === 4, JSON.stringify(r));
  check('accuracy handles a zero-question round without dividing by zero',
    r.acc[0] === 70 && r.acc[1] === 0 && r.acc[2] === 75, JSON.stringify(r.acc));
}

if (failures > 0) {
  console.error(`\n  ${failures} case(s) FAILED`);
  process.exitCode = 1;
} else {
  console.log(`\n  all lightning logic cases passed`);
}
