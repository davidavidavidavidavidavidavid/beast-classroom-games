/*
 * jsdom full-playthrough smoke test for detective-fraction-equivalence.html.
 *
 * Single-player puzzle game — no bot turn to wait out, no decideWinner.
 * Types guesses by dispatching real clicks on the on-screen keyboard's
 * `.kb-key` buttons (not by calling submit()/slotInput() directly), so this
 * proves the actual click-handler wiring works, not just the underlying
 * state functions. Two probes (wrong-guess/hint-at-2, flipped-equation win)
 * inject a hand-picked, fully deterministic puzzle via direct state access
 * rather than the real random generatePuzzle() — constructing a
 * "valid-but-wrong" guess that's guaranteed not to collide with a random
 * target, and distinct from an earlier wrong guess (to avoid tripping the
 * "already tried that" duplicate check instead of registering as a second
 * miss), is far simpler against a known fraction than a freshly-rolled one.
 */

'use strict';

const assert = require('assert');
const { loadGame, runInPage } = require('./jsdom-helpers');

function typeParts(dom, parts) {
  const digits = runInPage(dom, (p) => p.flatMap(v => String(v).split('')), parts);
  digits.forEach(d => {
    runInPage(dom, (digit) => { document.querySelector(`.kb-key[data-k="${digit}"]`).click(); }, d);
  });
}
function submitKey(dom) {
  runInPage(dom, () => { document.querySelector('.kb-key[data-k="ENTER"]').click(); });
}

function snapshotPhaseBlocks(dom) {
  return runInPage(dom, () => {
    const ids = ['hint-btn', 'next-btn'];
    const out = {};
    ids.forEach(id => {
      const cl = document.getElementById(id).classList;
      out[id] = { hidden: cl.contains('hidden'), phaseHidden: cl.contains('phase-hidden') };
    });
    return out;
  });
}

function main() {
  const dom = loadGame('detective-fraction-equivalence.html');

  /* ---------------- round 1: level 1, single-digit puzzle ---------------- */
  let cfg = runInPage(dom, () => ({ round: st.round, level: currentLevel(), parts: st.puzzle.parts }));
  assert.strictEqual(cfg.round, 1);
  assert.strictEqual(cfg.level, 1, 'round 1 should generate a Level 1 puzzle');
  assert.ok(cfg.parts.every(v => v <= 9), `Level 1 puzzles should be single-digit only, got ${cfg.parts}`);

  /* ---------------- layout-stability probe: hint-btn/next-btn are
     within-puzzle phase content (see CLAUDE.md's Detective design note) —
     must only ever toggle .phase-hidden, never .hidden. ---------------- */
  let snap = snapshotPhaseBlocks(dom);
  assert.strictEqual(snap['hint-btn'].hidden, false, '#hint-btn should never carry .hidden');
  assert.strictEqual(snap['next-btn'].hidden, false, '#next-btn should never carry .hidden');
  assert.strictEqual(snap['hint-btn'].phaseHidden, true, 'hint button should be reserved-but-invisible before 2 misses');
  assert.strictEqual(snap['next-btn'].phaseHidden, true, 'next-puzzle button should be reserved-but-invisible mid-puzzle');

  /* ---------------- solve the real round-1 puzzle correctly ---------------- */
  typeParts(dom, cfg.parts);
  submitKey(dom);

  let state = runInPage(dom, () => ({ gameOver: st.gameOver, solved: st.solved, streak: st.streak, round: st.round, msg: document.getElementById('msg').textContent }));
  assert.strictEqual(state.gameOver, true, 'a correct guess should end the puzzle');
  assert.strictEqual(state.solved, 1);
  assert.strictEqual(state.streak, 1);
  assert.strictEqual(state.round, 2, 'a win should advance the round counter (not dev-overridden)');
  assert.ok(/Case closed/.test(state.msg), `expected a success message, got "${state.msg}"`);

  snap = snapshotPhaseBlocks(dom);
  assert.strictEqual(snap['hint-btn'].hidden, false);
  assert.strictEqual(snap['next-btn'].hidden, false);
  assert.strictEqual(snap['next-btn'].phaseHidden, false, 'next-puzzle button should be visible once the puzzle is won');
  assert.strictEqual(snap['hint-btn'].phaseHidden, true, 'hint button should stay reserved-but-invisible on a win (never needed)');

  runInPage(dom, () => { document.getElementById('next-btn').click(); });
  cfg = runInPage(dom, () => ({ round: st.round, level: currentLevel() }));
  assert.strictEqual(cfg.round, 2);
  assert.strictEqual(cfg.level, 1, 'round 2 is still Level 1 (rounds 1-3)');

  /* ---------------- deterministic wrong-guess + hint-at-2 probe ----------------
     Inject a known puzzle (1/2 = 2/4) so a "valid but wrong" guess can be
     hand-picked with certainty, rather than searching a random target. */
  runInPage(dom, () => {
    st.puzzle = wrapFractionPuzzle({ n1:1, d1:2, n2:2, d2:4 }, 1, 2, 1, 2, 1);
    st.history = []; st.guesses = 0; st.gameOver = false; st.hintUsed = false;
    buildSlots(st.puzzle.parts);
    renderInputSlots(); renderHistory(); renderDots();
    setMsg('');
    el('hint-btn').classList.add('phase-hidden');
    el('next-btn').classList.add('phase-hidden');
  });

  // Wrong guess #1: 1/2 = 3/6 — a true, valid equation, but not the target.
  typeParts(dom, [1, 2, 3, 6]);
  submitKey(dom);
  let wrong1 = runInPage(dom, () => ({ guesses: st.guesses, gameOver: st.gameOver, hintHidden: document.getElementById('hint-btn').classList.contains('phase-hidden'), msg: document.getElementById('msg').textContent }));
  assert.strictEqual(wrong1.guesses, 1, 'a valid-but-wrong equation should count as a real guess');
  assert.strictEqual(wrong1.gameOver, false);
  assert.strictEqual(wrong1.hintHidden, true, 'hint should NOT appear after only 1 wrong guess');
  assert.ok(/but not the one/.test(wrong1.msg));

  // Wrong guess #2: 1/2 = 4/8 — a DIFFERENT valid-but-wrong equation (must
  // differ from guess #1, or this would trip the "already tried" duplicate
  // check instead of registering as a genuine second miss).
  typeParts(dom, [1, 2, 4, 8]);
  submitKey(dom);
  let wrong2 = runInPage(dom, () => ({ guesses: st.guesses, hintHidden: document.getElementById('hint-btn').classList.contains('phase-hidden'), hintUsed: st.hintUsed }));
  assert.strictEqual(wrong2.guesses, 2);
  assert.strictEqual(wrong2.hintHidden, false, 'hint button should appear after the 2nd wrong guess');
  assert.strictEqual(wrong2.hintUsed, false, 'the hint is available but not yet clicked/consumed');

  runInPage(dom, () => { document.getElementById('hint-btn').click(); });
  const hintState = runInPage(dom, () => ({
    hintUsed: st.hintUsed,
    hintHidden: document.getElementById('hint-btn').classList.contains('phase-hidden'),
    hintText: document.getElementById('hint-text').textContent,
  }));
  assert.strictEqual(hintState.hintUsed, true);
  assert.strictEqual(hintState.hintHidden, true, 'hint button should hide itself again once clicked');
  assert.strictEqual(hintState.hintText, 'Hint: the simplified form is 1/2', 'the hint should reveal the actual simplified base fraction');

  // Finish this puzzle off correctly before moving on.
  typeParts(dom, [1, 2, 2, 4]);
  submitKey(dom);
  assert.strictEqual(runInPage(dom, () => st.gameOver), true, 'the puzzle should still be winnable with guesses remaining after the hint');

  /* ---------------- flipped-equation win probe ----------------
     "n2/d2 = n1/d1" must count as solving the SAME puzzle as "n1/d1 =
     n2/d2" — an easy rule to accidentally drop in a rewrite (see
     CLAUDE.md). Inject another known puzzle and submit its flip. */
  runInPage(dom, () => {
    st.puzzle = wrapFractionPuzzle({ n1:1, d1:2, n2:2, d2:4 }, 1, 2, 1, 2, 1);
    st.history = []; st.guesses = 0; st.gameOver = false; st.hintUsed = false;
    buildSlots(st.puzzle.parts);
    renderInputSlots(); renderHistory(); renderDots();
    setMsg('');
    el('hint-btn').classList.add('phase-hidden');
    el('next-btn').classList.add('phase-hidden');
  });
  const targetParts = runInPage(dom, () => st.puzzle.parts); // [1,2,2,4]
  const flipped = [targetParts[2], targetParts[3], targetParts[0], targetParts[1]]; // [2,4,1,2]
  typeParts(dom, flipped);
  submitKey(dom);
  const flipResult = runInPage(dom, () => ({ gameOver: st.gameOver, msg: document.getElementById('msg').textContent }));
  assert.strictEqual(flipResult.gameOver, true, 'submitting the flipped equation should win the puzzle, same as the exact orientation');
  assert.ok(/Case closed/.test(flipResult.msg), `expected the flip to be treated as a win, got "${flipResult.msg}"`);

  /* ---------------- level-progression probe via the dev panel's round-skip ----------------
     Confirms the round -> level mapping actually drives a DIFFERENT puzzle
     shape, not just a cosmetic round-number bump. */
  runInPage(dom, () => { document.getElementById('skip-r10').click(); });
  let devState = runInPage(dom, () => ({ round: st.round, level: currentLevel(), devLevel: st.devLevel }));
  assert.strictEqual(devState.round, 10);
  assert.strictEqual(devState.devLevel, -1, 'skip-to-round-10 should leave level progression on Auto');
  assert.strictEqual(devState.level, 3, 'round 10 falls in the r<=12 bucket -> Level 3, a real difficulty jump from round 1\'s Level 1');

  // Level 3 allows (not requires) 2-digit values, unlike Level 1's hard
  // single-digit cap — regenerate several times and confirm at least one
  // actually produces a 2-digit part, proving the difficulty step is real,
  // not just a higher round NUMBER with the same puzzle shape.
  let sawTwoDigit = false;
  for (let i = 0; i < 40; i++) {
    runInPage(dom, () => { document.getElementById('regen-btn').click(); });
    const parts = runInPage(dom, () => st.puzzle.parts);
    if (parts.some(v => v > 9)) { sawTwoDigit = true; break; }
  }
  assert.ok(sawTwoDigit, 'Level 3 should be able to generate at least one 2-digit value across 40 regenerations (Level 1 never can)');

  console.log('  ✅ detective-fraction-equivalence.html: full playthrough smoke test passed');
  console.log('     solved a real round-1 puzzle | wrong-guess/hint-at-2 verified | flipped-equation win verified | round->level progression verified');
}

try {
  main();
} catch (e) {
  console.error('  ❌ detective-fraction-equivalence.html smoke test FAILED:', e.message);
  console.error(e.stack);
  process.exitCode = 1;
}
